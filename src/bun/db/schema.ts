export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS playlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  attribute INTEGER NOT NULL,
  parent_id TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_song (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  title TEXT,
  artist_id TEXT,
  key_id TEXT,
  bpm INTEGER,
  length INTEGER,
  rating INTEGER,
  file_path TEXT,
  album TEXT,
  bit_rate INTEGER,
  analyzed_bpm REAL,
  analyzed_key TEXT,
  analyzed_bitrate INTEGER,
  analyzed_energy REAL,
  analyzed_loudness_db REAL,
  analyzed_dynamic_range_db REAL,
  analyzed_danceability REAL,
  analysis_status TEXT,
  analyzed_at INTEGER,
  time_decode_ms INTEGER,
  time_key_ms INTEGER,
  time_bpm_ms INTEGER,
  time_bitrate_ms INTEGER,
  time_orbit_ms INTEGER,
  time_total_ms INTEGER,
  analyzed_first_beat_sec REAL,
  waveform_peaks TEXT,
  waveform_duration REAL
);

CREATE TABLE IF NOT EXISTS artist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS key (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_queue (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  aspects TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT,
  progress REAL DEFAULT 0,
  error TEXT,
  time_decode_ms INTEGER,
  time_key_ms INTEGER,
  time_bpm_ms INTEGER,
  time_bitrate_ms INTEGER,
  time_orbit_ms INTEGER,
  time_total_ms INTEGER,
  seq INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_history (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  aspects TEXT NOT NULL,
  status TEXT NOT NULL,
  time_decode_ms INTEGER,
  time_key_ms INTEGER,
  time_bpm_ms INTEGER,
  time_bitrate_ms INTEGER,
  time_orbit_ms INTEGER,
  time_total_ms INTEGER,
  finished_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cue (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  position_sec REAL NOT NULL,
  end_sec REAL,
  kind INTEGER NOT NULL,
  color TEXT,
  comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_cue_content ON cue(content_id);
`;
