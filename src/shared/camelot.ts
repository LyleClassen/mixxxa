// Key notation conversion. Single source of truth used by both the Essentia
// renderer worker and the ORBIT Bun-side engine to normalise analysed keys to
// Camelot, and by the renderer to display any stored key in the user's chosen
// notation (Camelot / Musical / Open Key).
import type { KeyNotation } from "./types";

// Natural-note pitch classes; accidentals are applied on top.
const NOTE_BASE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** Parse a note like "C", "C#", "Db", "F♯" to a pitch class 0-11, or null. */
function parsePitchClass(note: string): number | null {
  const m = /^([a-g])([#b♯♭]*)$/i.exec(note.trim());
  if (!m) return null;
  let pc = NOTE_BASE[m[1].toLowerCase()];
  for (const ch of m[2]) {
    if (ch === "#" || ch === "♯") pc += 1;
    else if (ch === "b" || ch === "♭") pc -= 1;
  }
  return ((pc % 12) + 12) % 12;
}

/** Map a scale word ("major"/"maj"/"M"/"" → B, "minor"/"min"/"m" → A). */
function parseMode(scale: string): Mode {
  const s = scale.trim().toLowerCase();
  if (s.startsWith("min") || s === "m") return "A";
  return "B"; // major / maj / "" all map to major
}

// Camelot wheel number (1-12) for each pitch class. Enharmonic spellings
// (C#/Db, D#/Eb, …) collapse to one slot, so any spelling resolves correctly.
const majorCamelot: number[] = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const minorCamelot: number[] = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

// Canonical note spellings per Camelot number (1-12), for Musical display.
const MAJOR_NOTE: Record<number, string> = {
  1: "B", 2: "F#", 3: "Db", 4: "Ab", 5: "Eb", 6: "Bb",
  7: "F", 8: "C", 9: "G", 10: "D", 11: "A", 12: "E",
};
const MINOR_NOTE: Record<number, string> = {
  1: "G#", 2: "D#", 3: "Bb", 4: "F", 5: "C", 6: "G",
  7: "D", 8: "A", 9: "E", 10: "B", 11: "F#", 12: "C#",
};

/**
 * Normalise an analysed key (note + scale, any enharmonic spelling) to Camelot.
 * Falls back to `"${key} ${scale}"` only when the note can't be parsed.
 */
export function normalizeKey(key: string, scale: string): string {
  const pc = parsePitchClass(key);
  if (pc != null) {
    const mode = parseMode(scale);
    const n = mode === "A" ? minorCamelot[pc] : majorCamelot[pc];
    return formatCamelot({ n, mode });
  }
  // Note unparseable on its own — maybe the value already encodes its scale.
  const any = parseAnyKey(`${key} ${scale}`.trim()) ?? parseAnyKey(key);
  return any ? formatCamelot(any) : `${key} ${scale}`.trim();
}

/**
 * Recognise a key written in Camelot (`12A`/`12B`), Open Key (`\d{1,2}[dm]`), or
 * musical (`A`–`G` + accidental + mode) notation. These three forms don't
 * collide. Returns the resolved `CamelotKey`, or null if unrecognised.
 */
export function parseAnyKey(input: string): CamelotKey | null {
  const s = input.trim();
  if (!s) return null;

  // Camelot — number + A/B.
  let m = /^(\d{1,2})\s*([AB])$/i.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return { n, mode: m[2].toUpperCase() as Mode };
  }

  // Open Key — number + d (major) / m (minor).
  m = /^(\d{1,2})\s*([dm])$/i.exec(s);
  if (m) {
    const openN = Number(m[1]);
    if (openN >= 1 && openN <= 12) {
      return { n: ((openN + 6) % 12) + 1, mode: m[2].toLowerCase() === "d" ? "B" : "A" };
    }
  }

  // Musical — note + accidental(s) + optional mode word/suffix.
  const mm = /^([a-g][#b♯♭]*)\s*(.*)$/i.exec(s);
  if (mm) {
    const pc = parsePitchClass(mm[1]);
    if (pc != null) {
      const rest = mm[2].trim().toLowerCase();
      const mode: Mode = rest.startsWith("min") || rest === "m" ? "A" : "B";
      const n = mode === "A" ? minorCamelot[pc] : majorCamelot[pc];
      return { n, mode };
    }
  }

  return null;
}

/** Format a `CamelotKey` in musical notation, e.g. "Db" / "C#m". */
export function toMusical(key: CamelotKey): string {
  return key.mode === "B" ? MAJOR_NOTE[key.n] : `${MINOR_NOTE[key.n]}m`;
}

/** Format a `CamelotKey` in Open Key notation, e.g. "1d" / "8m". */
export function toOpenKey(key: CamelotKey): string {
  const openN = ((key.n - 8 + 12) % 12) + 1;
  return `${openN}${key.mode === "B" ? "d" : "m"}`;
}

/**
 * Render a stored key (in any recognised notation) in the chosen notation.
 * Returns the raw input unchanged when it can't be parsed.
 */
export function displayKey(raw: string | null | undefined, notation: KeyNotation): string {
  if (!raw) return "";
  const key = parseAnyKey(raw);
  if (!key) return raw;
  if (notation === "musical") return toMusical(key);
  if (notation === "openkey") return toOpenKey(key);
  return formatCamelot(key);
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
