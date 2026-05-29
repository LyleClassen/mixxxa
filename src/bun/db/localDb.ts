import { Database } from "bun:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { SCHEMA_SQL } from "./schema";
import type { PlaylistNode, Track } from "../../shared/types";

let db: Database | null = null;

export function getDb(dataDir: string): Database {
  if (db) return db;

  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "library.db");
  db = new Database(dbPath);
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec(SCHEMA_SQL);
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

// ── Read helpers ─────────────────────────────────────────────────────────────

export function readPlaylistTree(database: Database): PlaylistNode[] {
  type Row = { id: string; name: string; attribute: number; parent_id: string | null };
  const rows = database.query<Row, []>(
    "SELECT id, name, attribute, parent_id FROM playlist ORDER BY seq ASC"
  ).all();

  const byParent = new Map<string | null, Row[]>();
  for (const row of rows) {
    const key = row.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(row);
  }

  function buildChildren(parentId: string | null): PlaylistNode[] {
    return (byParent.get(parentId) ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      isFolder: row.attribute === 1,
      children: buildChildren(row.id),
    }));
  }

  return buildChildren(null);
}

export function readPlaylistTracks(database: Database, playlistId: string): Track[] {
  type Row = {
    content_id: string;
    title: string | null;
    bpm: number | null;
    length: number | null;
    rating: number | null;
    artist_name: string | null;
    key_name: string | null;
  };
  const rows = database.query<Row, [string]>(`
    SELECT
      c.id AS content_id,
      c.title,
      c.bpm,
      c.length,
      c.rating,
      a.name AS artist_name,
      k.name AS key_name
    FROM playlist_song ps
    JOIN content c ON c.id = ps.content_id
    LEFT JOIN artist a ON a.id = c.artist_id
    LEFT JOIN key k ON k.id = c.key_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.seq ASC
  `).all(playlistId);

  return rows.map((row) => ({
    id: row.content_id,
    title: row.title ?? "",
    artist: row.artist_name ?? "",
    bpm: row.bpm != null ? row.bpm : null,
    key: row.key_name ?? "",
    length: row.length != null ? Math.round(row.length / 1000) : null,
    rating: row.rating ?? null,
  }));
}

// ── Write helpers ─────────────────────────────────────────────────────────────

interface LibraryData {
  playlists: Array<{ id: string; name: string; attribute: number; parent_id: string | null; seq: number }>;
  playlistSongs: Array<{ id: string; playlist_id: string; content_id: string; seq: number }>;
  contents: Array<{ id: string; title: string | null; artist_id: string | null; key_id: string | null; bpm: number | null; length: number | null; rating: number | null }>;
  artists: Array<{ id: string; name: string }>;
  keys: Array<{ id: string; name: string }>;
}

export function replaceLibrary(database: Database, data: LibraryData): void {
  const tx = database.transaction(() => {
    database.exec("DELETE FROM playlist_song");
    database.exec("DELETE FROM playlist");
    database.exec("DELETE FROM content");
    database.exec("DELETE FROM artist");
    database.exec("DELETE FROM key");

    const insertPlaylist = database.prepare(
      "INSERT INTO playlist (id, name, attribute, parent_id, seq) VALUES (?, ?, ?, ?, ?)"
    );
    for (const p of data.playlists) {
      insertPlaylist.run(p.id, p.name, p.attribute, p.parent_id, p.seq);
    }

    const insertSong = database.prepare(
      "INSERT INTO playlist_song (id, playlist_id, content_id, seq) VALUES (?, ?, ?, ?)"
    );
    for (const s of data.playlistSongs) {
      insertSong.run(s.id, s.playlist_id, s.content_id, s.seq);
    }

    const insertContent = database.prepare(
      "INSERT INTO content (id, title, artist_id, key_id, bpm, length, rating) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const c of data.contents) {
      insertContent.run(c.id, c.title, c.artist_id, c.key_id, c.bpm, c.length, c.rating);
    }

    const insertArtist = database.prepare("INSERT INTO artist (id, name) VALUES (?, ?)");
    for (const a of data.artists) {
      insertArtist.run(a.id, a.name);
    }

    const insertKey = database.prepare("INSERT INTO key (id, name) VALUES (?, ?)");
    for (const k of data.keys) {
      insertKey.run(k.id, k.name);
    }
  });

  tx();
}
