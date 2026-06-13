/**
 * ORBIT Python sidecar supervisor.
 *
 * Manages a single persistent Python process that runs sidecar/main.py.
 * Newline-delimited JSON framing, UUID correlation, wait-for-ready handshake,
 * restart-on-crash with a failure-count guard, and a single in-flight mutex
 * (v1: serialized requests).
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

// ── State ────────────────────────────────────────────────────────────────────

let proc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
let ready = false;
let failureCount = 0;
const MAX_FAILURES = 3;

// Tag on each pending entry — selects how readLoop maps the raw result
type SidecarTask = "analyze" | "drops";

// Pending RPC calls awaiting a response from the sidecar
const pending = new Map<string, {
  task: SidecarTask;
  resolve: (r: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: OrbitProgressCallback;
}>();

// In-flight mutex: only one request at a time in v1
let inflight: Promise<unknown> | null = null;

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

// ── Process management ───────────────────────────────────────────────────────

async function spawnAndWarm(): Promise<void> {
  const { cmd, cwd } = getSpawnArgs();
  bunLog("SIDECAR", `spawning: cmd=[${cmd.join(" ")}] cwd=${cwd}`);
  proc = Bun.spawn(cmd, {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  // Drain stderr to a string buffer (logging only)
  void drainStderr(proc);

  // Start reading stdout in the background
  void readLoop(proc);

  // Wait for the {"ready":true} handshake (up to 60 s for librosa import)
  await waitForReady(30_000);
}

async function waitForReady(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      bunLog("SIDECAR", `ready timeout after ${timeoutMs}ms`);
      reject(new Error("ORBIT sidecar did not send ready signal within timeout"));
    }, timeoutMs);

    const check = () => {
      if (ready) {
        clearTimeout(deadline);
        bunLog("SIDECAR", "ready");
        resolve();
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

async function readLoop(p: Subprocess<"pipe", "pipe", "pipe">): Promise<void> {
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
            ready = true;
            continue;
          }
          const pend = pending.get(msg.id);
          if (!pend) continue;
          if (msg.progress) {
            // Interim progress — keep the pending entry alive
            try { pend.onProgress?.(msg.progress.step, msg.progress.pct); } catch {}
            continue;
          }
          pending.delete(msg.id);
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

  // Process exited — reject all pending calls
  bunLog("SIDECAR", "process exited");
  for (const [, pend] of pending) {
    pend.reject(new Error("ORBIT sidecar process exited unexpectedly"));
  }
  pending.clear();
  proc = null;
  ready = false;
}

// ── Public API ───────────────────────────────────────────────────────────────

async function ensureRunning(): Promise<void> {
  if (proc && ready) return;
  if (failureCount >= MAX_FAILURES) {
    throw new Error(`ORBIT sidecar failed to start ${MAX_FAILURES} times; giving up`);
  }
  bunLog("SIDECAR", `starting sidecar (failure count: ${failureCount})`);
  proc = null;
  ready = false;
  try {
    await spawnAndWarm();
    failureCount = 0;
  } catch (err) {
    failureCount++;
    proc = null;
    ready = false;
    bunLog("SIDECAR", `start failed (failure count now: ${failureCount}): ${err}`);
    throw err;
  }
}

async function sendRequest(
  task: SidecarTask,
  payload: Record<string, unknown>,
  onProgress?: OrbitProgressCallback,
): Promise<unknown> {
  const id = randomUUID();
  const line = JSON.stringify({ id, ...payload }) + "\n";

  return new Promise<unknown>((resolve, reject) => {
    pending.set(id, { task, resolve, reject, onProgress });
    try {
      proc!.stdin.write(line);
    } catch (err) {
      pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Run one sidecar request through the shared mutex/ensureRunning/restart
 * machinery. Lazily spawns the sidecar on first call, serializes requests
 * (one at a time), and marks the process dead on error so the next call
 * restarts it.
 */
async function runSerialized<T>(
  task: SidecarTask,
  filePath: string,
  payload: Record<string, unknown>,
  onProgress?: OrbitProgressCallback,
): Promise<T> {
  // Wait for any in-flight request to finish before starting a new one
  while (inflight) {
    try { await inflight; } catch { /* ignore errors from previous calls */ }
  }

  inflight = (async () => {
    await ensureRunning();
    const name = basename(filePath);
    bunLog("SIDECAR", `${task} start: ${name}`);
    const t0 = Date.now();
    try {
      const result = await sendRequest(task, payload, onProgress);
      bunLog("SIDECAR", `${task} done: ${name} (${Date.now() - t0}ms)`);
      return result;
    } catch (err) {
      bunLog("SIDECAR", `${task} error: ${name} — ${err}`);
      proc = null;
      ready = false;
      throw err;
    }
  })();

  try {
    return (await inflight) as T;
  } finally {
    inflight = null;
  }
}

/** Analyze a track with ORBIT. */
export async function analyzeOrbit(filePath: string, maxLength: number, onProgress?: OrbitProgressCallback): Promise<OrbitResult> {
  return runSerialized<OrbitResult>("analyze", filePath, { filePath, maxLength }, onProgress);
}

/** Detect drops in a track (vendored drop-detector model in the sidecar). */
export async function detectDrops(
  filePath: string,
  opts: { threshold?: number; needBpm?: boolean } = {},
  onProgress?: OrbitProgressCallback,
): Promise<DropsResult> {
  return runSerialized<DropsResult>("drops", filePath, {
    task: "drops",
    filePath,
    ...(opts.threshold !== undefined ? { threshold: opts.threshold } : {}),
    ...(opts.needBpm ? { needBpm: true } : {}),
  }, onProgress);
}

/** Gracefully terminate the sidecar if running. */
export function shutdownSidecar(): void {
  if (proc) {
    bunLog("SIDECAR", "shutdown requested");
    try { proc.kill(); } catch {}
    proc = null;
    ready = false;
  }
}
