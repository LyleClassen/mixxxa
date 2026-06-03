import type { Database } from "bun:sqlite";
import type { AnalysisAspect, AnalysisSettings } from "../../shared/types";

const DEFAULT_SETTINGS: AnalysisSettings = {
  parallelism: 2,
  aspects: ["key", "bpm"],
};

export function loadSettings(db: Database): AnalysisSettings {
  const rows = db.query<{ key: string; value: string }, []>(
    "SELECT key, value FROM settings WHERE key IN ('parallelism', 'aspects')"
  ).all();

  const map = new Map(rows.map((r) => [r.key, r.value]));

  const parallelism = map.has("parallelism")
    ? Math.max(1, Math.min(8, parseInt(map.get("parallelism")!, 10)))
    : DEFAULT_SETTINGS.parallelism;

  let aspects: AnalysisAspect[] = DEFAULT_SETTINGS.aspects;
  if (map.has("aspects")) {
    try {
      aspects = JSON.parse(map.get("aspects")!) as AnalysisAspect[];
    } catch {}
  }

  return { parallelism, aspects };
}

export function saveSettings(db: Database, patch: Partial<AnalysisSettings>): AnalysisSettings {
  const current = loadSettings(db);
  const next: AnalysisSettings = {
    parallelism: patch.parallelism !== undefined
      ? Math.max(1, Math.min(8, patch.parallelism))
      : current.parallelism,
    aspects: patch.aspects !== undefined ? patch.aspects : current.aspects,
  };

  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('parallelism', ?)",
    String(next.parallelism),
  );
  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('aspects', ?)",
    JSON.stringify(next.aspects),
  );

  return next;
}
