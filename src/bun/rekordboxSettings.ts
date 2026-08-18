import type { Database } from "bun:sqlite";
import type { RekordboxSyncSettings } from "../shared/types";

// Persisted as one JSON blob under the `rekordboxSync` key in the settings table
// (mirrors the analysis/auto-cue settings pattern). Kept separate from
// AnalysisSettings on purpose.

const DEFAULT_SETTINGS: RekordboxSyncSettings = {
  maxBackups: 10,
};

function clampMaxBackups(n: number): number {
  return Math.max(1, Math.min(100, Math.round(n)));
}

export function loadRekordboxSettings(db: Database): RekordboxSyncSettings {
  const row = db.query<{ value: string }, []>(
    "SELECT value FROM settings WHERE key = 'rekordboxSync'"
  ).get();
  if (!row) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<RekordboxSyncSettings>;
    return {
      maxBackups: typeof parsed.maxBackups === "number" && Number.isFinite(parsed.maxBackups)
        ? clampMaxBackups(parsed.maxBackups)
        : DEFAULT_SETTINGS.maxBackups,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveRekordboxSettings(
  db: Database,
  patch: Partial<RekordboxSyncSettings>,
): RekordboxSyncSettings {
  const current = loadRekordboxSettings(db);
  const next: RekordboxSyncSettings = {
    maxBackups: patch.maxBackups !== undefined
      ? clampMaxBackups(patch.maxBackups)
      : current.maxBackups,
  };
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('rekordboxSync', ?)", [JSON.stringify(next)]);
  return next;
}
