import type { Database } from "bun:sqlite";
import type { LibraryPathSettings, VolumeMapping } from "../shared/types";

// Persisted as one JSON blob under the `libraryPaths` key in the settings
// table (mirrors rekordboxSettings.ts).

const DEFAULT_SETTINGS: LibraryPathSettings = {
  mappings: [],
};

function sanitizeMapping(m: unknown): VolumeMapping | null {
  if (typeof m !== "object" || m === null) return null;
  const { from, to } = m as Record<string, unknown>;
  if (typeof from !== "string" || typeof to !== "string") return null;
  if (from.trim() === "" || to.trim() === "") return null;
  return { from, to };
}

export function loadLibraryPathSettings(db: Database): LibraryPathSettings {
  const row = db.query<{ value: string }, []>(
    "SELECT value FROM settings WHERE key = 'libraryPaths'"
  ).get();
  if (!row) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<LibraryPathSettings>;
    const mappings = Array.isArray(parsed.mappings)
      ? parsed.mappings.map(sanitizeMapping).filter((m): m is VolumeMapping => m != null)
      : DEFAULT_SETTINGS.mappings;
    return { mappings };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveLibraryPathSettings(
  db: Database,
  patch: Partial<LibraryPathSettings>,
): LibraryPathSettings {
  const current = loadLibraryPathSettings(db);
  const next: LibraryPathSettings = {
    mappings: patch.mappings !== undefined
      ? patch.mappings.map(sanitizeMapping).filter((m): m is VolumeMapping => m != null)
      : current.mappings,
  };
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('libraryPaths', ?)", [JSON.stringify(next)]);
  return next;
}
