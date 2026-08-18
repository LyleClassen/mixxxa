import { getDb } from "../db/localDb";
import { loadLibraryPathSettings, saveLibraryPathSettings } from "../libraryPathSettings";
import { resolveTrackFile } from "../paths/resolveTrackFile";
import { applyVolumeMappings, classifyRekordboxPath, getVolumeRoot } from "../../shared/trackPath";
import type { LibraryPathSettings, UnresolvedRoot } from "../../shared/types";

let dataDir: string;

export function initLibraryPathsHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

export const libraryPathsHandlers = {
  getLibraryPathSettings: async (): Promise<LibraryPathSettings> => {
    return loadLibraryPathSettings(getDb(dataDir));
  },

  setLibraryPathSettings: async (patch: Partial<LibraryPathSettings>): Promise<LibraryPathSettings> => {
    return saveLibraryPathSettings(getDb(dataDir), patch);
  },

  // Groups tracks that fail to resolve to a file by their volume root, so
  // "393 broken tracks" becomes "1 drive is unplugged, 1 root needs remapping".
  getUnresolvedRoots: async (): Promise<UnresolvedRoot[]> => {
    const db = getDb(dataDir);
    const rows = db.query<{ file_path: string | null }, []>(
      "SELECT file_path FROM content WHERE path_kind IS NOT 'streaming'"
    ).all();

    const { mappings } = loadLibraryPathSettings(db);
    const byRoot = new Map<string, UnresolvedRoot>();
    for (const row of rows) {
      const resolution = resolveTrackFile(db, row.file_path);
      if (resolution.ok || resolution.reason === "streaming" || resolution.reason === "no-path") continue;

      const classified = classifyRekordboxPath(row.file_path);
      if (classified.kind !== "file") continue;
      const mapped = applyVolumeMappings(classified.path, mappings);
      const root = getVolumeRoot(mapped);

      const existing = byRoot.get(root);
      if (existing) {
        existing.trackCount++;
      } else {
        byRoot.set(root, { root, trackCount: 1, reason: resolution.reason });
      }
    }
    return Array.from(byRoot.values()).sort((a, b) => b.trackCount - a.trackCount);
  },
};
