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

## Requirement: Store Analyzed Track Features
The system SHALL extend the local mirror's track storage with columns for analyzed Key, BPM, Energy (arousal), Valence (mood), Genre (including a genre confidence), an analysis status, an analyzed-at timestamp, and per-aspect plus total analysis timing. These analyzed columns SHALL be stored separately from the Rekordbox-sourced values and SHALL default to empty for tracks that have not been analyzed. The schema migration SHALL be additive and idempotent, matching the existing column-migration pattern.

### Scenario: Migration adds analyzed columns
- **WHEN** the database is opened against a mirror that predates the analyzed columns
- **THEN** the analyzed columns are added without error and existing data is preserved

### Scenario: Unanalyzed tracks have empty analyzed values
- **WHEN** a track has never been analyzed
- **THEN** its analyzed columns are empty/null and its Rekordbox-sourced values are unaffected

## Requirement: Expose Analyzed Values And Diff Flags
The system SHALL include the analyzed values on the track DTO returned to the view, and SHALL include per-track flags indicating whether the analyzed BPM and analyzed Key differ from the Rekordbox-sourced values. BPM comparison SHALL apply a small tolerance and Key comparison SHALL normalize values before comparing.

### Scenario: Diff flag set on mismatch
- **WHEN** a track's analyzed BPM or Key differs from its Rekordbox-sourced value beyond the comparison tolerance
- **THEN** the corresponding diff flag on the returned track is true

### Scenario: No diff flag when equal or unanalyzed
- **WHEN** a track's analyzed value matches the Rekordbox value within tolerance, or the track has not been analyzed for that aspect
- **THEN** the corresponding diff flag is false

## Requirement: Write Analyzed Values To Mirror
The system SHALL provide a write helper that persists a track's analyzed values, analysis status, and timings to the mirror without modifying that track's Rekordbox-sourced fields.

### Scenario: Persist analysis result
- **WHEN** the analysis engine writes a completed result for a track
- **THEN** only the analyzed columns, timings, and analysis status/timestamp for that track are updated

## Requirement: Persist Analysis History
The system SHALL maintain an analysis history table recording each completed or failed analysis run (track, aspects, outcome, timings, finished-at), and SHALL provide helpers to read and to clear (prune) the history.

### Scenario: Append history row
- **WHEN** an analysis run finishes
- **THEN** a history row is written with the track, aspects, outcome, timings, and finished-at timestamp

### Scenario: Prune history
- **WHEN** the prune helper is invoked
- **THEN** all analysis history rows are removed and track-level analyzed values are unaffected
