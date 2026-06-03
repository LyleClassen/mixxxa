import ffmpegStatic from "ffmpeg-static";

// ffmpeg-static provides the path to a bundled platform binary.
// Fall back to system PATH if the package path is unavailable (e.g. stripped bundle).
const FFMPEG: string = ffmpegStatic ?? "ffmpeg";

export interface DecodedPcm {
  /** Mono float32 PCM at the requested sample rate */
  buffer: ArrayBuffer;
  sampleRate: number;
  durationSec: number;
}

/**
 * Decode an audio file to mono float32 PCM using ffmpeg.
 * sampleRate: 44100 for Key/BPM DSP; 16000 for ML feature extraction.
 */
export async function decodeAudio(
  filePath: string,
  sampleRate: 44100 | 16000 = 44100,
): Promise<DecodedPcm> {
  const proc = Bun.spawn(
    [
      FFMPEG,
      "-y",
      "-i", filePath,
      "-ac", "1",
      "-ar", String(sampleRate),
      "-f", "f32le",
      "-",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [pcmBuf, stderrText] = await Promise.all([
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited ${exitCode}: ${stderrText}`);
  }

  const samples = pcmBuf.byteLength / 4; // float32 = 4 bytes
  return {
    buffer: pcmBuf,
    sampleRate,
    durationSec: samples / sampleRate,
  };
}
