import { randomUUID } from "node:crypto";
import type { Database } from "bun:sqlite";
import type {
  QueueItem,
  AnalysisSettings,
  ClaimResponse,
  ProgressReport,
  AnalysisResult,
  QueueItemTimings,
} from "../../shared/types";
import { AnalysisQueueStore } from "./queue";
import { decodeAudio } from "./decoder";
import { analyzeBitrate } from "./bitrate";
import { loadSettings, saveSettings } from "./settings";
import {
  writeAnalyzedValues,
  writeAnalyzedBitrate,
  appendAnalysisHistory,
  readAnalysisHistory,
  pruneAnalysisHistory,
  readPlaylistTracks,
} from "../db/localDb";
import { getAudioServerPort } from "../audioServer";

// PCM blobs stored in memory, keyed by itemId, freed after claim is fulfilled
const pcmCache = new Map<string, ArrayBuffer>();

// Throttled queue push (max 4/sec)
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushFn: ((items: QueueItem[]) => void) | null = null;

function schedulePush(store: AnalysisQueueStore): void {
  if (!pushFn || pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushFn!(store.getAll());
  }, 250);
}

// Pause state
let paused = false;

// Active analysis state tracks whether a cancel was requested for in-flight items
const canceledItems = new Set<string>();

export function initAnalysis(
  db: Database,
  onQueueUpdate: (items: QueueItem[]) => void,
): void {
  pushFn = onQueueUpdate;
  const store = new AnalysisQueueStore(db);
  // On startup, reset any persisted running items back to queued (task 4.7)
  store.resetRunningToQueued();
  schedulePush(store);
}

export function getQueue(db: Database): QueueItem[] {
  return new AnalysisQueueStore(db).getAll();
}

export function enqueueTrack(
  db: Database,
  trackId: string,
  settings: AnalysisSettings,
): void {
  const store = new AnalysisQueueStore(db);
  if (store.isAlreadyQueued(trackId)) return;
  store.add({ id: randomUUID(), trackId, aspects: settings.aspects });
  schedulePush(store);
}

export function enqueuePlaylist(
  db: Database,
  playlistId: string,
  settings: AnalysisSettings,
): void {
  const store = new AnalysisQueueStore(db);
  const tracks = readPlaylistTracks(db, playlistId);
  for (const track of tracks) {
    if (!store.isAlreadyQueued(track.id)) {
      store.add({ id: randomUUID(), trackId: track.id, aspects: settings.aspects });
    }
  }
  schedulePush(store);
}

export function pauseAnalysis(): void {
  paused = true;
}

export function resumeAnalysis(db: Database): void {
  paused = false;
  schedulePush(new AnalysisQueueStore(db));
}

export function cancelAnalysis(db: Database): void {
  const store = new AnalysisQueueStore(db);
  // Mark all running items as canceled so their results are discarded
  const running = store.getAll().filter((i) => i.status === "running");
  for (const item of running) canceledItems.add(item.id);
  store.cancelAll();
  schedulePush(store);
}

export function removeQueueItem(db: Database, itemId: string): void {
  const store = new AnalysisQueueStore(db);
  store.remove(itemId);
  schedulePush(store);
}

export function moveQueueItem(db: Database, itemId: string, direction: "up" | "down"): void {
  const store = new AnalysisQueueStore(db);
  if (direction === "up") store.moveUp(itemId);
  else store.moveDown(itemId);
  schedulePush(store);
}

export function getAnalysisSettings(db: Database): AnalysisSettings {
  return loadSettings(db);
}

export function setAnalysisSettings(db: Database, patch: Partial<AnalysisSettings>): AnalysisSettings {
  return saveSettings(db, patch);
}

export function getHistory(db: Database) {
  return readAnalysisHistory(db);
}

export function pruneHistory(db: Database): void {
  pruneAnalysisHistory(db);
}

/**
 * Called by renderer workers to claim the next item to analyze.
 * Bitrate is handled here in Bun via ffprobe; remaining aspects are decoded
 * and served to the renderer worker as PCM.
 */
export async function claimWork(db: Database): Promise<ClaimResponse | null> {
  if (paused) return null;

  const store = new AnalysisQueueStore(db);
  const queued = store.getQueued();
  if (queued.length === 0) return null;

  const row = queued[0];
  const allAspects = JSON.parse(row.aspects) as ClaimResponse["aspects"];

  store.setStatus(row.id, "running");
  schedulePush(store);

  // Look up file path
  const fileRow = db.query<{ file_path: string | null }, [string]>(
    "SELECT file_path FROM content WHERE id = ?"
  ).get(row.track_id);

  if (!fileRow?.file_path) {
    store.setStatus(row.id, "failed", "Track file path not found");
    schedulePush(store);
    return null;
  }

  // Handle bitrate in Bun directly via ffprobe (bypasses renderer PCM path)
  let timeBitrateMs: number | undefined;
  if (allAspects.includes("bitrate")) {
    store.setPhaseProgress(row.id, "bitrate", 0);
    schedulePush(store);

    const t0 = Date.now();
    const result = await analyzeBitrate(fileRow.file_path);
    timeBitrateMs = Date.now() - t0;

    if (result.ok) {
      writeAnalyzedBitrate(db, row.track_id, result.bitrate, timeBitrateMs);
    }
    store.setPhaseProgress(row.id, "bitrate", 1, { timeBitrateMs });
    schedulePush(store);
  }

  // If bitrate was the only requested aspect, complete here without a renderer claim
  const rendererAspects = allAspects.filter((a) => a !== "bitrate");
  if (rendererAspects.length === 0) {
    store.setStatus(row.id, "done");
    appendAnalysisHistory(db, {
      id: randomUUID(),
      trackId: row.track_id,
      aspects: allAspects,
      status: "done",
      timeBitrateMs,
    });
    schedulePush(store);
    return null;
  }

  try {
    const decoded = await decodeAudio(fileRow.file_path, 44100);
    pcmCache.set(row.id, decoded.buffer);
  } catch (err) {
    store.setStatus(row.id, "failed", String(err));
    schedulePush(store);
    return null;
  }

  const port = getAudioServerPort();
  return {
    itemId: row.id,
    trackId: row.track_id,
    filePath: fileRow.file_path,
    pcmUrl: `http://127.0.0.1:${port}/pcm/${row.id}`,
    aspects: rendererAspects,
  };
}

/** Renderer worker reports phase/progress during analysis */
export function reportProgress(db: Database, report: ProgressReport): void {
  if (canceledItems.has(report.itemId)) return;
  const store = new AnalysisQueueStore(db);
  store.setPhaseProgress(report.itemId, report.phase, report.progress, report.timings as QueueItemTimings);
  schedulePush(store);
}

/** Renderer worker reports final result */
export function reportResult(db: Database, result: AnalysisResult): void {
  // Free PCM buffer regardless
  pcmCache.delete(result.itemId);

  if (canceledItems.has(result.itemId)) {
    canceledItems.delete(result.itemId);
    return;
  }

  const store = new AnalysisQueueStore(db);
  const row = store.getItem(result.itemId);
  if (!row) return;

  if (result.success) {
    writeAnalyzedValues(db, row.track_id, {
      analyzedBpm: result.analyzedBpm ?? null,
      analyzedKey: result.analyzedKey ?? null,
      analysisStatus: "done",
      ...result.timings,
    });
    store.setStatus(result.itemId, "done");
  } else {
    writeAnalyzedValues(db, row.track_id, {
      analysisStatus: "failed",
    });
    store.setStatus(result.itemId, "failed", result.error);
  }

  appendAnalysisHistory(db, {
    id: randomUUID(),
    trackId: row.track_id,
    aspects: JSON.parse(row.aspects),
    status: result.success ? "done" : "failed",
    ...result.timings,
    timeBitrateMs: row.time_bitrate_ms ?? undefined,
  });

  schedulePush(store);
}

/** Called by the audio server to serve PCM blobs to renderer workers */
export function getPcmBuffer(itemId: string): ArrayBuffer | null {
  return pcmCache.get(itemId) ?? null;
}
