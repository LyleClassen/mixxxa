# Spec: rekordbox-sync

## Requirement: Pull Rekordbox Library Into Local Mirror
The system SHALL read the user's Rekordbox library via `rbox-js` and import it (playlists, playlist songs, tracks, artists, keys) into the local mirror database, including each track's absolute audio file path so loaded tracks can be located on disk. This is a pull-only operation; the system SHALL NOT write changes back to Rekordbox in this capability.

### Scenario: Library available
- **WHEN** a sync is triggered and the Rekordbox `master.db` can be opened
- **THEN** the system reads the playlists and tracks from Rekordbox and writes them into the local mirror, preserving playlist parent/child relationships and folder vs. playlist distinctions

### Scenario: Track file path captured
- **WHEN** a sync imports a track that has a file location in Rekordbox (`DjmdContent.folderPath`/file name)
- **THEN** the system stores that track's absolute audio file path in the local mirror

### Scenario: Sync is idempotent
- **WHEN** a sync runs more than once
- **THEN** the local mirror reflects the current Rekordbox state without duplicating rows, and a failed sync does not leave the mirror partially populated

### Scenario: Library not found
- **WHEN** a sync is triggered and `master.db` does not exist
- **THEN** the system surfaces a `not-found` error rather than importing partial or fabricated data

### Scenario: Library unreadable
- **WHEN** a sync is triggered and `master.db` exists but cannot be opened or read
- **THEN** the system surfaces an `unreadable` error

## Requirement: Read-Only Rekordbox Access
The system SHALL only read from the Rekordbox database during the pull/sync operation and SHALL NOT modify it as part of pull. Writing to Rekordbox is handled exclusively by the separate, user-initiated `rekordbox-write-back` capability and never occurs as a side effect of pull.

### Scenario: No writes performed during pull
- **WHEN** a pull/sync runs
- **THEN** the Rekordbox `master.db` is accessed for reading only, and no Rekordbox-mutating operations are invoked

### Scenario: Writes only via explicit write-back
- **WHEN** the Rekordbox database is modified by Mixxxa
- **THEN** the modification originates from the user-initiated write-back operation, not from a pull/sync or analysis run
