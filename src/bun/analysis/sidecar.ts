/**
 * ORBIT Python sidecar supervisor.
 *
 * Manages a POOL of persistent Python processes that run sidecar/main.py.
 * Newline-delimited JSON framing, UUID correlation, wait-for-ready handshake,
 * restart-on-crash with a per-worker failure-count guard.
 *
 * Concurrency: the pool is sized by the `parallelism` setting (see
 * setSidecarPoolSize, wired from src/bun/analysis/index.ts). Each worker runs one
 * request at a time; runOnPool dispatches across idle workers so up to `poolSize`
 * orbit analyses run truly in parallel. Each process loads librosa + ONNX
 * (~300-600 MB resident), so at parallelism=8 the pool can use several GB — this is
 * the deliberate tradeoff for reusing the single parallelism slider.
 *
 * Dev: spawns via `uv run python main.py` from the sidecar/ directory.
 * Packaged: uses a frozen orbit-sidecar exe placed next to the bun bundle.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { Subprocess } from "bun";
import type { DropsResult } from "../../shared/types";
import { bunLog } from "../bunLog";

// ── Path resolution ──────────────────────────────────────────────────────────

const EXE_NAME = process.platform === "win32" ? "orbit-sidecar.exe" : "orbit-sidecar";
// Production: frozen exe placed next to the bun bundle by the build step
const PROD_EXE = join(import.meta.dir, EXE_NAME);

// Dev: walk up from import.meta.dir until we find sidecar/main.py.
// The bundle can be placed at varying depths in the build tree.
function findDevSidecarDir(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "sidecar");
    if (existsSync(join(candidate, "main.py"))) return candidate;
    const parent = join(dir, "..");
    if (parent === dir) break; // reached fs root
    dir = parent;
  }
  return join(import.meta.dir, "../../../../../../sidecar"); // last-resort fallback
}
const DEV_SIDECAR_DIR = findDevSidecarDir();

function resolveUvPath(): string {
  const fromPath = Bun.which("uv");
  if (fromPath) return fromPath;
  // Electron/Electrobun strips PATH — check common uv install locations
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const candidates =
    process.platform === "win32"
      ? [join(home, ".local", "bin", "uv.exe"), join(home, ".cargo", "bin", "uv.exe")]
      : [join(home, ".local", "bin", "uv"), join(home, ".cargo", "bin", "uv")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "uv";
}

function getSpawnArgs(): { cmd: string[]; cwd: string } {
  if (existsSync(PROD_EXE)) {
    return { cmd: [PROD_EXE], cwd: import.meta.dir };
  }
  return { cmd: [resolveUvPath(), "run", "python", "main.py"], cwd: DEV_SIDECAR_DIR };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface OrbitTimings {
  decodeMs: number;
  bpmMs: number;
  keyMs: number;
  featuresMs: number;
  totalMs: number;
}

export interface OrbitResult {
  bpm: number;
  key: string;
  energy: number;
  loudnessDb: number;
  dynamicRangeDb: number;
  danceability: number;
  durationSec: number;
  timings: OrbitTimings;
}

/** Called with the current step name and overall progress fraction (0..1). */
export type OrbitProgressCallback = (step: string, pct: number) => void;

// Tag on each pending entry — selects how readLoop maps the raw result
type SidecarTask = "analyze" | "drops";

interface PendingCall {
  task: SidecarTask;
  resolve: (r: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: OrbitProgressCallback;
}

interface AnalyzeRawResult {
  bpm: { value: number };
  key: { key: string; mode: string };
  energy: number;
  loudness_db: number;
  dynamic_range_db: number;
  danceability: number;
  duration: number;
  timings?: {
    decode_ms: number;
    bpm_ms: number;
    key_ms: number;
    features_ms: number;
    total_ms: number;
  };
}

interface SidecarResponse {
  id: string;
  result?: unknown;
  progress?: { step: string; pct: number };
  error?: string;
  ready?: boolean;
}

function mapAnalyzeResult(r: AnalyzeRawResult): OrbitResult {
  return {
    bpm: r.bpm.value,
    key: `${r.key.key} ${r.key.mode}`,
    energy: r.energy,
    loudnessDb: r.loudness_db,
    dynamicRangeDb: r.dynamic_range_db,
    danceability: r.danceability,
    durationSec: r.duration,
    timings: {
      decodeMs: r.timings?.decode_ms ?? 0,
      bpmMs: r.timings?.bpm_ms ?? 0,
      keyMs: r.timings?.key_ms ?? 0,
      featuresMs: r.timings?.features_ms ?? 0,
      totalMs: r.timings?.total_ms ?? 0,
    },
  };
}

// ── Pool state ─────────────────────────────────────────────────────────────────

interface SidecarWorker {
  proc: Subprocess<"pipe", "pipe", "pipe"> | null;
  ready: boolean;
  busy: boolean;
  failureCount: number;
  // Pending RPC calls awaiting a response from this worker's process
  pending: Map<string, PendingCall>;
}

const MAX_FAILURES = 3;

let poolSize = 2; // set from the `parallelism` setting via setSidecarPoolSize
const pool: SidecarWorker[] = [];
// Acquirers waiting for a worker to free up (FIFO)
const waiters: Array<(w: SidecarWorker) => void> = [];

function createWorker(): SidecarWorker {
  return { proc: null, ready: false, busy: false, failureCount: 0, pending: new Map() };
}

function killWorker(w: SidecarWorker): void {
  if (w.proc) {
    try { w.proc.kill(); } catch {}
  }
  w.proc = null;
  w.ready = false;
  for (const [, pend] of w.pending) {
    pend.reject(new Error("ORBIT sidecar process terminated"));
  }
  w.pending.clear();
}

/**
 * Set the orbit process-pool size (clamped 1–8). Idle workers beyond the new
 * size are reaped immediately; busy ones are reaped when released. Does not
 * eagerly spawn — processes are created lazily by acquireWorker when work arrives.
 */
export function setSidecarPoolSize(n: number): void {
  poolSize = Math.max(1, Math.min(8, Math.floor(n)));
  bunLog("SIDECAR", `pool size set to ${poolSize}`);
  // Reap idle workers beyond the new cap
  for (let i = pool.length - 1; i >= 0 && pool.length > poolSize; i--) {
    const w = pool[i];
    if (!w.busy) {
      killWorker(w);
      pool.splice(i, 1);
    }
  }
}

// ── Process management ───────────────────────────────────────────────────────

async function spawnAndWarm(w: SidecarWorker): Promise<void> {
  const { cmd, cwd } = getSpawnArgs();
  bunLog("SIDECAR", `spawning: cmd=[${cmd.join(" ")}] cwd=${cwd}`);
  const proc = Bun.spawn(cmd, {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  w.proc = proc;
  w.ready = false;

  // Drain stderr to the log (logging only)
  void drainStderr(proc);

  // Start reading stdout in the background
  void readLoop(w, proc);

  // Wait for the {"ready":true} handshake (librosa import can be slow)
  await waitForReady(w, 30_000);
}

async function waitForReady(w: SidecarWorker, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      bunLog("SIDECAR", `ready timeout after ${timeoutMs}ms`);
      reject(new Error("ORBIT sidecar did not send ready signal within timeout"));
    }, timeoutMs);

    const check = () => {
      if (w.ready) {
        clearTimeout(deadline);
        bunLog("SIDECAR", "ready");
        resolve();
      } else if (!w.proc) {
        clearTimeout(deadline);
        reject(new Error("ORBIT sidecar process exited before ready"));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

async function drainStderr(p: Subprocess<"pipe", "pipe", "pipe">): Promise<void> {
  try {
    for await (const chunk of p.stderr as unknown as AsyncIterable<Uint8Array>) {
      const text = new TextDecoder().decode(chunk).trimEnd();
      if (text) bunLog("SIDECAR", `stderr: ${text}`);
      process.stderr.write(chunk);
    }
  } catch {}
}

async function readLoop(w: SidecarWorker, p: Subprocess<"pipe", "pipe", "pipe">): Promise<void> {
  let buf = "";
  try {
    for await (const chunk of p.stdout as unknown as AsyncIterable<Uint8Array>) {
      buf += new TextDecoder().decode(chunk);
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as SidecarResponse;
          if (msg.ready) {
            w.ready = true;
            continue;
          }
          const pend = w.pending.get(msg.id);
          if (!pend) continue;
          if (msg.progress) {
            // Interim progress — keep the pending entry alive
            try { pend.onProgress?.(msg.progress.step, msg.progress.pct); } catch {}
            continue;
          }
          w.pending.delete(msg.id);
          if (msg.error) {
            pend.reject(new Error(msg.error));
          } else if (msg.result) {
            // The drops task's result is already in wire shape (DropsResult);
            // analyze needs the snake_case → camelCase mapping.
            pend.resolve(
              pend.task === "analyze"
                ? mapAnalyzeResult(msg.result as AnalyzeRawResult)
                : msg.result,
            );
          }
        } catch {}
      }
    }
  } catch {}

  // Process exited — reject all pending calls on this worker
  bunLog("SIDECAR", "process exited");
  for (const [, pend] of w.pending) {
    pend.reject(new Error("ORBIT sidecar process exited unexpectedly"));
  }
  w.pending.clear();
  // Only clear the process if it's still the one we were reading from (avoid
  // clobbering a freshly respawned proc).
  if (w.proc === p) {
    w.proc = null;
    w.ready = false;
  }
}

async function ensureRunning(w: SidecarWorker): Promise<void> {
  if (w.proc && w.ready) return;
  if (w.failureCount >= MAX_FAILURES) {
    throw new Error(`ORBIT sidecar failed to start ${MAX_FAILURES} times; giving up`);
  }
  bunLog("SIDECAR", `starting sidecar (failure count: ${w.failureCount})`);
  w.proc = null;
  w.ready = false;
  try {
    await spawnAndWarm(w);
    w.failureCount = 0;
  } catch (err) {
    w.failureCount++;
    killWorker(w);
    bunLog("SIDECAR", `start failed (failure count now: ${w.failureCount}): ${err}`);
    throw err;
  }
}

async function sendRequest(
  w: SidecarWorker,
  task: SidecarTask,
  payload: Record<string, unknown>,
  onProgress?: OrbitProgressCallback,
): Promise<unknown> {
  const id = randomUUID();
  const line = JSON.stringify({ id, ...payload }) + "\n";

  return new Promise<unknown>((resolve, reject) => {
    w.pending.set(id, { task, resolve, reject, onProgress });
    try {
      w.proc!.stdin.write(line);
    } catch (err) {
      w.pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// ── Pool dispatch ──────────────────────────────────────────────────────────────

async function acquireWorker(): Promise<SidecarWorker> {
  // Prefer an existing idle worker
  for (const w of pool) {
    if (!w.busy) {
      w.busy = true;
      return w;
    }
  }
  // Room to grow the pool
  if (pool.length < poolSize) {
    const w = createWorker();
    w.busy = true;
    pool.push(w);
    return w;
  }
  // Pool saturated — wait for a release
  return new Promise<SidecarWorker>((resolve) => {
    waiters.push(resolve);
  });
}

function releaseWorker(w: SidecarWorker): void {
  // Pool shrank past the cap while this worker was busy — reap it now.
  if (pool.length > poolSize) {
    const idx = pool.indexOf(w);
    if (idx !== -1) pool.splice(idx, 1);
    killWorker(w);
    return;
  }
  // Hand off to the next waiter (worker stays busy)
  const next = waiters.shift();
  if (next) {
    next(w);
    return;
  }
  w.busy = false;
}

/**
 * Run one sidecar request on the process pool. Acquires an idle worker (spawning
 * one lazily if the pool can still grow, else queueing until one frees up),
 * ensures its process is running, sends the request, and releases the worker.
 * On error the worker's process is marked dead so the next acquire respawns it.
 */
async function runOnPool<T>(
  task: SidecarTask,
  filePath: string,
  payload: Record<string, unknown>,
  onProgress?: OrbitProgressCallback,
): Promise<T> {
  const w = await acquireWorker();
  const name = basename(filePath);
  try {
    await ensureRunning(w);
    bunLog("SIDECAR", `${task} start: ${name}`);
    const t0 = Date.now();
    try {
      const result = await sendRequest(w, task, payload, onProgress);
      bunLog("SIDECAR", `${task} done: ${name} (${Date.now() - t0}ms)`);
      return result as T;
    } catch (err) {
      bunLog("SIDECAR", `${task} error: ${name} — ${err}`);
      // Mark the worker dead so it gets respawned on next use
      killWorker(w);
      throw err;
    }
  } finally {
    releaseWorker(w);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Analyze a track with ORBIT. */
export async function analyzeOrbit(filePath: string, maxLength: number, onProgress?: OrbitProgressCallback): Promise<OrbitResult> {
  return runOnPool<OrbitResult>("analyze", filePath, { filePath, maxLength }, onProgress);
}

/** Detect drops in a track (vendored drop-detector model in the sidecar). */
export async function detectDrops(
  filePath: string,
  opts: { threshold?: number; needBpm?: boolean } = {},
  onProgress?: OrbitProgressCallback,
): Promise<DropsResult> {
  return runOnPool<DropsResult>("drops", filePath, {
    task: "drops",
    filePath,
    ...(opts.threshold !== undefined ? { threshold: opts.threshold } : {}),
    ...(opts.needBpm ? { needBpm: true } : {}),
  }, onProgress);
}

/** Gracefully terminate every sidecar process and clear the pool. */
export function shutdownSidecar(): void {
  bunLog("SIDECAR", "shutdown requested");
  for (const w of pool) killWorker(w);
  pool.length = 0;
  waiters.length = 0;
}
