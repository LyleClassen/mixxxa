import type { AutoCueSettings, DropMarker } from "../../shared/types";
import { slotColor } from "../../shared/cueColors";

// Pure auto-cue planning — no IO, unit-testable.

export interface PlannedCue {
  slot: number; // hot-cue slot 1-8 (A-H)
  positionSec: number;
  color: string | null;
  comment: string;
}

const MAX_SLOTS = 8; // hot-cue slots A-H
const DEDUPE_BEATS = 8;

/**
 * Beats of lead-in for a track at `bpm`: exact band match, then half/double-time
 * match (a band hit at bpm×2 halves the beat count, at bpm÷2 doubles it — so an
 * 87-tagged DnB track gets the same wall-clock lead-in as a 174 one), then the
 * fallback.
 */
export function matchBeatsBefore(bpm: number, settings: AutoCueSettings): number {
  const find = (b: number) => settings.rules.find((r) => b >= r.bpmMin && b <= r.bpmMax);
  const exact = find(bpm);
  if (exact) return exact.beatsBefore;
  const doubled = find(bpm * 2);
  if (doubled) return Math.round(doubled.beatsBefore / 2);
  const halved = find(bpm / 2);
  if (halved) return halved.beatsBefore * 2;
  return settings.fallbackBeatsBefore;
}

/**
 * Plan start + lead-in + drop + end hot cues:
 *  1. reserve a slot each for the optional start/end cues; the remaining slots
 *     (2 per drop) cap how many drops are used,
 *  2. snap each drop to the beatgrid,
 *  3. dedupe drops snapping within 8 beats (keep higher confidence),
 *  4. cap by confidence, then assemble every cue, sort by position, and assign
 *     slots A-H in time order. The lead-in beat clamps to ≥ 0 and is skipped
 *     when it collides with the drop.
 */
export function planAutoCues(
  drops: DropMarker[],
  bpm: number,
  firstBeatSec: number,
  settings: AutoCueSettings,
  durationSec?: number,
): PlannedCue[] {
  if (!Number.isFinite(bpm) || bpm <= 0) return [];
  const spb = 60 / bpm;
  const beatsBefore = matchBeatsBefore(bpm, settings);

  const wantEnd =
    settings.addEndCue && durationSec != null && Number.isFinite(durationSec) && durationSec > 0;
  const startCount = settings.addStartCue ? 1 : 0;
  const endCount = wantEnd ? 1 : 0;
  const maxDrops = Math.max(0, Math.floor((MAX_SLOTS - startCount - endCount) / 2));

  const snapped = drops.map((d) => ({
    beat: Math.max(0, Math.round((d.time - firstBeatSec) / spb)),
    confidence: d.confidence,
  }));

  snapped.sort((a, b) => b.confidence - a.confidence);
  const deduped: typeof snapped = [];
  for (const s of snapped) {
    if (deduped.some((kept) => Math.abs(kept.beat - s.beat) < DEDUPE_BEATS)) continue;
    deduped.push(s);
  }

  const kept = deduped.slice(0, maxDrops).sort((a, b) => a.beat - b.beat);

  // Assemble all cues without slots/colors yet, then assign them in time order.
  // The start cue sits at the very beginning of the track (0s), not the first beat.
  const entries: { positionSec: number; comment: string }[] = [];

  if (settings.addStartCue) {
    entries.push({ positionSec: 0, comment: "Auto: track start" });
  }

  for (const drop of kept) {
    const leadBeat = Math.max(0, drop.beat - beatsBefore);
    if (leadBeat !== drop.beat) {
      entries.push({
        positionSec: firstBeatSec + leadBeat * spb,
        comment: `Auto: ${beatsBefore} beats before drop`,
      });
    }
    entries.push({
      positionSec: firstBeatSec + drop.beat * spb,
      comment: `Auto: drop (${Math.round(drop.confidence * 100)}%)`,
    });
  }

  if (wantEnd) {
    const endBeat = Math.round((durationSec! - firstBeatSec) / spb);
    const targetBeat = Math.max(0, endBeat - settings.beatsBeforeEnd);
    entries.push({
      positionSec: firstBeatSec + targetBeat * spb,
      comment: `Auto: ${settings.beatsBeforeEnd} beats before end`,
    });
  }

  return entries
    .sort((a, b) => a.positionSec - b.positionSec)
    .slice(0, MAX_SLOTS)
    .map((e, i) => {
      const slot = i + 1;
      return { slot, positionSec: e.positionSec, color: slotColor(slot), comment: e.comment };
    });
}
