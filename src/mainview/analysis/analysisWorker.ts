/**
 * Analysis Web Worker — runs in the renderer.
 *
 * Pipeline:
 *  - Essentia WASM (loaded once) → Key (KeyExtractor) + BPM (RhythmExtractor2013)
 *
 * Workers communicate with the main thread (WorkerPool) which relays RPC to Bun.
 */

import type { AnalysisPhase, QueueItemTimings, ClaimResponse } from "../../shared/types";
import { normalizeKey } from "../../shared/camelot";

// ── Main-thread RPC relay ─────────────────────────────────────────────────────

let rpcIdCounter = 0;
const pendingRpc = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

self.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as { type: string; id?: number; result?: unknown; error?: string };
  if (msg.type === "rpc_response" && msg.id !== undefined) {
    const pending = pendingRpc.get(msg.id);
    if (!pending) return;
    pendingRpc.delete(msg.id);
    if (msg.error) pending.reject(new Error(msg.error));
    else pending.resolve(msg.result);
  } else if (msg.type === "start") {
    startWorkerLoop();
  }
});

function rpc<T>(method: string, params?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++rpcIdCounter;
    pendingRpc.set(id, { resolve: resolve as (v: unknown) => void, reject });
    self.postMessage({ type: "rpc", id, method, params });
  });
}

// ── Essentia WASM (DSP) ───────────────────────────────────────────────────────

// The WASM module instantiation result — shared across DSP + feature extraction
let essentiaWASM: Record<string, unknown> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let essentiaInstance: any = null;

async function getEssentia() {
  if (essentiaWASM && essentiaInstance) return { essentiaWASM, essentiaInstance };

  // Import the Essentia WASM backend (named export `EssentiaWASM`, an
  // already-instantiated emscripten module — NOT a factory) and the DSP class.
  // The ES build compiles the embedded WASM synchronously, so there is nothing
  // to await on the module itself.
  const [{ EssentiaWASM }, { default: Essentia }] = await Promise.all([
    import("essentia.js/dist/essentia-wasm.es.js"),
    import("essentia.js/dist/essentia.js-core.es.js"),
  ]);

  essentiaWASM = EssentiaWASM as Record<string, unknown>;
  essentiaInstance = new Essentia(EssentiaWASM);
  return { essentiaWASM, essentiaInstance };
}

// ── Analysis pipeline ─────────────────────────────────────────────────────────

async function analyzeTrack(claim: ClaimResponse): Promise<void> {
  const timings: QueueItemTimings = {};
  let t0: number;
  // Track which phase we're in so failures can be attributed precisely.
  let currentPhase: AnalysisPhase = "decoding";
  // Essentia heap vector — freed in `finally` to avoid leaking across a batch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vectorSignal: any = null;

  const reportPhase = (phase: AnalysisPhase, progress: number, partialTimings?: Partial<QueueItemTimings>) => {
    currentPhase = phase;
    return rpc("reportAnalysisProgress", { itemId: claim.itemId, phase, progress, timings: partialTimings });
  };

  try {
    // 1. Fetch PCM (44.1kHz for DSP)
    t0 = performance.now();
    await reportPhase("decoding", 0);
    const resp = await fetch(claim.pcmUrl);
    if (!resp.ok) throw new Error(`PCM fetch failed: HTTP ${resp.status} ${resp.statusText}`);
    const pcmBuf = await resp.arrayBuffer();
    timings.timeDecodeMs = Math.round(performance.now() - t0);
    await reportPhase("decoding", 1, { timeDecodeMs: timings.timeDecodeMs });

    const pcm44k = new Float32Array(pcmBuf);
    if (pcm44k.length === 0) throw new Error("Decoded PCM is empty (0 samples)");
    const { essentiaInstance: essentia } = await getEssentia();

    // ── DSP aspects ──────────────────────────────────────────────────────────

    // Convert PCM to Essentia's internal vector type
    vectorSignal = essentia.arrayToVector(pcm44k);

    let analyzedKey: string | undefined;
    let analyzedBpm: number | undefined;
    let analyzedFirstBeatSec: number | undefined;

    if (claim.aspects.includes("key")) {
      await reportPhase("key", 0);
      t0 = performance.now();
      const res = essentia.KeyExtractor(vectorSignal) as { key: string; scale: string };
      timings.timeKeyMs = Math.round(performance.now() - t0);
      analyzedKey = normalizeKey(res.key, res.scale);
      await reportPhase("key", 1, { timeKeyMs: timings.timeKeyMs });
    }

    if (claim.aspects.includes("bpm")) {
      await reportPhase("bpm", 0);
      t0 = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = essentia.RhythmExtractor2013(vectorSignal) as { bpm: number; ticks: any };
      timings.timeBpmMs = Math.round(performance.now() - t0);
      analyzedBpm = res.bpm;
      // First beat tick (seconds) anchors the beat-grid overlay in the player.
      try {
        const ticks = essentia.vectorToArray(res.ticks) as Float32Array;
        if (ticks.length > 0) analyzedFirstBeatSec = ticks[0];
      } finally {
        if (res.ticks && typeof res.ticks.delete === "function") {
          try { res.ticks.delete(); } catch { /* already freed */ }
        }
      }
      await reportPhase("bpm", 1, { timeBpmMs: timings.timeBpmMs });
    }

    timings.timeTotalMs = (
      (timings.timeDecodeMs ?? 0) +
      (timings.timeKeyMs ?? 0) +
      (timings.timeBpmMs ?? 0)
    );

    await rpc("reportAnalysisResult", {
      itemId: claim.itemId,
      success: true,
      analyzedKey,
      analyzedBpm,
      analyzedFirstBeatSec,
      timings,
    });
  } catch (err) {
    // Build a descriptive, phase-attributed error and log it with full context
    // to the worker console (the UI only shows the short message).
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[analysisWorker] analysis failed during "${currentPhase}" (track ${claim.trackId})\n  file: ${claim.filePath}\n  error:`,
      err,
    );
    await rpc("reportAnalysisResult", {
      itemId: claim.itemId,
      success: false,
      error: `[${currentPhase}] ${message}`,
      timings,
    });
  } finally {
    // Release the Essentia heap vector regardless of success/failure.
    if (vectorSignal && typeof vectorSignal.delete === "function") {
      try { vectorSignal.delete(); } catch { /* already freed */ }
    }
  }
}

// ── Worker loop ───────────────────────────────────────────────────────────────

async function startWorkerLoop(): Promise<void> {
  await getEssentia(); // warm up WASM on first run

  while (true) {
    try {
      const claim = await rpc<ClaimResponse | null>("claimAnalysisWork", undefined);
      if (!claim) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      await analyzeTrack(claim);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

self.postMessage({ type: "ready" });
