import type { IdentifyCandidate, IdentifyLookupResult, IdentifyProgress, Track } from "../../shared/types";
import {
  getDb,
  readMetadataLookupInputs,
  readTrack,
  writeFingerprint,
  writePendingMetadata,
  clearPendingMetadata,
  insertMetadataProvenance,
} from "../db/localDb";
import { decodeAudio } from "../analysis/decoder";
import { computeFingerprint } from "../analysis/fingerprint";
import { readContainerDurationSec } from "../analysis/duration";
import { lookupFingerprint } from "../lookup/acoustid";
import { rankCandidates } from "../lookup/candidates";
import { bunLog } from "../bunLog";
import { resolveTrackFile } from "../paths/resolveTrackFile";
import { trackFileErrorMessage } from "../../shared/trackPath";

let dataDir: string;
let sendProgress: ((p: IdentifyProgress) => void) | null = null;

export function initIdentifyHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

/** Wire the identifyProgress broadcast — call right after defineRPC. */
export function initIdentify(send: (p: IdentifyProgress) => void): void {
  sendProgress = send;
}

export const identifyHandlers = {
  identifyTrack: async ({ trackId }: { trackId: string }): Promise<IdentifyLookupResult> => {
    const db = getDb(dataDir);
    const inputs = readMetadataLookupInputs(db, trackId);
    if (!inputs) throw new Error("Track not found");
    const resolution = resolveTrackFile(db, inputs.filePath);
    if (!resolution.ok) throw new Error(trackFileErrorMessage(resolution.reason, resolution.detail));
    const resolvedPath = resolution.path;

    let fingerprint = inputs.fingerprint;
    if (!fingerprint) {
      sendProgress?.({ trackId, phase: "fingerprint" });
      const decoded = await decodeAudio(resolvedPath, 44100, 120);
      const computed = await computeFingerprint(decoded.buffer, decoded.sampleRate);
      writeFingerprint(db, trackId, computed.fingerprint, computed.ms);
      fingerprint = computed.fingerprint;
    }

    let durationSec = inputs.waveformDuration;
    if (durationSec == null) {
      sendProgress?.({ trackId, phase: "duration" });
      durationSec = await readContainerDurationSec(resolvedPath);
    }
    if (durationSec == null) throw new Error("Could not determine the track's duration");

    sendProgress?.({ trackId, phase: "lookup" });
    const results = await lookupFingerprint(fingerprint, durationSec);
    const candidates = rankCandidates(results, durationSec);
    bunLog("IDENTIFY", `${trackId}: ${results.length} result(s) → ${candidates.length} candidate(s)`);
    return { candidates };
  },

  applyIdentifiedMetadata: async (
    { trackId, candidate }: { trackId: string; candidate: IdentifyCandidate },
  ): Promise<Track> => {
    const db = getDb(dataDir);
    const track = readTrack(db, trackId);
    if (!track) throw new Error("Track not found");

    writePendingMetadata(db, trackId, {
      artist: candidate.artist,
      title: candidate.title,
      album: candidate.album,
    });
    insertMetadataProvenance(db, {
      contentId: trackId,
      recordingMbid: candidate.recordingMbid,
      acoustidTrackId: candidate.acoustidTrackId,
      score: candidate.score,
      originalArtist: track.artist,
      originalTitle: track.title,
      originalAlbum: track.album,
    });
    bunLog("IDENTIFY", `applied ${candidate.acoustidTrackId} (score ${candidate.score.toFixed(2)}) to ${trackId}`);

    return readTrack(db, trackId)!;
  },

  discardIdentifiedMetadata: async ({ trackId }: { trackId: string }): Promise<Track> => {
    const db = getDb(dataDir);
    clearPendingMetadata(db, trackId);
    const track = readTrack(db, trackId);
    if (!track) throw new Error("Track not found");
    return track;
  },
};
