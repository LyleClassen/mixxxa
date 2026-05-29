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
  rating INTEGER
);

CREATE TABLE IF NOT EXISTS artist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS key (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
`;
