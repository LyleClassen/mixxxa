import ffprobeStatic from "ffprobe-static";
import { existsSync } from "node:fs";
import { bunLog } from "../bunLog";
import { readContainerDurationSec } from "./duration";

const FFPROBE: string = ffprobeStatic.path ?? "ffprobe";

export type BitrateResult =
  | { ok: true; bitrate: number; packetCount: number; durationSec: number }
  | { ok: false; reason: string };

/**
 * Compute the true average bitrate of a track's first audio stream by counting
 * packet bytes via ffprobe — more accurate than reading the container header.
 * Uses two passes: stream duration from header, then packet byte sum.
 * Returns kbps as an integer.
 */
export async function analyzeBitrate(filePath: string): Promise<BitrateResult> {
  bunLog("bitrate", `analyzing: ${filePath}`);
  bunLog("bitrate", `ffprobe path: ${FFPROBE} (exists: ${existsSync(FFPROBE)})`);

  if (!existsSync(filePath)) {
    bunLog("bitrate", `file not found: ${filePath}`);
    return { ok: false, reason: "file not found" };
  }

  // Pass 1: get stream duration from container header
  const durationSec = await readContainerDurationSec(filePath);
  bunLog("bitrate", `duration: ${durationSec ?? "unavailable"}`);
  if (durationSec == null) {
    return { ok: false, reason: "could not determine stream duration" };
  }

  // Pass 2: sum packet sizes
  const packetProc = Bun.spawn(
    [
      FFPROBE,
      "-v", "quiet",
      "-select_streams", "a:0",
      "-show_packets",
      "-show_entries", "packet=size",
      "-of", "csv=p=0",
      filePath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [packetStdout, packetStderr] = await Promise.all([
    new Response(packetProc.stdout).text(),
    new Response(packetProc.stderr).text(),
  ]);

  const packetExitCode = await packetProc.exited;
  bunLog("bitrate", `packet ffprobe exit code: ${packetExitCode}`);
  if (packetStderr.trim()) bunLog("bitrate", `packet ffprobe stderr: ${packetStderr.trim()}`);
  bunLog("bitrate", `packet stdout lines: ${packetStdout.split("\n").filter(l => l.trim()).length}`);

  if (packetExitCode !== 0) {
    return { ok: false, reason: `ffprobe (packets) exited ${packetExitCode}: ${packetStderr.trim()}` };
  }

  let totalBytes = 0;
  let packetCount = 0;
  let skippedLines = 0;

  for (const line of packetStdout.split("\n")) {
    const trimmed = line.trim().replace(/^"|"$/g, "");
    if (!trimmed) continue;
    const size = parseInt(trimmed, 10);
    if (!isNaN(size) && size > 0) {
      totalBytes += size;
      packetCount++;
    } else {
      skippedLines++;
    }
  }

  bunLog("bitrate", `totalBytes=${totalBytes}, packetCount=${packetCount}, skippedLines=${skippedLines}`);

  if (totalBytes === 0 || packetCount === 0) {
    bunLog("bitrate", `failed: no packet data`);
    return { ok: false, reason: "no packet data" };
  }

  const kbps = Math.round((totalBytes * 8) / durationSec / 1000);
  bunLog("bitrate", `result: ${kbps} kbps (${packetCount} packets over ${durationSec}s)`);
  return { ok: true, bitrate: kbps, packetCount, durationSec };
}
