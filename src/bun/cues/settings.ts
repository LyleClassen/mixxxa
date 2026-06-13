import type { Database } from "bun:sqlite";
import type { AutoCueRule, AutoCueSettings } from "../../shared/types";

// Persisted as one JSON blob under the `autoCue` key in the settings table.

const DEFAULT_SETTINGS: AutoCueSettings = {
  // ~174 BPM (DnB) → 64-beat lead-in; ~87 BPM (half-time tagged) → 32 beats
  rules: [
    { bpmMin: 160, bpmMax: 190, beatsBefore: 64 },
    { bpmMin: 80, bpmMax: 100, beatsBefore: 32 },
  ],
  fallbackBeatsBefore: 32,
  confidenceThreshold: 0.5,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function sanitizeRule(r: unknown): AutoCueRule | null {
  if (typeof r !== "object" || r === null) return null;
  const { bpmMin, bpmMax, beatsBefore } = r as Record<string, unknown>;
  if (typeof bpmMin !== "number" || typeof bpmMax !== "number" || typeof beatsBefore !== "number") return null;
  if (!Number.isFinite(bpmMin) || !Number.isFinite(bpmMax) || !Number.isFinite(beatsBefore)) return null;
  const min = clamp(bpmMin, 1, 999);
  const max = clamp(bpmMax, 1, 999);
  if (min > max) return null;
  return { bpmMin: min, bpmMax: max, beatsBefore: clamp(Math.round(beatsBefore), 0, 512) };
}

function sanitize(raw: Partial<AutoCueSettings>, base: AutoCueSettings): AutoCueSettings {
  const rules = Array.isArray(raw.rules)
    ? raw.rules.map(sanitizeRule).filter((r): r is AutoCueRule => r !== null)
    : base.rules;

  const fallbackBeatsBefore =
    typeof raw.fallbackBeatsBefore === "number" && Number.isFinite(raw.fallbackBeatsBefore)
      ? clamp(Math.round(raw.fallbackBeatsBefore), 0, 512)
      : base.fallbackBeatsBefore;

  const confidenceThreshold =
    typeof raw.confidenceThreshold === "number" && Number.isFinite(raw.confidenceThreshold)
      ? clamp(raw.confidenceThreshold, 0, 1)
      : base.confidenceThreshold;

  return { rules, fallbackBeatsBefore, confidenceThreshold };
}

export function loadAutoCueSettings(db: Database): AutoCueSettings {
  const row = db.query<{ value: string }, []>(
    "SELECT value FROM settings WHERE key = 'autoCue'"
  ).get();
  if (!row) return DEFAULT_SETTINGS;
  try {
    return sanitize(JSON.parse(row.value) as Partial<AutoCueSettings>, DEFAULT_SETTINGS);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAutoCueSettings(db: Database, patch: Partial<AutoCueSettings>): AutoCueSettings {
  const next = sanitize(patch, loadAutoCueSettings(db));
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('autoCue', ?)", [JSON.stringify(next)]);
  return next;
}
