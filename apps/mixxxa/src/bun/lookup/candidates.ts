import type { IdentifyCandidate } from "../../shared/types";
import type { AcoustIdResult } from "./acoustid";

// Below this AcoustID score, a candidate isn't shown for review.
const SCORE_FLOOR = 0.5;

/**
 * Flatten AcoustID `results × recordings` into a single deduped, ranked
 * pick-list: sort by score, tiebreak by duration proximity to the track being
 * identified (disambiguates radio edits from extended mixes that both match
 * the fingerprinted first 120s). Candidates below SCORE_FLOOR are dropped;
 * results without a `recordings` array contribute nothing (fingerprint known
 * to AcoustID but unlinked to MusicBrainz).
 */
export function rankCandidates(
  results: AcoustIdResult[],
  trackDurationSec: number | null,
): IdentifyCandidate[] {
  const byRecording = new Map<string, IdentifyCandidate>();

  for (const result of results) {
    if (result.score < SCORE_FLOOR) continue;
    for (const recording of result.recordings ?? []) {
      const existing = byRecording.get(recording.id);
      if (existing && existing.score >= result.score) continue;

      const releasegroup = recording.releasegroups?.[0];
      byRecording.set(recording.id, {
        recordingMbid: recording.id ?? null,
        acoustidTrackId: result.id,
        score: result.score,
        artist: recording.artists?.map((a) => a.name).join(", ") || null,
        title: recording.title ?? null,
        album: releasegroup?.title ?? null,
        durationSec: recording.duration ?? null,
      });
    }
  }

  const candidates = [...byRecording.values()];
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (trackDurationSec == null) return 0;
    const da = a.durationSec != null ? Math.abs(a.durationSec - trackDurationSec) : Infinity;
    const db = b.durationSec != null ? Math.abs(b.durationSec - trackDurationSec) : Infinity;
    return da - db;
  });
  return candidates;
}
