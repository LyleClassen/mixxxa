// Camelot wheel mapping: "Note scale" → Camelot notation
// Used by both the Essentia renderer worker and the ORBIT Bun-side engine.
export const CAMELOT_MAP: Record<string, string> = {
  "C major": "8B", "G major": "9B", "D major": "10B", "A major": "11B",
  "E major": "12B", "B major": "1B", "F# major": "2B", "Db major": "3B",
  "Ab major": "4B", "Eb major": "5B", "Bb major": "6B", "F major": "7B",
  "A minor": "8A", "E minor": "9A", "B minor": "10A", "F# minor": "11A",
  "C# minor": "12A", "G# minor": "1A", "D# minor": "2A", "Bb minor": "3A",
  "F minor": "4A", "C minor": "5A", "G minor": "6A", "D minor": "7A",
};

export function normalizeKey(key: string, scale: string): string {
  const full = `${key} ${scale}`;
  return CAMELOT_MAP[full] ?? full;
}

// ---------------------------------------------------------------------------
// Camelot Wheel pathfinder
//
// Deterministic implementation of the transition lexicon in
// src/models/protocols/camelot-wheel.md. Given a start key, a target key, and a
// track count, it finds a harmonically valid path and labels every transition.
// This is plain graph search — no model needed.
// ---------------------------------------------------------------------------

export type Mode = "A" | "B";

export interface CamelotKey {
  /** Wheel number, 1-12. */
  n: number;
  /** 'A' = minor, 'B' = major. */
  mode: Mode;
}

/** A single move in the lexicon: how N shifts, whether the mode flips, and how
 *  it affects energy (positive = boost, negative = drop, 0 = neutral). */
interface MoveDef {
  label: string;
  energy: number;
  delta: number;
  flip: boolean;
}

// From "### For Minor Keys (A)" in the protocol.
const MINOR_MOVES: MoveDef[] = [
  { label: "Perfect Match", energy: 0, delta: 0, flip: false },
  { label: "Perfect Match", energy: 0, delta: -1, flip: true },
  { label: "Energy Boost (+)", energy: 1, delta: 0, flip: true },
  { label: "Energy Boost (+)", energy: 1, delta: 1, flip: false },
  { label: "Energy Boost (++)", energy: 2, delta: -3, flip: false },
  { label: "Energy Boost (+++)", energy: 3, delta: 2, flip: false },
  { label: "Energy Boost (+++)", energy: 3, delta: -5, flip: false },
  { label: "Energy Drop (-)", energy: -1, delta: -1, flip: false },
  { label: "Energy Drop (--)", energy: -2, delta: 3, flip: false },
  { label: "Energy Drop (---)", energy: -3, delta: -2, flip: false },
  { label: "Energy Drop (---)", energy: -3, delta: 5, flip: false },
  { label: "Mood Change", energy: 0, delta: 3, flip: true },
];

// From "### For Major Keys (B)" in the protocol.
const MAJOR_MOVES: MoveDef[] = [
  { label: "Perfect Match", energy: 0, delta: 0, flip: false },
  { label: "Perfect Match", energy: 0, delta: 1, flip: true },
  { label: "Energy Boost (+)", energy: 1, delta: 1, flip: false },
  { label: "Energy Boost (++)", energy: 2, delta: -3, flip: false },
  { label: "Energy Boost (+++)", energy: 3, delta: 2, flip: false },
  { label: "Energy Boost (+++)", energy: 3, delta: -5, flip: false },
  { label: "Energy Drop (-)", energy: -1, delta: 0, flip: true },
  { label: "Energy Drop (-)", energy: -1, delta: -1, flip: false },
  { label: "Energy Drop (--)", energy: -2, delta: 3, flip: false },
  { label: "Energy Drop (---)", energy: -3, delta: -2, flip: false },
  { label: "Energy Drop (---)", energy: -3, delta: 5, flip: false },
  { label: "Mood Change", energy: 0, delta: -3, flip: true },
];

/** Wrap a wheel number to 1-12 (0 -> 12, 13 -> 1, -1 -> 11, ...). */
function wrap(n: number): number {
  return ((((n - 1) % 12) + 12) % 12) + 1;
}

/** Parse "4A" / "12b" into a CamelotKey. Throws on malformed input. */
export function parseCamelot(key: string): CamelotKey {
  const m = /^\s*(\d{1,2})\s*([AB])\s*$/i.exec(key);
  if (!m) throw new Error(`Invalid Camelot key: "${key}"`);
  const n = Number(m[1]);
  if (n < 1 || n > 12) throw new Error(`Camelot number out of range (1-12): "${key}"`);
  return { n, mode: m[2].toUpperCase() as Mode };
}

/** Format a CamelotKey back to "4A". */
export function formatCamelot(key: CamelotKey): string {
  return `${key.n}${key.mode}`;
}

/** A reachable neighbour: the destination key plus the move that gets there. */
export interface Transition {
  key: string;
  label: string;
  energy: number;
}

/** All harmonically valid one-step moves from a key, per the lexicon. */
export function getTransitions(key: CamelotKey): Transition[] {
  const moves = key.mode === "A" ? MINOR_MOVES : MAJOR_MOVES;
  return moves.map((mv) => {
    const mode: Mode = mv.flip ? (key.mode === "A" ? "B" : "A") : key.mode;
    return {
      key: formatCamelot({ n: wrap(key.n + mv.delta), mode }),
      label: mv.label,
      energy: mv.energy,
    };
  });
}

/** One stop on a generated path. The first step has no incoming transition. */
export interface PathStep {
  /** Camelot key of this track, e.g. "4A". */
  key: string;
  /** Lexicon name of the move used to arrive here (undefined for the start). */
  transition?: string;
  /** Energy delta of that move (undefined for the start). */
  energy?: number;
}

export interface FindPathOptions {
  /**
   * How to choose among paths that satisfy the track count:
   * - "high" (default): maximise total energy (keep the set climbing).
   * - "low": minimise total energy (wind the set down).
   * - "any": return any valid path.
   */
  energy?: "high" | "low" | "any";
}

/**
 * Find a harmonically valid path from `start` to `target` in exactly `tracks`
 * tracks (so `tracks - 1` transitions; the start counts as track 1).
 *
 * Uses a per-step dynamic program over the 24-node wheel: at each step it keeps
 * the best-scoring path to every reachable key, then reads off the target at the
 * final step. Returns the path with each transition labelled, or `null` if no
 * path of that exact length exists.
 *
 * @example
 * findPath("4A", "12B", 5); // 4A → 1A → 10A → 12A → 12B, all Energy Boosts
 */
export function findPath(
  start: string,
  target: string,
  tracks: number,
  options: FindPathOptions = {},
): PathStep[] | null {
  const energyPref = options.energy ?? "high";
  const transitions = tracks - 1;
  if (!Number.isInteger(tracks) || transitions < 0) return null;

  const startKey = formatCamelot(parseCamelot(start));
  const targetKey = formatCamelot(parseCamelot(target));

  interface Entry {
    path: PathStep[];
    score: number;
  }

  // layer: best Entry reaching each key in `step` transitions so far.
  let layer = new Map<string, Entry>([
    [startKey, { path: [{ key: startKey }], score: 0 }],
  ]);

  const isBetter = (next: number, prev: number) =>
    energyPref === "low" ? next < prev : next > prev; // "any" keeps the first seen

  for (let step = 0; step < transitions; step++) {
    const nextLayer = new Map<string, Entry>();
    for (const entry of layer.values()) {
      const current = parseCamelot(entry.path[entry.path.length - 1].key);
      for (const mv of getTransitions(current)) {
        const score = entry.score + mv.energy;
        const existing = nextLayer.get(mv.key);
        if (energyPref !== "any" && existing && !isBetter(score, existing.score)) {
          continue;
        }
        if (existing && energyPref === "any") continue;
        nextLayer.set(mv.key, {
          score,
          path: [...entry.path, { key: mv.key, transition: mv.label, energy: mv.energy }],
        });
      }
    }
    layer = nextLayer;
  }

  return layer.get(targetKey)?.path ?? null;
}

/** Render a path as human-readable lines, e.g. for logging or UI. */
export function formatPath(path: PathStep[]): string {
  return path
    .map((step, i) =>
      i === 0
        ? `Track 1: ${step.key}`
        : `Track ${i + 1}: ${step.key}  (${step.transition})`,
    )
    .join("\n");
}
