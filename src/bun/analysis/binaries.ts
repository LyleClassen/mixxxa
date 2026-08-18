/**
 * Resolves ffmpeg/ffprobe binary paths across dev and packaged builds, and
 * both platforms. Mirrors the resolution pattern already used for the ORBIT
 * sidecar's `uv` binary (see sidecar.ts: resolveUvPath / getSpawnArgs).
 *
 * `ffmpeg-static` / `ffprobe-static` return a path string unconditionally —
 * even when the binary failed to download — so their exports are only
 * trusted after an `existsSync` check, never on their own.
 */

import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { existsSync } from "node:fs";
import { join } from "node:path";

const EXE_SUFFIX = process.platform === "win32" ? ".exe" : "";

const COMMON_DIRS =
  process.platform === "win32"
    ? [
        join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links"),
        "C:\\ProgramData\\chocolatey\\bin",
      ]
    : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

function staticPath(name: "ffmpeg" | "ffprobe"): string | null {
  if (name === "ffmpeg") return typeof ffmpegStatic === "string" ? ffmpegStatic : null;
  return ffprobeStatic?.path ?? null;
}

/**
 * Resolution order (first hit that exists on disk wins):
 * 1. Next to the bun bundle (packaged builds)
 * 2. The ffmpeg-static / ffprobe-static download path, verified with existsSync
 * 3. Bun.which(name) — system PATH
 * 4. Platform-common install locations
 * 5. null — no usable binary found
 */
export function resolveBinary(name: "ffmpeg" | "ffprobe"): string | null {
  const nextToBundle = join(import.meta.dir, name + EXE_SUFFIX);
  if (existsSync(nextToBundle)) return nextToBundle;

  const fromStatic = staticPath(name);
  if (fromStatic && existsSync(fromStatic)) return fromStatic;

  const fromPath = Bun.which(name);
  if (fromPath) return fromPath;

  for (const dir of COMMON_DIRS) {
    if (!dir) continue;
    const candidate = join(dir, name + EXE_SUFFIX);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export const FFMPEG: string | null = resolveBinary("ffmpeg");
export const FFPROBE: string | null = resolveBinary("ffprobe");

export function checkToolchain(): { ffmpeg: string | null; ffprobe: string | null; ok: boolean } {
  return { ffmpeg: FFMPEG, ffprobe: FFPROBE, ok: FFMPEG != null && FFPROBE != null };
}
