import { MasterDb, isRekordboxRunning } from "rbox-js";
import { existsSync } from "node:fs";
import type {
  RekordboxDiff,
  PlaylistReorderDiff,
  PlaylistRemovalDiff,
  TrackValueChange,
  WriteBackAspects,
  WriteBackSummary,
  WriteBackProgress,
  BackupInfo,
} from "../../shared/types";
import {
  getDb,
  readNonFolderPlaylists,
  readLocalPlaylistOrder,
  readAnalyzedTracks,
  readPendingMetadataTracks,
  clearPendingMetadata,
} from "../db/localDb";
import { getDefaultMasterDbPath, makeSyncError } from "./rekordboxShared";
import {
  getBackupsDir,
  createBackup,
  listBackups,
  restoreBackup,
  pruneBackups,
} from "../rekordboxBackup";
import { loadRekordboxSettings, saveRekordboxSettings } from "../rekordboxSettings";
import { parseAnyKey, formatCamelot } from "../../shared/camelot";
import { bunLog } from "../bunLog";

let dataDir: string;
let sendProgress: ((p: WriteBackProgress) => void) | null = null;

export function initWriteBackHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

/** Wire the writeBackProgress broadcast — call right after defineRPC. */
export function initWriteBack(send: (p: WriteBackProgress) => void): void {
  sendProgress = send;
}

// BPM is considered changed only when the analyzed tempo moves by more than
// 1 BPM — mirrors the `bpmDiffers` heuristic in rowToTrack.
const BPM_EPSILON = 1;

// Canonicalise any key notation (Camelot / Open Key / musical) to Camelot so
// equal keys in different notations don't register as a change.
function canonicalKey(k: string | null | undefined): string {
  if (!k) return "";
  const parsed = parseAnyKey(k);
  return parsed ? formatCamelot(parsed) : k.trim().toLowerCase();
}

/** Open Rekordbox, mapping failures to typed `locked`/`unreadable` errors. */
function openRekordbox(): MasterDb {
  const masterDbPath = getDefaultMasterDbPath();
  if (!existsSync(masterDbPath)) {
    throw makeSyncError("not-found", "Rekordbox master.db not found. Please install and open Rekordbox first.");
  }
  if (isRekordboxRunning()) {
    throw makeSyncError("locked", "Rekordbox is running. Close Rekordbox and try again.");
  }
  try {
    return MasterDb.open();
  } catch {
    throw makeSyncError(
      isRekordboxRunning() ? "locked" : "unreadable",
      isRekordboxRunning()
        ? "Rekordbox is running and has locked its database. Close Rekordbox and try again."
        : "Could not open the Rekordbox database. It may be corrupted or inaccessible.",
    );
  }
}

function computeDiff(rbDb: MasterDb): RekordboxDiff {
  const db = getDb(dataDir);
  const liveById = new Map(rbDb.getContents().map((c) => [c.id, c]));

  // ── Playlist ordering + local-only removals ─────────────────────────────────
  // The local mirror never gains tracks Rekordbox doesn't have — only Remove
  // (ticket #8) can shrink it — so a track-set mismatch always means "removed
  // locally, not yet synced," never "added locally."
  const playlists: PlaylistReorderDiff[] = [];
  const removals: PlaylistRemovalDiff[] = [];
  for (const pl of readNonFolderPlaylists(db)) {
    const localOrder = readLocalPlaylistOrder(db, pl.id);
    let liveOrder: string[];
    try {
      liveOrder = rbDb.getPlaylistSongs(pl.id)
        .slice()
        .sort((a, b) => a.trackNo - b.trackNo)
        .map((s) => s.contentId);
    } catch {
      continue; // playlist failed to load live — skip
    }

    if (localOrder.length !== liveOrder.length) {
      const localSet = new Set(localOrder);
      const removedTracks = liveOrder
        .filter((id) => !localSet.has(id))
        .map((id) => ({ trackId: id, title: liveById.get(id)?.title ?? "—" }));
      if (removedTracks.length > 0) {
        removals.push({ playlistId: pl.id, name: pl.name, removedTracks });
      }
      // Ordering is ambiguous until the removal syncs (or the removed ids are
      // filtered out below) — skip it for this playlist in this diff cycle.
      continue;
    }

    let changedCount = 0;
    for (let i = 0; i < localOrder.length; i++) {
      if (localOrder[i] !== liveOrder[i]) changedCount++;
    }
    if (changedCount > 0) {
      playlists.push({ playlistId: pl.id, name: pl.name, changedCount, orderedTrackIds: localOrder });
    }
  }

  // ── Analyzed BPM / key promotions ────────────────────────────────────────────
  const keyNameById = new Map(rbDb.getKeys().map((k) => [k.id, k.name]));
  const artistNameById = new Map(rbDb.getArtists().map((a) => [a.id, a.name]));
  const albumNameById = new Map(rbDb.getAlbums().map((a) => [a.id, a.name]));

  const trackChanges: TrackValueChange[] = [];
  for (const track of readAnalyzedTracks(db)) {
    const live = liveById.get(track.id);
    if (!live) continue;

    if (track.analyzedBpm != null) {
      const liveBpm = live.bpm != null ? live.bpm / 100 : null;
      if (liveBpm == null || Math.abs(liveBpm - track.analyzedBpm) > BPM_EPSILON) {
        trackChanges.push({
          trackId: track.id,
          title: track.title,
          field: "bpm",
          oldValue: liveBpm != null ? liveBpm.toFixed(1) : "—",
          newValue: track.analyzedBpm.toFixed(1),
        });
      }
    }

    if (track.analyzedKey != null && track.analyzedKey !== "") {
      const liveKey = live.keyId != null ? (keyNameById.get(live.keyId) ?? "") : "";
      if (canonicalKey(liveKey) !== canonicalKey(track.analyzedKey)) {
        trackChanges.push({
          trackId: track.id,
          title: track.title,
          field: "key",
          oldValue: liveKey || "—",
          newValue: track.analyzedKey,
        });
      }
    }
  }

  // ── Pending fingerprint-identification metadata (artist/title/album) ────────
  for (const track of readPendingMetadataTracks(db)) {
    const live = liveById.get(track.id);
    if (!live) continue;

    if (track.pendingArtist != null) {
      const liveArtist = live.artistId != null ? (artistNameById.get(live.artistId) ?? "") : "";
      if (liveArtist !== track.pendingArtist) {
        trackChanges.push({
          trackId: track.id,
          title: track.title,
          field: "artist",
          oldValue: liveArtist || "—",
          newValue: track.pendingArtist,
        });
      }
    }

    if (track.pendingTitle != null) {
      const liveTitle = live.title ?? "";
      if (liveTitle !== track.pendingTitle) {
        trackChanges.push({
          trackId: track.id,
          title: track.title,
          field: "title",
          oldValue: liveTitle || "—",
          newValue: track.pendingTitle,
        });
      }
    }

    if (track.pendingAlbum != null) {
      const liveAlbum = live.albumId != null ? (albumNameById.get(live.albumId) ?? "") : "";
      if (liveAlbum !== track.pendingAlbum) {
        trackChanges.push({
          trackId: track.id,
          title: track.title,
          field: "album",
          oldValue: liveAlbum || "—",
          newValue: track.pendingAlbum,
        });
      }
    }
  }

  return { playlists, removals, trackChanges, localUsn: rbDb.getLocalUsn() };
}

export const writeBackHandlers = {
  getRekordboxSettings: async () => {
    return loadRekordboxSettings(getDb(dataDir));
  },

  setRekordboxSettings: async (patch: Partial<{ maxBackups: number }>) => {
    return saveRekordboxSettings(getDb(dataDir), patch);
  },

  diffRekordbox: async (): Promise<RekordboxDiff> => {
    const rbDb = openRekordbox();
    try {
      return computeDiff(rbDb);
    } catch (err) {
      if ((err as { syncErrorKind?: string }).syncErrorKind) throw err;
      throw makeSyncError("unreadable", `Could not diff the Rekordbox database: ${(err as Error).message}`);
    }
  },

  writeBackToRekordbox: async (
    { confirmedDiff, selectedAspects }: { confirmedDiff: RekordboxDiff; selectedAspects: WriteBackAspects },
  ): Promise<WriteBackSummary> => {
    const rbDb = openRekordbox();

    // Concurrency guard: Rekordbox edited since the diff was computed?
    if (rbDb.getLocalUsn() !== confirmedDiff.localUsn) {
      throw makeSyncError(
        "stale-diff",
        "Rekordbox changed since the diff was computed. Re-run the sync to review the latest changes.",
      );
    }

    const playlists = selectedAspects.ordering ? confirmedDiff.playlists : [];
    const removals = selectedAspects.removals ? confirmedDiff.removals : [];
    const bpmChanges = selectedAspects.bpm
      ? confirmedDiff.trackChanges.filter((c) => c.field === "bpm")
      : [];
    const keyChanges = selectedAspects.key
      ? confirmedDiff.trackChanges.filter((c) => c.field === "key")
      : [];
    const metadataChanges = selectedAspects.metadata
      ? confirmedDiff.trackChanges.filter((c) => c.field === "artist" || c.field === "title" || c.field === "album")
      : [];

    const removalCount = removals.reduce((sum, pl) => sum + pl.removedTracks.length, 0);
    const total = playlists.length + removalCount + bpmChanges.length + keyChanges.length + metadataChanges.length;
    if (total === 0) {
      return { playlistsReordered: 0, tracksRemoved: 0, bpmUpdated: 0, keysUpdated: 0, metadataUpdated: 0 };
    }

    // Show the bar immediately and yield once so the IPC message flushes before
    // the (synchronous, blocking) backup runs.
    sendProgress?.({ phase: "backup", current: 0, total, label: "Creating backup…" });
    await new Promise((r) => setTimeout(r, 0));

    // Mandatory pre-write backup — abort the whole operation if it fails.
    const backupsDir = getBackupsDir(dataDir);
    createBackup(getDefaultMasterDbPath(), backupsDir, "prewrite");
    pruneBackups(backupsDir, loadRekordboxSettings(getDb(dataDir)).maxBackups);

    const summary: WriteBackSummary = { playlistsReordered: 0, tracksRemoved: 0, bpmUpdated: 0, keysUpdated: 0, metadataUpdated: 0 };
    let current = 0;

    try {
      // ── Playlist ordering ──────────────────────────────────────────────────
      for (const pl of playlists) {
        const songs = rbDb.getPlaylistSongs(pl.playlistId);
        const songIdByContent = new Map(songs.map((s) => [s.contentId, s.id]));
        const orderedSongIds = pl.orderedTrackIds
          .map((cid) => songIdByContent.get(cid))
          .filter((id): id is string => id != null);
        if (orderedSongIds.length > 0) {
          rbDb.movePlaylistSongs(orderedSongIds, 1);
          summary.playlistsReordered++;
        }
        current++;
        sendProgress?.({ phase: "ordering", current, total, label: `Reordered ${pl.name}` });
        await new Promise((r) => setTimeout(r, 0));
      }

      // ── Track removals ─────────────────────────────────────────────────────
      for (const pl of removals) {
        const songs = rbDb.getPlaylistSongs(pl.playlistId);
        const songIdByContent = new Map(songs.map((s) => [s.contentId, s.id]));
        for (const removedTrack of pl.removedTracks) {
          const songId = songIdByContent.get(removedTrack.trackId);
          if (songId) {
            rbDb.deletePlaylistSong(songId);
            summary.tracksRemoved++;
          }
          current++;
          sendProgress?.({ phase: "removals", current, total, label: `Removed ${removedTrack.title} · ${pl.name}` });
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // ── BPM ─────────────────────────────────────────────────────────────────
      for (const change of bpmChanges) {
        const content = rbDb.getContentById(change.trackId);
        if (content) {
          content.bpm = Math.round(parseFloat(change.newValue) * 100);
          rbDb.updateContent(content);
          summary.bpmUpdated++;
        }
        current++;
        sendProgress?.({ phase: "bpm", current, total, label: `BPM · ${change.title}` });
        await new Promise((r) => setTimeout(r, 0));
      }

      // ── Key ───────────────────────────────────────────────────────────────────
      for (const change of keyChanges) {
        rbDb.updateContentKey(change.trackId, change.newValue);
        summary.keysUpdated++;
        current++;
        sendProgress?.({ phase: "key", current, total, label: `Key · ${change.title}` });
        await new Promise((r) => setTimeout(r, 0));
      }

      // ── Metadata (artist/title/album, from fingerprint identification) ──────
      for (const change of metadataChanges) {
        if (change.field === "title") {
          const content = rbDb.getContentById(change.trackId);
          if (content) {
            content.title = change.newValue;
            rbDb.updateContent(content);
          }
        } else if (change.field === "artist") {
          rbDb.updateContentArtist(change.trackId, change.newValue);
        } else if (change.field === "album") {
          rbDb.updateContentAlbum(change.trackId, change.newValue);
        }
        summary.metadataUpdated++;
        current++;
        sendProgress?.({ phase: "metadata", current, total, label: `Metadata · ${change.title}` });
        await new Promise((r) => setTimeout(r, 0));
      }

      // Metadata changes always ride to completion together (staged as one
      // reviewed candidate per track) — clear every track's pending fields once
      // the metadata aspect has synced, so the "pending sync" badge clears even
      // for tracks whose staged value already matched Rekordbox.
      if (selectedAspects.metadata) {
        for (const track of readPendingMetadataTracks(getDb(dataDir))) {
          clearPendingMetadata(getDb(dataDir), track.id);
        }
      }
    } catch (err) {
      bunLog("WRITEBACK", `write failed: ${(err as Error).message}`);
      throw makeSyncError(
        "write-failed",
        `Writing to Rekordbox failed partway through: ${(err as Error).message}. A pre-write backup was created — you can restore it from Settings.`,
      );
    }

    bunLog(
      "WRITEBACK",
      `wrote ${summary.playlistsReordered} playlists, ${summary.tracksRemoved} removals, ${summary.bpmUpdated} BPM, ${summary.keysUpdated} keys, ${summary.metadataUpdated} metadata`,
    );
    return summary;
  },

  listRekordboxBackups: async (): Promise<BackupInfo[]> => {
    return listBackups(getBackupsDir(dataDir));
  },

  restoreRekordboxBackup: async ({ filename }: { filename: string }): Promise<void> => {
    if (isRekordboxRunning()) {
      throw makeSyncError("locked", "Rekordbox is running. Close Rekordbox and try again.");
    }
    const masterDbPath = getDefaultMasterDbPath();
    if (!existsSync(masterDbPath)) {
      throw makeSyncError("not-found", "Rekordbox master.db not found.");
    }
    const backupsDir = getBackupsDir(dataDir);
    // Safety backup of the current state so the restore itself is reversible.
    createBackup(masterDbPath, backupsDir, "prerestore");
    restoreBackup(backupsDir, filename, masterDbPath);
    pruneBackups(backupsDir, loadRekordboxSettings(getDb(dataDir)).maxBackups);
    bunLog("WRITEBACK", `restored backup ${filename}`);
  },
};
