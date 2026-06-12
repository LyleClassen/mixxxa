import { Database } from "bun:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { SCHEMA_SQL } from "./schema";
import type { PlaylistNode, Track, HistoryEntry, CueMarker } from "../../shared/types";

let db: Database | null = null;

const CONTENT_ANALYSIS_COLUMNS = [
  "file_path TEXT",
  "album TEXT",
  "bit_rate INTEGER",
  "analyzed_bpm REAL",
  "analyzed_key TEXT",
  "analyzed_bitrate INTEGER",
  "analyzed_energy REAL",
  "analyzed_loudness_db REAL",
  "analyzed_dynamic_range_db REAL",
  "analyzed_danceability REAL",
  "fingerprint TEXT",
  "time_fingerprint_ms INTEGER",
  "analysis_status TEXT",
  "analyzed_at INTEGER",
  "time_decode_ms INTEGER",
  "time_key_ms INTEGER",
  "time_bpm_ms INTEGER",
  "time_bitrate_ms INTEGER",
  "time_orbit_ms INTEGER",
  "time_total_ms INTEGER",
  "analyzed_first_beat_sec REAL",
  "waveform_peaks TEXT",
  "waveform_duration REAL",
];

// Columns from the removed genre/mood/arousal analysis aspects. Dropped from any
// existing DB so the schema stays tidy. analyzed_energy is intentionally absent
// here — it was dropped previously but is now re-added for the ORBIT engine.
const REMOVED_ANALYSIS_COLUMNS: Record<string, string[]> = {
  content: [
    "analyzed_valence",
    "analyzed_genre",
    "analyzed_genre_confidence",
    "time_energy_ms",
    "time_valence_ms",
    "time_genre_ms",
  ],
  analysis_queue: ["time_energy_ms", "time_valence_ms", "time_genre_ms"],
  analysis_history: ["time_energy_ms", "time_valence_ms", "time_genre_ms"],
};

export function getDb(dataDir: string): Database {
  if (db) return db;

  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "library.db");
  db = new Database(dbPath);
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec(SCHEMA_SQL);

  // Idempotent migration: add any missing columns to content
  const cols = db.query<{ name: string }, []>("PRAGMA table_info(content)").all();
  const existingNames = new Set(cols.map((c) => c.name));
  for (const colDef of CONTENT_ANALYSIS_COLUMNS) {
    const colName = colDef.split(" ")[0];
    if (!existingNames.has(colName)) {
      db.exec(`ALTER TABLE content ADD COLUMN ${colDef}`);
    }
  }

  // Idempotent migration: drop columns from the removed genre/mood/arousal aspects
  for (const [table, removedCols] of Object.entries(REMOVED_ANALYSIS_COLUMNS)) {
    const present = new Set(
      db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((c) => c.name),
    );
    for (const col of removedCols) {
      if (present.has(col)) {
        db.exec(`ALTER TABLE ${table} DROP COLUMN ${col}`);
      }
    }
  }

  // Idempotent migration: add time_bitrate_ms and time_orbit_ms to queue/history
  for (const table of ["analysis_queue", "analysis_history"]) {
    const present = new Set(
      db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((c) => c.name),
    );
    if (!present.has("time_bitrate_ms")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN time_bitrate_ms INTEGER`);
    }
    if (!present.has("time_orbit_ms")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN time_orbit_ms INTEGER`);
    }
  }

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

type ContentRow = {
  content_id: string;
  title: string | null;
  bpm: number | null;
  length: number | null;
  rating: number | null;
  artist_name: string | null;
  key_name: string | null;
  file_path: string | null;
  album: string | null;
  bit_rate: number | null;
  analyzed_bpm: number | null;
  analyzed_key: string | null;
  analyzed_bitrate: number | null;
  analyzed_energy: number | null;
  analyzed_loudness_db: number | null;
  analyzed_dynamic_range_db: number | null;
  analyzed_danceability: number | null;
  fingerprint: string | null;
  analysis_status: string | null;
};

function normalizeKey(k: string | null): string {
  return (k ?? "").trim().toLowerCase();
}

function rowToTrack(row: ContentRow): Track {
  const rbBpm = row.bpm != null ? row.bpm / 100 : null;
  const analyzedBpm = row.analyzed_bpm ?? null;
  const rbKey = row.key_name ?? "";
  const analyzedKey = row.analyzed_key ?? null;

  const bpmDiffers =
    rbBpm != null && analyzedBpm != null
      ? Math.abs(rbBpm - analyzedBpm) > 1
      : false;
  const keyDiffers =
    rbKey !== "" && analyzedKey != null
      ? normalizeKey(rbKey) !== normalizeKey(analyzedKey)
      : false;

  return {
    id: row.content_id,
    title: row.title ?? "",
    artist: row.artist_name ?? "",
    album: row.album ?? null,
    bpm: rbBpm,
    key: rbKey,
    length: row.length ?? null,
    bitrate: row.bit_rate ?? null,
    analyzedBitrate: row.analyzed_bitrate ?? null,
    rating: row.rating ?? null,
    filePath: row.file_path ?? null,
    analyzedBpm,
    analyzedKey,
    analyzedEnergy: row.analyzed_energy ?? null,
    analyzedLoudnessDb: row.analyzed_loudness_db ?? null,
    analyzedDynamicRangeDb: row.analyzed_dynamic_range_db ?? null,
    analyzedDanceability: row.analyzed_danceability ?? null,
    fingerprint: row.fingerprint ?? null,
    analysisStatus: (row.analysis_status as Track["analysisStatus"]) ?? null,
    bpmDiffers,
    keyDiffers,
  };
}

const TRACK_SELECT = `
  c.id AS content_id,
  c.title,
  c.bpm,
  c.length,
  c.rating,
  c.file_path,
  c.album,
  c.bit_rate,
  a.name AS artist_name,
  k.name AS key_name,
  c.analyzed_bpm,
  c.analyzed_key,
  c.analyzed_bitrate,
  c.analyzed_energy,
  c.analyzed_loudness_db,
  c.analyzed_dynamic_range_db,
  c.analyzed_danceability,
  c.fingerprint,
  c.analysis_status
`;

export function readPlaylistTracks(database: Database, playlistId: string): Track[] {
  const rows = database.query<ContentRow, [string]>(`
    SELECT ${TRACK_SELECT}
    FROM playlist_song ps
    JOIN content c ON c.id = ps.content_id
    LEFT JOIN artist a ON a.id = c.artist_id
    LEFT JOIN key k ON k.id = c.key_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.seq ASC
  `).all(playlistId);
  return rows.map(rowToTrack);
}

export function readAllTracks(database: Database): Track[] {
  const rows = database.query<ContentRow, []>(`
    SELECT ${TRACK_SELECT}
    FROM content c
    LEFT JOIN artist a ON a.id = c.artist_id
    LEFT JOIN key k ON k.id = c.key_id
    ORDER BY a.name ASC, c.title ASC
  `).all();
  return rows.map(rowToTrack);
}

// Rewrite playlist_song.seq for a playlist so each content_id gets its index in
// orderedTrackIds (0..n-1). Single transaction; idempotent. Only affects rows
// already in the playlist — unknown ids are ignored, missing ones left untouched.
export function reorderPlaylistTracks(
  database: Database,
  playlistId: string,
  orderedTrackIds: string[],
): void {
  const update = database.prepare(
    "UPDATE playlist_song SET seq = ? WHERE playlist_id = ? AND content_id = ?",
  );
  const tx = database.transaction(() => {
    orderedTrackIds.forEach((contentId, index) => {
      update.run(index, playlistId, contentId);
    });
  });
  tx();
}

// ── Analysis write helpers ────────────────────────────────────────────────────

export interface AnalyzedValues {
  analyzedBpm?: number | null;
  analyzedKey?: string | null;
  analyzedEnergy?: number | null;
  analyzedLoudnessDb?: number | null;
  analyzedDynamicRangeDb?: number | null;
  analyzedDanceability?: number | null;
  analyzedFirstBeatSec?: number | null;
  analysisStatus: string;
  analyzedAt?: number;
  timeDecodeMs?: number | null;
  timeKeyMs?: number | null;
  timeBpmMs?: number | null;
  timeOrbitMs?: number | null;
  timeTotalMs?: number | null;
}

// COALESCE(?, col) means: use the provided value if non-null, else keep the
// current column value. This lets Essentia and ORBIT writes coexist — each
// engine only overwrites the columns it actually computes.
export function writeAnalyzedValues(database: Database, trackId: string, values: AnalyzedValues): void {
  database.run(
    `UPDATE content SET
      analyzed_bpm = COALESCE(?, analyzed_bpm),
      analyzed_key = COALESCE(?, analyzed_key),
      analyzed_energy = COALESCE(?, analyzed_energy),
      analyzed_loudness_db = COALESCE(?, analyzed_loudness_db),
      analyzed_dynamic_range_db = COALESCE(?, analyzed_dynamic_range_db),
      analyzed_danceability = COALESCE(?, analyzed_danceability),
      analyzed_first_beat_sec = COALESCE(?, analyzed_first_beat_sec),
      analysis_status = ?,
      analyzed_at = ?,
      time_decode_ms = COALESCE(?, time_decode_ms),
      time_key_ms = COALESCE(?, time_key_ms),
      time_bpm_ms = COALESCE(?, time_bpm_ms),
      time_orbit_ms = COALESCE(?, time_orbit_ms),
      time_total_ms = COALESCE(?, time_total_ms)
    WHERE id = ?`,
    values.analyzedBpm ?? null,
    values.analyzedKey ?? null,
    values.analyzedEnergy ?? null,
    values.analyzedLoudnessDb ?? null,
    values.analyzedDynamicRangeDb ?? null,
    values.analyzedDanceability ?? null,
    values.analyzedFirstBeatSec ?? null,
    values.analysisStatus,
    values.analyzedAt ?? Date.now(),
    values.timeDecodeMs ?? null,
    values.timeKeyMs ?? null,
    values.timeBpmMs ?? null,
    values.timeOrbitMs ?? null,
    values.timeTotalMs ?? null,
    trackId,
  );
}

export function appendAnalysisHistory(database: Database, entry: {
  id: string;
  trackId: string;
  aspects: string[];
  status: string;
  timeDecodeMs?: number | null;
  timeKeyMs?: number | null;
  timeBpmMs?: number | null;
  timeBitrateMs?: number | null;
  timeOrbitMs?: number | null;
  timeTotalMs?: number | null;
}): void {
  database.run(
    `INSERT INTO analysis_history
      (id, track_id, aspects, status, time_decode_ms, time_key_ms, time_bpm_ms, time_bitrate_ms, time_orbit_ms, time_total_ms, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.trackId,
    JSON.stringify(entry.aspects),
    entry.status,
    entry.timeDecodeMs ?? null,
    entry.timeKeyMs ?? null,
    entry.timeBpmMs ?? null,
    entry.timeBitrateMs ?? null,
    entry.timeOrbitMs ?? null,
    entry.timeTotalMs ?? null,
    Date.now(),
  );
}

// ── Waveform helpers ──────────────────────────────────────────────────────────

export interface WaveformDataRow {
  peaks: number[] | null;
  duration: number | null;
  bpm: number | null;
  firstBeatSec: number;
  cues: CueMarker[];
}

export function readWaveformData(database: Database, trackId: string): WaveformDataRow | null {
  type Row = {
    waveform_peaks: string | null;
    waveform_duration: number | null;
    analyzed_bpm: number | null;
    bpm: number | null;
    analyzed_first_beat_sec: number | null;
  };
  const row = database.query<Row, [string]>(
    "SELECT waveform_peaks, waveform_duration, analyzed_bpm, bpm, analyzed_first_beat_sec FROM content WHERE id = ?"
  ).get(trackId);
  if (!row) return null;

  let peaks: number[] | null = null;
  if (row.waveform_peaks) {
    try {
      peaks = JSON.parse(row.waveform_peaks) as number[];
    } catch {
      peaks = null;
    }
  }

  type CueRow = {
    id: string;
    position_sec: number;
    end_sec: number | null;
    kind: number;
    color: string | null;
    comment: string | null;
  };
  // Sorted ascending — prev/next cue navigation relies on this order.
  const cueRows = database.query<CueRow, [string]>(
    "SELECT id, position_sec, end_sec, kind, color, comment FROM cue WHERE content_id = ? ORDER BY position_sec ASC"
  ).all(trackId);

  return {
    peaks,
    duration: row.waveform_duration ?? null,
    bpm: row.analyzed_bpm ?? (row.bpm != null ? row.bpm / 100 : null),
    firstBeatSec: row.analyzed_first_beat_sec ?? 0,
    cues: cueRows.map((c) => ({
      id: c.id,
      positionSec: c.position_sec,
      endSec: c.end_sec,
      kind: c.kind,
      color: c.color,
      comment: c.comment,
    })),
  };
}

export function writeWaveformPeaks(database: Database, trackId: string, peaksJson: string, duration: number): void {
  database.run(
    "UPDATE content SET waveform_peaks = ?, waveform_duration = ? WHERE id = ?",
    [peaksJson, duration, trackId],
  );
}

export function writeFingerprint(database: Database, trackId: string, fingerprint: string, timeFingerprintMs: number): void {
  database.run(
    "UPDATE content SET fingerprint = ?, time_fingerprint_ms = ? WHERE id = ?",
    [fingerprint, timeFingerprintMs, trackId],
  );
}

export function writeAnalyzedBitrate(database: Database, trackId: string, bitrate: number, timeBitrateMs: number): void {
  database.run(
    "UPDATE content SET analyzed_bitrate = ?, time_bitrate_ms = ? WHERE id = ?",
    [bitrate, timeBitrateMs, trackId],
  );
}

export function readAnalysisHistory(database: Database): HistoryEntry[] {
  type Row = {
    id: string;
    track_id: string;
    aspects: string;
    status: string;
    time_decode_ms: number | null;
    time_key_ms: number | null;
    time_bpm_ms: number | null;
    time_bitrate_ms: number | null;
    time_orbit_ms: number | null;
    time_total_ms: number | null;
    finished_at: number;
  };
  const rows = database.query<Row, []>(
    "SELECT * FROM analysis_history ORDER BY finished_at DESC"
  ).all();
  return rows.map((r) => ({
    id: r.id,
    trackId: r.track_id,
    aspects: JSON.parse(r.aspects) as string[],
    status: r.status,
    timeDecodeMs: r.time_decode_ms ?? undefined,
    timeKeyMs: r.time_key_ms ?? undefined,
    timeBpmMs: r.time_bpm_ms ?? undefined,
    timeBitrateMs: r.time_bitrate_ms ?? undefined,
    timeOrbitMs: r.time_orbit_ms ?? undefined,
    timeTotalMs: r.time_total_ms ?? undefined,
    finishedAt: r.finished_at,
  }));
}

export function pruneAnalysisHistory(database: Database): void {
  database.exec("DELETE FROM analysis_history");
}

// ── Write helpers ─────────────────────────────────────────────────────────────

interface LibraryData {
  playlists: Array<{ id: string; name: string; attribute: number; parent_id: string | null; seq: number }>;
  playlistSongs: Array<{ id: string; playlist_id: string; content_id: string; seq: number }>;
  contents: Array<{ id: string; title: string | null; artist_id: string | null; key_id: string | null; bpm: number | null; length: number | null; bit_rate: number | null; rating: number | null; file_path: string | null; album: string | null }>;
  artists: Array<{ id: string; name: string }>;
  keys: Array<{ id: string; name: string }>;
  cues: Array<{ id: string; content_id: string; position_sec: number; end_sec: number | null; kind: number; color: string | null; comment: string | null }>;
}

export function replaceLibrary(database: Database, data: LibraryData): void {
  const tx = database.transaction(() => {
    database.exec("DELETE FROM playlist_song");
    database.exec("DELETE FROM playlist");
    database.exec("DELETE FROM content");
    database.exec("DELETE FROM artist");
    database.exec("DELETE FROM key");
    database.exec("DELETE FROM cue");

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
      "INSERT INTO content (id, title, artist_id, key_id, bpm, length, bit_rate, rating, file_path, album) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const c of data.contents) {
      insertContent.run(c.id, c.title, c.artist_id, c.key_id, c.bpm, c.length, c.bit_rate, c.rating, c.file_path, c.album);
    }

    const insertArtist = database.prepare("INSERT INTO artist (id, name) VALUES (?, ?)");
    for (const a of data.artists) {
      insertArtist.run(a.id, a.name);
    }

    const insertKey = database.prepare("INSERT INTO key (id, name) VALUES (?, ?)");
    for (const k of data.keys) {
      insertKey.run(k.id, k.name);
    }

    const insertCue = database.prepare(
      "INSERT INTO cue (id, content_id, position_sec, end_sec, kind, color, comment) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const c of data.cues) {
      insertCue.run(c.id, c.content_id, c.position_sec, c.end_sec, c.kind, c.color, c.comment);
    }
  });

  tx();
}
