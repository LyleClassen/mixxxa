## ADDED Requirements

### Requirement: Collection entry pinned at top of sidebar
The system SHALL display a "Collection" entry as the first item in the sidebar playlist tree, above all user playlists and folders. It SHALL be visually distinct from regular playlists (e.g., a library/collection icon) and SHALL always be present regardless of sync state.

#### Scenario: Collection entry is always first
- **WHEN** the application loads
- **THEN** the "Collection" entry appears at the top of the sidebar tree before any playlist or folder

#### Scenario: Collection entry not removable
- **WHEN** the user browses the sidebar
- **THEN** there is no way to delete or hide the Collection entry

### Requirement: Selecting Collection loads all tracks
The system SHALL load all tracks from the local database into the main track table when the user selects the Collection entry, using the same selection and display mechanism as selecting a regular playlist.

#### Scenario: Select Collection
- **WHEN** the user clicks the Collection entry in the sidebar
- **THEN** the main track table displays every track in the local library with no playlist filter applied

#### Scenario: Track count reflects full library
- **WHEN** Collection is selected
- **THEN** the track count indicator above the table shows the total number of tracks in the local library

#### Scenario: Empty library state
- **WHEN** Collection is selected and the local library has not been synced or contains no tracks
- **THEN** the track table displays an empty state message prompting the user to sync

### Requirement: Collection selected by default on launch
The system SHALL select the Collection entry automatically on application load so the user sees their full library immediately without needing to click anything.

#### Scenario: Default selection on first launch
- **WHEN** the application starts and no previous selection is saved
- **THEN** the Collection entry is selected and all tracks are shown in the main track table

#### Scenario: Restore last selection on subsequent launches
- **WHEN** the application starts and a previous sidebar selection is saved in localStorage
- **THEN** that selection is restored; if it was Collection, all tracks are shown
