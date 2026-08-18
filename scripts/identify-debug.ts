/**
 * Standalone diagnostic for the song-identification pipeline.
 * Runs every stage (duration → decode → fingerprint → AcoustID → ranking)
 * against a known track and prints intermediate values, so a failure can be
 * pinned to a single stage. Run: bun run scripts/identify-debug.ts
 */

import { existsSync, statSync } from "node:fs";
import { decodeAudio } from "../src/bun/analysis/decoder";
import { computeFingerprint } from "../src/bun/analysis/fingerprint";
import { readContainerDurationSec } from "../src/bun/analysis/duration";
import type { AcoustIdResult } from "../src/bun/lookup/acoustid";
import { rankCandidates } from "../src/bun/lookup/candidates";

const TEST_FILE = "F:\\Music\\DJ\\Funky Town\\Bee Gees - Stayin' Alive (Official Music Video).mp3";
const EXPECTED = { artist: "Bee Gees", title: "Stayin' Alive" };

// Mirrors src/bun/lookup/acoustid.ts — inlined so we can dump the raw
// response body on failure and A/B the gzip vs plain request encoding.
const ACOUSTID_CLIENT_KEY = "4pxMQKhebq";
const ACOUSTID_URL = "https://api.acoustid.org/v2/lookup";

function banner(stage: string) {
  console.log(`\n${"=".repeat(70)}\n  ${stage}\n${"=".repeat(70)}`);
}

function fail(stage: string, detail: string): never {
  console.log(`\n❌ FAIL at stage: ${stage}`);
  console.log(detail);
  process.exit(1);
}

async function acoustidRequest(
  fingerprint: string,
  durationSec: number,
  gzip: boolean,
): Promise<{ status: number; rawBody: string; results?: AcoustIdResult[]; error?: string }> {
  const body = new URLSearchParams({
    client: ACOUSTID_CLIENT_KEY,
    duration: String(Math.round(durationSec)),
    fingerprint,
    meta: "recordings releasegroups compress", // spaces → '+' when form-encoded (see acoustid.ts)
  }).toString();

  const res = await fetch(ACOUSTID_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(gzip ? { "Content-Encoding": "gzip" } : {}),
    },
    body: gzip ? Bun.gzipSync(new TextEncoder().encode(body)) : body,
  });

  const rawBody = await res.text();
  if (!res.ok) return { status: res.status, rawBody, error: `HTTP ${res.status} ${res.statusText}` };

  try {
    const data = JSON.parse(rawBody);
    if (data.status !== "ok") {
      return { status: res.status, rawBody, error: data.error?.message ?? "AcoustID returned an error" };
    }
    return { status: res.status, rawBody, results: data.results ?? [] };
  } catch {
    return { status: res.status, rawBody, error: "Response was not valid JSON" };
  }
}

// ── Stage 1: file check ─────────────────────────────────────────────────────
banner("Stage 1: File check");
if (!existsSync(TEST_FILE)) fail("file check", `File not found: ${TEST_FILE}`);
const sizeBytes = statSync(TEST_FILE).size;
console.log(`Path: ${TEST_FILE}`);
console.log(`Size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
console.log("✅ PASS");

// ── Stage 2: ffprobe full-track duration ────────────────────────────────────
banner("Stage 2: ffprobe container duration");
const durationSec = await readContainerDurationSec(TEST_FILE);
if (durationSec == null) {
  fail(
    "ffprobe duration",
    "readContainerDurationSec returned null — the app throws 'Could not determine the track's duration' here.\n" +
      "Run ffprobe on the file manually to see why (missing stream duration in container header?).",
  );
}
console.log(`Full-track duration: ${durationSec.toFixed(2)}s (sent to AcoustID as ${Math.round(durationSec)})`);
console.log("✅ PASS");

// ── Stage 3: ffmpeg decode ──────────────────────────────────────────────────
banner("Stage 3: ffmpeg decode (mono f32 @ 44100, first 120s)");
let decoded;
try {
  decoded = await decodeAudio(TEST_FILE, 44100, 120);
} catch (e) {
  fail("ffmpeg decode", String(e));
}
const f32 = new Float32Array(decoded.buffer);
let peak = 0;
let sumSquares = 0;
for (let i = 0; i < f32.length; i++) {
  const abs = Math.abs(f32[i]);
  if (abs > peak) peak = abs;
  sumSquares += f32[i] * f32[i];
}
const rms = Math.sqrt(sumSquares / f32.length);
console.log(`Samples: ${f32.length} (${decoded.durationSec.toFixed(2)}s decoded)`);
console.log(`PCM sanity — peak: ${peak.toFixed(4)}, RMS: ${rms.toFixed(4)}`);
if (f32.length === 0) fail("ffmpeg decode", "Decode produced 0 samples.");
if (peak < 0.001) {
  fail("ffmpeg decode", "PCM is effectively silent — the fingerprint would be a 'silence' fingerprint that matches nothing.");
}
console.log("✅ PASS");

// ── Stage 4: Chromaprint fingerprint ────────────────────────────────────────
banner("Stage 4: Chromaprint fingerprint (WASM)");
let fingerprint: string;
try {
  const result = await computeFingerprint(decoded.buffer, decoded.sampleRate);
  fingerprint = result.fingerprint;
  console.log(`Computed in ${result.ms}ms`);
} catch (e) {
  fail("fingerprint", String(e));
}
console.log(`Length: ${fingerprint.length} chars`);
console.log(`First 80 chars: ${fingerprint.slice(0, 80)}`);
if (!fingerprint.startsWith("AQ")) {
  console.log(
    "⚠️  WARNING: compressed Chromaprint fingerprints (algorithm 2) normally start with 'AQ'.\n" +
      "   This one doesn't — the WASM module may be emitting a raw/uncompressed or differently-encoded fingerprint,\n" +
      "   which AcoustID will not match. This is the most likely culprit if the lookup below returns 0 results.",
  );
}
if (fingerprint.length < 100) {
  fail("fingerprint", `Fingerprint suspiciously short (${fingerprint.length} chars) — expected several hundred+ for 120s of audio.`);
}
console.log("✅ PASS (format checks above)");

// ── Stage 5: AcoustID lookup ────────────────────────────────────────────────
banner("Stage 5: AcoustID lookup (gzipped body — as the app sends it)");
const gz = await acoustidRequest(fingerprint, durationSec, true);
console.log(`HTTP status: ${gz.status}`);
if (gz.error) {
  console.log(`Error: ${gz.error}`);
  console.log(`Raw body:\n${gz.rawBody.slice(0, 2000)}`);
  console.log("\nRetrying WITHOUT gzip to isolate request-encoding issues…");
} else {
  console.log(`Results: ${gz.results!.length}`);
}

banner("Stage 5b: AcoustID lookup (plain body — encoding A/B check)");
const plain = await acoustidRequest(fingerprint, durationSec, false);
console.log(`HTTP status: ${plain.status}`);
if (plain.error) {
  console.log(`Error: ${plain.error}`);
  console.log(`Raw body:\n${plain.rawBody.slice(0, 2000)}`);
} else {
  console.log(`Results: ${plain.results!.length}`);
}

if (gz.error && plain.error) {
  fail("AcoustID lookup", "Both gzipped and plain requests failed — see errors above (API key? network? request format?).");
}
if (gz.error && !plain.error) {
  console.log("\n⚠️  Gzipped request fails but plain succeeds → the gzip encoding in acoustid.ts is the bug.");
}
const results = (gz.results ?? plain.results)!;

console.log(`\nRaw results (${results.length}):`);
for (const r of results) {
  console.log(`  score=${r.score.toFixed(3)} acoustid=${r.id} recordings=${r.recordings?.length ?? "none (unlinked)"}`);
  for (const rec of r.recordings ?? []) {
    const artists = rec.artists?.map((a) => a.name).join(", ") ?? "?";
    console.log(`      ${artists} — ${rec.title ?? "?"} (${rec.duration ?? "?"}s) [${rec.id}]`);
  }
}
if (results.length === 0) {
  fail(
    "AcoustID lookup",
    "API call succeeded but returned ZERO results.\n" +
      "The fingerprint itself is not matching anything in AcoustID's database. Likely causes:\n" +
      "  1. The WASM fingerprint is not fpcalc-compatible (wrong algorithm/format) — compare against real fpcalc output.\n" +
      "  2. The duration sent is wildly wrong for the fingerprinted audio.\n" +
      "Verify by installing chromaprint (fpcalc) and running: fpcalc \"" + TEST_FILE + "\"\n" +
      "then compare its fingerprint prefix/length to Stage 4's output.",
  );
}
console.log("✅ PASS");

// ── Stage 6: ranking ────────────────────────────────────────────────────────
banner("Stage 6: rankCandidates");
const candidates = rankCandidates(results, durationSec);
const belowFloor = results.filter((r) => r.score < 0.5).length;
if (belowFloor > 0) console.log(`Note: ${belowFloor} raw result(s) dropped by the 0.5 score floor.`);
console.log(`Candidates: ${candidates.length}`);
for (const c of candidates) {
  console.log(
    `  ${(c.score * 100).toFixed(0)}%  ${c.artist ?? "?"} — ${c.title ?? "?"}  [album: ${c.album ?? "?"}, ${c.durationSec ?? "?"}s]`,
  );
}
if (candidates.length === 0) {
  fail(
    "ranking",
    "AcoustID returned results but rankCandidates produced no candidates — either every result scored < 0.5\n" +
      "or none had linked MusicBrainz recordings. The app would show 'no matches' despite API hits.",
  );
}

// ── Verdict ─────────────────────────────────────────────────────────────────
banner("Verdict");
const top = candidates[0];
const normalize = (s: string) => s.toLowerCase().replace(/’/g, "'");
const matches =
  normalize(top.artist ?? "").includes(normalize(EXPECTED.artist)) &&
  normalize(top.title ?? "").includes(normalize(EXPECTED.title));
if (matches) {
  console.log(`✅ Pipeline OK — top candidate is "${top.artist} — ${top.title}" as expected.`);
  console.log(
    "The identification pipeline works end-to-end. The app-side failure is in the RPC/DB layer:\n" +
      "check local.db for a stale/garbage cached `fingerprint` on this track (the orchestrator reuses it\n" +
      "instead of recomputing), and check waveform_duration for a bogus value.",
  );
} else {
  console.log(`⚠️  Pipeline ran end-to-end but top candidate is "${top.artist} — ${top.title}",`);
  console.log(`   expected "${EXPECTED.artist} — ${EXPECTED.title}". Inspect the candidate list above.`);
}
