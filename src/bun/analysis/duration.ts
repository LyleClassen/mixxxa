import { existsSync } from "node:fs";
import { bunLog } from "../bunLog";
import { FFPROBE } from "./binaries";

/**
 * Read a file's audio stream duration from its container header via ffprobe —
 * fast, no PCM decode. Returns null if the file is missing or duration can't
 * be determined.
 */
export async function readContainerDurationSec(filePath: string): Promise<number | null> {
  if (!existsSync(filePath)) return null;
  if (!FFPROBE) {
    bunLog("duration", "ffprobe not found");
    return null;
  }

  const proc = Bun.spawn(
    [
      FFPROBE,
      "-v", "quiet",
      "-select_streams", "a:0",
      "-show_entries", "stream=duration",
      "-of", "csv=p=0",
      filePath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    bunLog("duration", `ffprobe exited ${exitCode}: ${stderr.trim()}`);
    return null;
  }

  const raw = stdout.trim();
  if (!raw || raw === "N/A") return null;
  const durationSec = parseFloat(raw);
  return isNaN(durationSec) || durationSec <= 0 ? null : durationSec;
}
