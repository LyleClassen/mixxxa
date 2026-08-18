import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { applyVolumeMappings, classifyRekordboxPath, getVolumeRoot } from "../../shared/trackPath";
import { loadLibraryPathSettings } from "../libraryPathSettings";

export type FileResolution =
  | { ok: true; path: string }
  | { ok: false; reason: "streaming" | "volume-offline" | "missing" | "no-path"; detail?: string };

/**
 * Resolves a raw Rekordbox path to a file that (as of this call) exists on
 * disk, applying user volume mappings and distinguishing "the drive isn't
 * plugged in" from "the file itself is gone" — the two need different user
 * guidance. Never caches the fs check: drives come and go at runtime.
 */
export function resolveTrackFile(db: Database, rawPath: string | null): FileResolution {
  const classified = classifyRekordboxPath(rawPath);
  if (classified.kind === "none") return { ok: false, reason: "no-path" };
  if (classified.kind === "streaming") return { ok: false, reason: "streaming", detail: classified.service };

  const { mappings } = loadLibraryPathSettings(db);
  const mapped = applyVolumeMappings(classified.path, mappings);

  if (existsSync(mapped)) return { ok: true, path: mapped };

  const root = getVolumeRoot(mapped);
  if (root !== "/" && !existsSync(root)) {
    return { ok: false, reason: "volume-offline", detail: root };
  }
  return { ok: false, reason: "missing", detail: mapped };
}
