import type { AutoCueSettings, DropMarker } from "../../shared/types";
import { slotColor } from "../../shared/cueColors";

// Pure auto-cue planning — no IO, unit-testable.

export interface PlannedCue {
  slot: number; // hot-cue slot 1-8 (A-H)
  positionSec: number;
  color: string | null;
  comment: string;
}

const MAX_DROPS = 4; // 8 slots ÷ 2 cues per drop
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
 * Plan lead-in + drop hot cues for the detected drops:
 *  1. snap each drop to the beatgrid,
 *  2. dedupe drops snapping within 8 beats (keep higher confidence),
 *  3. cap at 4 drops by confidence, order survivors by time,
 *  4. assign slots in time order (drop i → lead-in 2i+1, drop 2i+2); the
 *     lead-in beat clamps to ≥ 0 and is skipped when it collides with the drop.
 */
export function planAutoCues(
  drops: DropMarker[],
  bpm: number,
  firstBeatSec: number,
  settings: AutoCueSettings,
): PlannedCue[] {
  if (!Number.isFinite(bpm) || bpm <= 0 || drops.length === 0) return [];
  const spb = 60 / bpm;
  const beatsBefore = matchBeatsBefore(bpm, settings);

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

  const kept = deduped.slice(0, MAX_DROPS).sort((a, b) => a.beat - b.beat);

  const cues: PlannedCue[] = [];
  kept.forEach((drop, i) => {
    const leadSlot = 2 * i + 1;
    const dropSlot = 2 * i + 2;
    const leadBeat = Math.max(0, drop.beat - beatsBefore);
    if (leadBeat !== drop.beat) {
      cues.push({
        slot: leadSlot,
        positionSec: firstBeatSec + leadBeat * spb,
        color: slotColor(leadSlot),
        comment: `Auto: ${beatsBefore} beats before drop`,
      });
    }
    cues.push({
      slot: dropSlot,
      positionSec: firstBeatSec + drop.beat * spb,
      color: slotColor(dropSlot),
      comment: `Auto: drop (${Math.round(drop.confidence * 100)}%)`,
    });
  });
  return cues;
}
