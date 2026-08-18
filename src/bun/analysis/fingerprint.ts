/**
 * Chromaprint audio fingerprinting (fpcalc-compatible, algorithm 2).
 *
 * Uses the patched @unimusic/chromaprint raw-PCM entry point — the stock
 * package decodes via window.AudioContext, which doesn't exist in Bun.
 * Fingerprints the first 120 seconds (fpcalc default) of mono float32 PCM.
 */

import { configureChromaprint, fingerprintPcm } from "@unimusic/chromaprint";
import { join } from "node:path";

const FINGERPRINT_SECONDS = 120;

let wasmLoaded: Promise<void> | undefined;

/**
 * Emscripten can't fetch chromaprint.wasm from a file:// URL under Bun, so
 * read the bytes ourselves and inject them before the first call. Bundled
 * builds find it next to the bun bundle (electrobun.config.ts copy entry);
 * unbundled runs (e.g. scripts/fingerprint-smoke.ts) use node_modules.
 */
function ensureWasmBinary(): Promise<void> {
  wasmLoaded ??= (async () => {
    const candidates = [join(import.meta.dir, "chromaprint.wasm")];
    try {
      candidates.push(
        Bun.resolveSync("@unimusic/chromaprint/dist/chromaprint.wasm", import.meta.dir),
      );
    } catch {
      // no node_modules in packaged builds
    }
    for (const path of candidates) {
      const file = Bun.file(path);
      if (await file.exists()) {
        configureChromaprint({ wasmBinary: await file.arrayBuffer() });
        return;
      }
    }
    throw new Error(`chromaprint.wasm not found; tried: ${candidates.join(", ")}`);
  })();
  return wasmLoaded;
}

export async function computeFingerprint(
  pcmF32: ArrayBuffer,
  sampleRate: number,
): Promise<{ fingerprint: string; ms: number }> {
  const t0 = Date.now();
  await ensureWasmBinary();

  const f32 = new Float32Array(pcmF32);
  const sampleCount = Math.min(f32.length, sampleRate * FINGERPRINT_SECONDS);
  const pcm = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const sample = Math.max(-1, Math.min(1, f32[i]));
    pcm[i] = sample * 32767;
  }

  const fingerprint = await fingerprintPcm(pcm, sampleRate, 1);
  return { fingerprint, ms: Date.now() - t0 };
}
