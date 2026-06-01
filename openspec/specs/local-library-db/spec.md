# Spec: local-library-db

## Requirement: Local Mirror Database
The system SHALL maintain a local SQLite database that mirrors the relevant Rekordbox library data (playlists, playlist songs, tracks, artists, keys) and serves as the app's read source for playlists and tracks.

### Scenario: Database initialized on first use
- **WHEN** the app accesses the local library database for the first time
- **THEN** the database file and its schema are created if they do not already exist, without error

### Scenario: Mirror is the read source
- **WHEN** the app needs playlists or tracks for display
- **THEN** the data is read from the local mirror database, not directly from the Rekordbox `master.db`

## Requirement: Read Playlist Tree From Mirror
The system SHALL expose the nested playlist/folder tree from the local mirror to the webview as a `PlaylistNode[]`.

### Scenario: Tree reconstructed from mirror
- **WHEN** the webview requests the playlist tree
- **THEN** the system returns the playlists and folders as a nested tree reconstructed from the mirror, preserving parent/child relationships and marking folder nodes distinctly from playlist nodes

### Scenario: No data yet
- **WHEN** the webview requests the playlist tree before any sync has populated the mirror
- **THEN** the system returns an empty tree rather than an error

## Requirement: Read Tracks For A Playlist From Mirror
The system SHALL return the tracks belonging to a given playlist id as a `Track[]` with resolved display fields (title, artist, bpm, key, length, rating) plus the track's audio file path, read from the local mirror. The `bpm` field SHALL be the track's true beats-per-minute (Rekordbox stores BPM as an integer ×100; the system normalizes it by dividing by 100), not the raw ×100 value.

### Scenario: Playlist with tracks
- **WHEN** the webview requests tracks for a valid playlist id
- **THEN** the system returns each track mapped to the `Track` DTO, resolving artist and key from the mirror, including the stored audio file path, and falling back to empty/neutral values where data is missing

### Scenario: True BPM returned
- **WHEN** a track's BPM is stored in the mirror as a ×100 integer (e.g. `12800`)
- **THEN** the returned `Track.bpm` is the normalized value (e.g. `128`)

### Scenario: Empty playlist
- **WHEN** the webview requests tracks for a playlist that contains no tracks
- **THEN** the system returns an empty array
