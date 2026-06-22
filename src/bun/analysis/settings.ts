import type { Database } from "bun:sqlite";
import type { AnalysisAspect, AnalysisEngine, AnalysisSettings, KeyNotation } from "../../shared/types";

const VALID_NOTATIONS: ReadonlySet<KeyNotation> = new Set(["camelot", "musical", "openkey"]);

const VALID_ASPECTS: ReadonlySet<AnalysisAspect> = new Set([
  "key", "bpm", "bitrate", "energy", "loudness", "dynamics", "danceability",
]);

const ORBIT_ONLY_ASPECTS: ReadonlySet<AnalysisAspect> = new Set([
  "energy", "loudness", "dynamics", "danceability",
]);

const DEFAULT_SETTINGS: AnalysisSettings = {
  parallelism: 2,
  aspects: ["key", "bpm"], // bitrate + ORBIT aspects are opt-in
  engine: "essentia",
  maxLogFiles: 10,
  keyNotation: "camelot",
};

export function loadSettings(db: Database): AnalysisSettings {
  const rows = db.query<{ key: string; value: string }, []>(
    "SELECT key, value FROM settings WHERE key IN ('parallelism', 'aspects', 'engine', 'maxLogFiles', 'keyNotation')"
  ).all();

  const map = new Map(rows.map((r) => [r.key, r.value]));

  const parallelism = map.has("parallelism")
    ? Math.max(1, Math.min(8, parseInt(map.get("parallelism")!, 10)))
    : DEFAULT_SETTINGS.parallelism;

  const engine: AnalysisEngine = map.get("engine") === "orbit" ? "orbit" : "essentia";

  const keyNotation: KeyNotation =
    map.has("keyNotation") && VALID_NOTATIONS.has(map.get("keyNotation") as KeyNotation)
      ? (map.get("keyNotation") as KeyNotation)
      : DEFAULT_SETTINGS.keyNotation;

  const maxLogFiles = map.has("maxLogFiles")
    ? Math.max(1, Math.min(50, parseInt(map.get("maxLogFiles")!, 10)))
    : DEFAULT_SETTINGS.maxLogFiles;

  let aspects: AnalysisAspect[] = DEFAULT_SETTINGS.aspects;
  if (map.has("aspects")) {
    try {
      const parsed = JSON.parse(map.get("aspects")!) as string[];
      const filtered = parsed.filter((a): a is AnalysisAspect => VALID_ASPECTS.has(a as AnalysisAspect));
      // Drop ORBIT-only aspects when engine is essentia
      aspects = engine === "essentia"
        ? filtered.filter((a) => !ORBIT_ONLY_ASPECTS.has(a))
        : filtered;
    } catch {}
  }

  return { parallelism, aspects, engine, maxLogFiles, keyNotation };
}

export function saveSettings(db: Database, patch: Partial<AnalysisSettings>): AnalysisSettings {
  const current = loadSettings(db);
  const engine: AnalysisEngine =
    patch.engine === "orbit" || patch.engine === "essentia" ? patch.engine : current.engine;

  let aspects = patch.aspects !== undefined ? patch.aspects : current.aspects;
  // Silently drop ORBIT-only aspects when switching back to essentia
  if (engine === "essentia") {
    aspects = aspects.filter((a) => !ORBIT_ONLY_ASPECTS.has(a));
  }

  const maxLogFiles = patch.maxLogFiles !== undefined
    ? Math.max(1, Math.min(50, patch.maxLogFiles))
    : current.maxLogFiles;

  const keyNotation: KeyNotation =
    patch.keyNotation !== undefined && VALID_NOTATIONS.has(patch.keyNotation)
      ? patch.keyNotation
      : current.keyNotation;

  const next: AnalysisSettings = {
    parallelism: patch.parallelism !== undefined
      ? Math.max(1, Math.min(8, patch.parallelism))
      : current.parallelism,
    aspects,
    engine,
    maxLogFiles,
    keyNotation,
  };

  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('parallelism', ?)", [String(next.parallelism)]);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('aspects', ?)", [JSON.stringify(next.aspects)]);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('engine', ?)", [next.engine]);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('maxLogFiles', ?)", [String(next.maxLogFiles)]);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('keyNotation', ?)", [next.keyNotation]);

  return next;
}
