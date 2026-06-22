import type { RPCSchema } from "electrobun/bun";

export interface PlaylistNode {
  id: string;
  name: string;
  isFolder: boolean;
  children: PlaylistNode[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  bpm: number | null;
  key: string;
  length: number | null;
  bitrate: number | null;
  analyzedBitrate: number | null;
  rating: number | null;
  filePath: string | null;
  // Analyzed values (null = not yet analyzed)
  analyzedBpm: number | null;
  analyzedKey: string | null;
  analyzedEnergy: number | null;
  analyzedLoudnessDb: number | null;
  analyzedDynamicRangeDb: number | null;
  analyzedDanceability: number | null;
  fingerprint: string | null;
  analysisStatus: "done" | "failed" | null;
  // Diff flags
  bpmDiffers: boolean;
  keyDiffers: boolean;
}

export type SyncErrorKind =
  | "not-found"
  | "unreadable"
  | "locked"
  | "write-failed"
  | "backup-failed"
  | "stale-diff";

// ── Rekordbox write-back types ────────────────────────────────────────────────

export interface PlaylistReorderDiff {
  playlistId: string;
  name: string;
  changedCount: number;
  // Local desired order, expressed as content ids — lets write-back apply the
  // ordering without re-deriving it.
  orderedTrackIds: string[];
}

export interface TrackValueChange {
  trackId: string;
  title: string;
  field: "bpm" | "key";
  oldValue: string; // current Rekordbox value (for display)
  newValue: string; // analyzed value to write (for display)
}

export interface RekordboxDiff {
  playlists: PlaylistReorderDiff[];
  trackChanges: TrackValueChange[];
  // Rekordbox local update sequence number captured at diff time — re-checked
  // before write to detect concurrent Rekordbox edits.
  localUsn: number;
}

// Which changed aspects the user chose to push. All true by default.
export interface WriteBackAspects {
  ordering: boolean;
  bpm: boolean;
  key: boolean;
}

export interface WriteBackSummary {
  playlistsReordered: number;
  bpmUpdated: number;
  keysUpdated: number;
}

export interface WriteBackProgress {
  phase: "backup" | "ordering" | "bpm" | "key";
  current: number;
  total: number;
  label: string;
}

export type BackupOrigin = "prewrite" | "prerestore" | "manual";

export interface BackupInfo {
  filename: string;
  createdAt: number; // epoch ms
  sizeBytes: number;
  origin: BackupOrigin;
}

export interface RekordboxSyncSettings {
  maxBackups: number;
}

// ── Waveform types ────────────────────────────────────────────────────────────

export interface CueMarker {
  id: string;
  positionSec: number;
  endSec: number | null;   // loop out point; stored, not rendered in v1
  kind: number;            // 0 = memory cue, 1-8 = hot cue A-H
  color: string | null;    // "#RRGGBB" or null (UI applies defaults)
  comment: string | null;
}

export interface WaveformData {
  peaks: number[] | null;
  duration: number | null;
  bpm: number | null;
  firstBeatSec: number;
  cues: CueMarker[];
}

// ── Analysis types ────────────────────────────────────────────────────────────

export type AnalysisAspect = "key" | "bpm" | "bitrate" | "energy" | "loudness" | "dynamics" | "danceability";

export type AnalysisEngine = "essentia" | "orbit";

// How keys are displayed throughout the UI. Stored values are always Camelot;
// this only affects rendering.
export type KeyNotation = "camelot" | "musical" | "openkey";

export interface AnalysisSettings {
  parallelism: number;
  aspects: AnalysisAspect[];
  engine: AnalysisEngine;
  maxLogFiles: number;
  keyNotation: KeyNotation;
}

export type AnalysisPhase =
  | "decoding"
  | "key"
  | "bpm"
  | "bitrate"
  | "orbit"
  | "persisting";

export type QueueItemStatus = "queued" | "running" | "done" | "failed" | "canceled";

export interface QueueItemTimings {
  timeDecodeMs?: number;
  timeKeyMs?: number;
  timeBpmMs?: number;
  timeBitrateMs?: number;
  timeOrbitMs?: number;
  timeTotalMs?: number;
}

export interface QueueItem extends QueueItemTimings {
  id: string;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  aspects: AnalysisAspect[];
  status: QueueItemStatus;
  phase: AnalysisPhase | null;
  progress: number;
  error: string | null;
}

export interface HistoryEntry extends QueueItemTimings {
  id: string;
  trackId: string;
  aspects: string[];
  status: string;
  finishedAt: number;
}

// ── Auto-cue types ────────────────────────────────────────────────────────────

export interface AutoCueRule {
  bpmMin: number;
  bpmMax: number;
  beatsBefore: number;
}

export interface AutoCueSettings {
  rules: AutoCueRule[];
  fallbackBeatsBefore: number;
  confidenceThreshold: number;
}

export interface DropMarker {
  time: number;       // seconds
  confidence: number; // 0..1
}

export interface DropsResult {
  drops: DropMarker[];
  bpm?: number;
  firstBeatSec?: number;
  duration?: number;
}

export interface AutoCueResult {
  cues: CueMarker[];     // full cue list for the track after insertion
  dropsDetected: number; // drops above threshold
  dropsUsed: number;     // drops that got cues (after dedupe + capacity cap)
  undoAvailable: boolean;
  computedBpm?: number;  // set when the sidecar had to detect BPM
}

export interface AutoCueProgress {
  trackId: string;
  step: string; // candidates | features | classify | bpm
  pct: number;  // 0..1
}

// ── RPC ───────────────────────────────────────────────────────────────────────

export type MixxxRPC = {
  bun: RPCSchema<{
    requests: {
      openXmlFile: { params: undefined; response: string | null };
      syncFromRekordbox: { params: undefined; response: PlaylistNode[] };
      getPlaylistTree: { params: undefined; response: PlaylistNode[] };
      getPlaylistTracks: { params: { playlistId: string }; response: Track[] };
      getAllTracks: { params: undefined; response: Track[] };
      reorderPlaylistTracks: { params: { playlistId: string; orderedTrackIds: string[] }; response: Track[] };
      getTrackAudioUrl: { params: { trackId: string }; response: string | null };
      // Waveform
      getWaveformData: { params: { trackId: string }; response: WaveformData | null };
      saveWaveformPeaks: { params: { trackId: string; peaks: number[]; duration: number }; response: void };
      // Analysis — queue management
      enqueueTrack: { params: { trackId: string }; response: void };
      enqueuePlaylist: { params: { playlistId: string }; response: void };
      getAnalysisQueue: { params: undefined; response: QueueItem[] };
      pauseAnalysis: { params: undefined; response: void };
      resumeAnalysis: { params: undefined; response: void };
      cancelAnalysis: { params: undefined; response: void };
      removeQueueItem: { params: { itemId: string }; response: void };
      moveQueueItem: { params: { itemId: string; direction: "up" | "down" }; response: void };
      // Analysis — settings
      getAnalysisSettings: { params: undefined; response: AnalysisSettings };
      setAnalysisSettings: { params: Partial<AnalysisSettings>; response: AnalysisSettings };
      // Rekordbox write-back + backups
      getRekordboxSettings: { params: undefined; response: RekordboxSyncSettings };
      setRekordboxSettings: { params: Partial<RekordboxSyncSettings>; response: RekordboxSyncSettings };
      diffRekordbox: { params: undefined; response: RekordboxDiff };
      writeBackToRekordbox: { params: { confirmedDiff: RekordboxDiff; selectedAspects: WriteBackAspects }; response: WriteBackSummary };
      listRekordboxBackups: { params: undefined; response: BackupInfo[] };
      restoreRekordboxBackup: { params: { filename: string }; response: void };
      // Analysis — history
      getAnalysisHistory: { params: undefined; response: HistoryEntry[] };
      pruneAnalysisHistory: { params: undefined; response: void };
      // Analysis — worker pool (renderer → bun)
      claimAnalysisWork: { params: undefined; response: ClaimResponse | null };
      reportAnalysisProgress: { params: ProgressReport; response: void };
      reportAnalysisResult: { params: AnalysisResult; response: void };
      // Cues — auto cue insertion + manual hot-cue editing
      getAutoCueSettings: { params: undefined; response: AutoCueSettings };
      setAutoCueSettings: { params: Partial<AutoCueSettings>; response: AutoCueSettings };
      autoCueTrack: { params: { trackId: string }; response: AutoCueResult };
      undoAutoCue: { params: { trackId: string }; response: CueMarker[] };
      setHotCue: { params: { trackId: string; slot: number; positionSec: number }; response: CueMarker[] };
      deleteHotCue: { params: { trackId: string; slot: number }; response: CueMarker[] };
    };
    messages: {
      analysisQueueUpdate: { queue: QueueItem[] };
      autoCueProgress: AutoCueProgress;
      writeBackProgress: WriteBackProgress;
    };
  }>;
  webview: RPCSchema<{ requests: {}; messages: {} }>;
};

export interface ClaimResponse {
  itemId: string;
  trackId: string;
  filePath: string;
  pcmUrl: string;
  aspects: AnalysisAspect[];
}

export interface ProgressReport {
  itemId: string;
  phase: AnalysisPhase;
  progress: number;
  timings?: Partial<QueueItemTimings>;
}

export interface AnalysisResult {
  itemId: string;
  success: boolean;
  error?: string;
  analyzedBpm?: number;
  analyzedKey?: string;
  analyzedFirstBeatSec?: number;
  timings: QueueItemTimings;
}
