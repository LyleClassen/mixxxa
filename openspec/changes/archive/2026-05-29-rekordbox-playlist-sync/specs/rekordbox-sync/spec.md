## ADDED Requirements

### Requirement: Pull Rekordbox Library Into Local Mirror
The system SHALL read the user's Rekordbox library via `rbox-js` and import it (playlists, playlist songs, tracks, artists, keys) into the local mirror database. This is a pull-only operation; the system SHALL NOT write changes back to Rekordbox in this capability.

#### Scenario: Library available
- **WHEN** a sync is triggered and the Rekordbox `master.db` can be opened
- **THEN** the system reads the playlists and tracks from Rekordbox and writes them into the local mirror, preserving playlist parent/child relationships and folder vs. playlist distinctions

#### Scenario: Sync is idempotent
- **WHEN** a sync runs more than once
- **THEN** the local mirror reflects the current Rekordbox state without duplicating rows, and a failed sync does not leave the mirror partially populated

#### Scenario: Library not found
- **WHEN** a sync is triggered and `master.db` does not exist
- **THEN** the system surfaces a `not-found` error rather than importing partial or fabricated data

#### Scenario: Library unreadable
- **WHEN** a sync is triggered and `master.db` exists but cannot be opened or read
- **THEN** the system surfaces an `unreadable` error

### Requirement: Read-Only Rekordbox Access
The system SHALL only read from the Rekordbox database during sync and SHALL NOT modify it.

#### Scenario: No writes performed
- **WHEN** a sync runs
- **THEN** the Rekordbox `master.db` is accessed for reading only, and no Rekordbox-mutating operations are invoked
