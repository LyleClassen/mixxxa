# Spec: playlist-explorer

## Requirement: Sync Action In Top Navigation
The system SHALL provide a "Sync" control in the top navigation that pulls the Rekordbox library into the local mirror and populates the sidebar from it.

### Scenario: User triggers sync
- **WHEN** the user clicks the Sync button
- **THEN** the system imports the Rekordbox library into the local mirror, then loads the playlist tree from the mirror and renders it in the sidebar, showing a loading state while in progress

### Scenario: Rekordbox library not found
- **WHEN** the Sync action fails because the Rekordbox `master.db` does not exist
- **THEN** the system shows a "not found" error message guiding the user to install/open Rekordbox

### Scenario: Rekordbox library unreadable
- **WHEN** the Sync action fails because `master.db` exists but cannot be opened (locked, encrypted, or corrupt)
- **THEN** the system shows an "unreadable" error message suggesting the user close Rekordbox and retry

## Requirement: Sidebar Playlist Explorer
The system SHALL render the synced playlists and folders in the sidebar as a nested, Rekordbox-style explorer tree, fully replacing the previous static sidebar items.

### Scenario: Folders expand and collapse
- **WHEN** the tree contains folders with child playlists
- **THEN** the user can expand and collapse folders to reveal or hide their children

### Scenario: Playlist selection
- **WHEN** the user selects a playlist leaf node
- **THEN** the system marks it as the active playlist and loads its tracks

## Requirement: Playlist Track View
The system SHALL display the selected playlist's tracks in the main track list, replacing the previous mock track data.

### Scenario: Tracks load for selected playlist
- **WHEN** a playlist is selected and its tracks are returned
- **THEN** the track list renders the playlist's tracks with their title, artist, bpm, and key

### Scenario: Selected playlist is empty
- **WHEN** a selected playlist contains no tracks
- **THEN** the track list shows an empty state rather than stale tracks from a prior selection
