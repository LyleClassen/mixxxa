import { MasterDb, isRekordboxRunning } from "rbox-js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { PlaylistNode, Track, SyncErrorKind } from "../../shared/types";
import { getDb, replaceLibrary, readPlaylistTree, readPlaylistTracks } from "../db/localDb";
import { getAudioServerPort } from "../audioServer";

let dataDir: string;

export function initRekordboxHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

function getDefaultMasterDbPath(): string {
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appdata, "Pioneer", "rekordbox", "master.db");
  }
  return join(homedir(), "Library", "Pioneer", "rekordbox", "master.db");
}

function makeSyncError(kind: SyncErrorKind, message: string): Error {
  const err = new Error(message);
  (err as Error & { syncErrorKind: SyncErrorKind }).syncErrorKind = kind;
  return err;
}

export const rekordboxHandlers = {
  syncFromRekordbox: async (): Promise<PlaylistNode[]> => {
    const masterDbPath = getDefaultMasterDbPath();

    if (!existsSync(masterDbPath)) {
      throw makeSyncError("not-found", "Rekordbox master.db not found. Please install and open Rekordbox first.");
    }

    let rbDb: MasterDb;
    try {
      rbDb = MasterDb.open();
    } catch {
      const locked = isRekordboxRunning();
      throw makeSyncError(
        "unreadable",
        locked
          ? "Rekordbox is running and has locked its database. Close Rekordbox and try again."
          : "Could not open the Rekordbox database. It may be corrupted or inaccessible."
      );
    }

    let playlists: ReturnType<MasterDb["getPlaylists"]>;
    let contents: ReturnType<MasterDb["getContents"]>;
    let artists: ReturnType<MasterDb["getArtists"]>;
    let keys: ReturnType<MasterDb["getKeys"]>;

    try {
      playlists = rbDb.getPlaylists();
      contents = rbDb.getContents();
      artists = rbDb.getArtists();
      keys = rbDb.getKeys();
    } catch {
      const locked = isRekordboxRunning();
      throw makeSyncError(
        "unreadable",
        locked
          ? "Rekordbox is running and has locked its database. Close Rekordbox and try again."
          : "Could not read the Rekordbox database. It may be corrupted or inaccessible."
      );
    }

    // Collect all playlist songs across all playlists (only non-folder playlists)
    const allPlaylistSongs: Array<{ id: string; playlist_id: string; content_id: string; seq: number }> = [];
    for (const playlist of playlists) {
      if (playlist.attribute === 0 || playlist.attribute === 4) {
        try {
          const songs = rbDb.getPlaylistSongs(playlist.id);
          for (const song of songs) {
            allPlaylistSongs.push({
              id: song.id,
              playlist_id: song.playlistId,
              content_id: song.contentId,
              seq: song.trackNo,
            });
          }
        } catch {
          // Skip playlists that fail to load songs
        }
      }
    }

    const db = getDb(dataDir);

    replaceLibrary(db, {
      playlists: playlists.map((p) => ({
        id: p.id,
        name: p.name,
        attribute: p.attribute,
        parent_id: p.parentId === "root" ? null : p.parentId,
        seq: p.seq,
      })),
      playlistSongs: allPlaylistSongs,
      contents: contents.map((c) => ({
        id: c.id,
        title: c.title ?? null,
        artist_id: c.artistId ?? null,
        key_id: c.keyId ?? null,
        bpm: c.bpm ?? null,
        length: c.length ?? null,
        rating: c.rating ?? null,
        file_path: c.folderPath ?? null,
      })),
      artists: artists.map((a) => ({ id: a.id, name: a.name })),
      keys: keys.map((k) => ({ id: k.id, name: k.name })),
    });

    return readPlaylistTree(db);
  },

  getPlaylistTree: async (): Promise<PlaylistNode[]> => {
    const db = getDb(dataDir);
    return readPlaylistTree(db);
  },

  getPlaylistTracks: async ({ playlistId }: { playlistId: string }): Promise<Track[]> => {
    const db = getDb(dataDir);
    return readPlaylistTracks(db, playlistId);
  },

  getTrackAudioUrl: async ({ trackId }: { trackId: string }): Promise<string | null> => {
    const db = getDb(dataDir);
    const row = db.query<{ file_path: string | null }, [string]>(
      "SELECT file_path FROM content WHERE id = ?"
    ).get(trackId);
    if (!row || !row.file_path || !existsSync(row.file_path)) return null;
    return `http://127.0.0.1:${getAudioServerPort()}/audio/${trackId}`;
  },
};
