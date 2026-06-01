## MODIFIED Requirements

### Requirement: Read Tracks For A Playlist From Mirror
The system SHALL return the tracks belonging to a given playlist id as a `Track[]` with resolved display fields (title, artist, bpm, key, length, rating) plus the track's audio file path, read from the local mirror. The `bpm` field SHALL be the track's true beats-per-minute (Rekordbox stores BPM as an integer ×100; the system normalizes it by dividing by 100), not the raw ×100 value.

#### Scenario: Playlist with tracks
- **WHEN** the webview requests tracks for a valid playlist id
- **THEN** the system returns each track mapped to the `Track` DTO, resolving artist and key from the mirror, including the stored audio file path, and falling back to empty/neutral values where data is missing

#### Scenario: True BPM returned
- **WHEN** a track's BPM is stored in the mirror as a ×100 integer (e.g. `12800`)
- **THEN** the returned `Track.bpm` is the normalized value (e.g. `128`)

#### Scenario: Empty playlist
- **WHEN** the webview requests tracks for a playlist that contains no tracks
- **THEN** the system returns an empty array
