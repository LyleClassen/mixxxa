// Smoke test: patched @unimusic/chromaprint fingerprintPcm under Bun.
import { fingerprintPcm } from "@unimusic/chromaprint";

const sampleRate = 44100;
const seconds = 30;
const pcm = new Int16Array(sampleRate * seconds);
for (let i = 0; i < pcm.length; i++) {
  const t = i / sampleRate;
  // Frequency sweep so the fingerprint has actual structure
  pcm[i] = Math.sin(2 * Math.PI * (220 + 200 * Math.sin(t * 0.5)) * t) * 20000;
}

const t0 = Date.now();
const fp = await fingerprintPcm(pcm, sampleRate, 1);
console.log(`fingerprint (${Date.now() - t0}ms, len=${fp.length}):`, fp.slice(0, 80) + "...");
