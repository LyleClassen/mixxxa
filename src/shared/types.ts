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
  analysisStatus: "done" | "failed" | null;
  // Diff flags
  bpmDiffers: boolean;
  keyDiffers: boolean;
}

export type SyncErrorKind = "not-found" | "unreadable";

// ── Analysis types ────────────────────────────────────────────────────────────

export type AnalysisAspect = "key" | "bpm" | "bitrate" | "energy" | "loudness" | "dynamics" | "danceability";

export type AnalysisEngine = "essentia" | "orbit";

export interface AnalysisSettings {
  parallelism: number;
  aspects: AnalysisAspect[];
  engine: AnalysisEngine;
  maxLogFiles: number;
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
      // Analysis — history
      getAnalysisHistory: { params: undefined; response: HistoryEntry[] };
      pruneAnalysisHistory: { params: undefined; response: void };
      // Analysis — worker pool (renderer → bun)
      claimAnalysisWork: { params: undefined; response: ClaimResponse | null };
      reportAnalysisProgress: { params: ProgressReport; response: void };
      reportAnalysisResult: { params: AnalysisResult; response: void };
    };
    messages: {
      analysisQueueUpdate: { queue: QueueItem[] };
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
  timings: QueueItemTimings;
}
