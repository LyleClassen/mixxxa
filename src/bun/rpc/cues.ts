import type {
  AutoCueProgress,
  AutoCueResult,
  AutoCueSettings,
  CueMarker,
} from "../../shared/types";
import {
  getDb,
  readTrackCues,
  readTrackCueRows,
  upsertHotCue,
  deleteHotCue,
  replaceTrackCueRows,
  type CueRow,
} from "../db/localDb";
import { loadAutoCueSettings, saveAutoCueSettings } from "../cues/settings";
import { planAutoCues } from "../cues/autoCue";
import { detectDrops } from "../analysis/sidecar";
import { slotColor } from "../../shared/cueColors";
import { bunLog } from "../bunLog";

let dataDir: string;
let sendProgress: ((p: AutoCueProgress) => void) | null = null;

export function initCueHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

/** Wire the autoCueProgress broadcast — call right after defineRPC. */
export function initCues(send: (p: AutoCueProgress) => void): void {
  sendProgress = send;
}

// Session-scoped undo: full prior cue rows per track, kept in memory only
// (accepted tradeoff — undo survives until the app restarts).
const undoSnapshots = new Map<string, CueRow[]>();

export const cuesHandlers = {
  getAutoCueSettings: async (): Promise<AutoCueSettings> => {
    return loadAutoCueSettings(getDb(dataDir));
  },

  setAutoCueSettings: async (patch: Partial<AutoCueSettings>): Promise<AutoCueSettings> => {
    return saveAutoCueSettings(getDb(dataDir), patch);
  },

  autoCueTrack: async ({ trackId }: { trackId: string }): Promise<AutoCueResult> => {
    const db = getDb(dataDir);
    const row = db.query<
      { file_path: string | null; bpm: number | null; analyzed_bpm: number | null; analyzed_first_beat_sec: number | null },
      [string]
    >(
      "SELECT file_path, bpm, analyzed_bpm, analyzed_first_beat_sec FROM content WHERE id = ?"
    ).get(trackId);
    if (!row?.file_path) throw new Error("Track has no audio file path");

    const settings = loadAutoCueSettings(db);
    const needBpm = row.analyzed_bpm == null || row.analyzed_first_beat_sec == null;

    const result = await detectDrops(
      row.file_path,
      { threshold: settings.confidenceThreshold, needBpm },
      (step, pct) => sendProgress?.({ trackId, step, pct }),
    );

    // BPM fallback chain: analyzed → sidecar-computed → Rekordbox bpm (no
    // beatgrid, assume first beat at 0) → error.
    let bpm = row.analyzed_bpm;
    let firstBeatSec = row.analyzed_first_beat_sec;
    let computedBpm: number | undefined;
    if (bpm == null || firstBeatSec == null) {
      if (result.bpm != null && result.bpm > 0) {
        bpm = bpm ?? result.bpm;
        firstBeatSec = firstBeatSec ?? result.firstBeatSec ?? 0;
        computedBpm = result.bpm;
        // Persist the gap-filling values so the waveform beatgrid and future
        // runs see them (COALESCE keeps any analyzed value that exists).
        db.run(
          "UPDATE content SET analyzed_bpm = COALESCE(analyzed_bpm, ?), analyzed_first_beat_sec = COALESCE(analyzed_first_beat_sec, ?) WHERE id = ?",
          [result.bpm, result.firstBeatSec ?? 0, trackId],
        );
      } else if (row.bpm != null && row.bpm > 0) {
        bpm = bpm ?? row.bpm / 100;
        firstBeatSec = firstBeatSec ?? 0;
      } else {
        throw new Error("No BPM available for this track — analyze it first");
      }
    }

    const planned = planAutoCues(result.drops, bpm, firstBeatSec, settings);
    bunLog("CUES", `autoCue ${trackId}: ${result.drops.length} drops → ${planned.length} cues (bpm=${bpm.toFixed(1)})`);

    let undoAvailable = false;
    if (planned.length > 0) {
      undoSnapshots.set(trackId, readTrackCueRows(db, trackId));
      undoAvailable = true;
      const tx = db.transaction(() => {
        for (const cue of planned) {
          upsertHotCue(db, trackId, cue.slot, cue.positionSec, cue.color, cue.comment);
        }
      });
      tx();
    }

    return {
      cues: readTrackCues(db, trackId),
      dropsDetected: result.drops.length,
      dropsUsed: planned.filter((c) => c.slot % 2 === 0).length,
      undoAvailable,
      computedBpm,
    };
  },

  undoAutoCue: async ({ trackId }: { trackId: string }): Promise<CueMarker[]> => {
    const db = getDb(dataDir);
    const snapshot = undoSnapshots.get(trackId);
    if (snapshot) {
      replaceTrackCueRows(db, trackId, snapshot);
      undoSnapshots.delete(trackId);
    }
    return readTrackCues(db, trackId);
  },

  setHotCue: async ({ trackId, slot, positionSec }: { trackId: string; slot: number; positionSec: number }): Promise<CueMarker[]> => {
    const db = getDb(dataDir);
    upsertHotCue(db, trackId, slot, positionSec, slotColor(slot), null);
    return readTrackCues(db, trackId);
  },

  deleteHotCue: async ({ trackId, slot }: { trackId: string; slot: number }): Promise<CueMarker[]> => {
    const db = getDb(dataDir);
    deleteHotCue(db, trackId, slot);
    return readTrackCues(db, trackId);
  },
};
