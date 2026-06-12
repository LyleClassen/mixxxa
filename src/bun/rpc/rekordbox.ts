import { MasterDb, isRekordboxRunning } from "rbox-js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { PlaylistNode, Track, SyncErrorKind } from "../../shared/types";
import { getDb, replaceLibrary, readPlaylistTree, readPlaylistTracks, readAllTracks, reorderPlaylistTracks } from "../db/localDb";
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

// Standard Rekordbox hot-cue palette, keyed by colorTableIndex.
const CUE_COLOR_TABLE: Record<number, string> = {
  1: "#F870F8",
  2: "#F80000",
  3: "#F8A030",
  4: "#C3AF04",
  5: "#28E214",
  6: "#25FDE9",
  7: "#0672F8",
  8: "#B432F8",
};

function normalizeColorCode(code: string | undefined): string | null {
  if (!code) return null;
  const hex = code.match(/^#?([0-9a-fA-F]{6})$/);
  if (hex) return `#${hex[1].toUpperCase()}`;
  const n = Number(code);
  if (Number.isFinite(n) && n >= 0) return `#${Math.round(n).toString(16).padStart(6, "0").toUpperCase()}`;
  return null;
}

function mapCues(
  cues: ReturnType<MasterDb["getCues"]>,
  colors: ReturnType<MasterDb["getColors"]>,
): Array<{ id: string; content_id: string; position_sec: number; end_sec: number | null; kind: number; color: string | null; comment: string | null }> {
  const colorById = new Map(colors.map((c) => [c.id, c.colorCode]));
  const mapped: ReturnType<typeof mapCues> = [];
  for (const cue of cues) {
    if (cue.rbLocalDeleted === 1 || cue.inMsec < 0) continue;

    let color: string | null = null;
    if (cue.colorTableIndex != null && CUE_COLOR_TABLE[cue.colorTableIndex]) {
      color = CUE_COLOR_TABLE[cue.colorTableIndex];
    } else if (cue.color !== -1) {
      color = normalizeColorCode(colorById.get(String(cue.color)));
    }

    mapped.push({
      id: cue.id,
      content_id: cue.contentId,
      position_sec: cue.inMsec / 1000,
      end_sec: cue.outMsec > 0 ? cue.outMsec / 1000 : null,
      kind: cue.kind,
      color,
      comment: cue.comment ?? null,
    });
  }
  return mapped;
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
    let albums: ReturnType<MasterDb["getAlbums"]>;
    let cues: ReturnType<MasterDb["getCues"]>;
    let colors: ReturnType<MasterDb["getColors"]>;

    try {
      playlists = rbDb.getPlaylists();
      contents = rbDb.getContents();
      artists = rbDb.getArtists();
      keys = rbDb.getKeys();
      albums = rbDb.getAlbums();
      cues = rbDb.getCues();
      colors = rbDb.getColors();
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

    const albumMap = new Map<string, string>();
    for (const album of albums) {
      albumMap.set(album.id, album.name);
    }

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
        bit_rate: c.bitRate ?? null,
        rating: c.rating ?? null,
        file_path: c.folderPath ?? null,
        album: c.albumId ? (albumMap.get(c.albumId) ?? null) : null,
      })),
      artists: artists.map((a) => ({ id: a.id, name: a.name })),
      keys: keys.map((k) => ({ id: k.id, name: k.name })),
      cues: mapCues(cues, colors),
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

  getAllTracks: async (): Promise<Track[]> => {
    const db = getDb(dataDir);
    return readAllTracks(db);
  },

  reorderPlaylistTracks: async ({ playlistId, orderedTrackIds }: { playlistId: string; orderedTrackIds: string[] }): Promise<Track[]> => {
    const db = getDb(dataDir);
    reorderPlaylistTracks(db, playlistId, orderedTrackIds);
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
