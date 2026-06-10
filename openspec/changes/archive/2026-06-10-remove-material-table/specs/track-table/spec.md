## Purpose

Enable users to reorder tracks within playlists and persist those changes to the local library database, while maintaining compatibility with Rekordbox's original ordering.

## ADDED

### Requirement: Playlist track ordering
The system SHALL display the tracks of a playlist in the playlist's own sequence, sourced from Rekordbox's per-playlist `trackNo` (`getPlaylistSongs`) and stored as `playlist_song.seq`. Tracks SHALL be read ordered by `seq` ascending. The aggregate "All Tracks"/Collection view, which has no playlist sequence, SHALL retain its existing artist/title ordering.

#### Scenario: Playlist renders in Rekordbox order
- **WHEN** the user selects a playlist
- **THEN** its tracks render in ascending `seq` order matching the Rekordbox playlist sequence

#### Scenario: Collection view keeps default ordering
- **WHEN** the user selects the aggregate "All Tracks" view
- **THEN** tracks render in the existing artist-then-title order, not a playlist sequence

### Requirement: Drag-to-reorder track rows
The system SHALL allow the user to reorder track rows within a playlist by dragging a row to a new position. A drag SHALL initiate on pointer-down on a row's drag affordance, show a dragging visual state on the moved row, and show a drop indicator at the target position. Row reordering SHALL be disabled in the aggregate "All Tracks"/Collection view.

#### Scenario: Initiate row drag
- **WHEN** the user presses and holds the pointer on a track row's drag affordance and moves vertically
- **THEN** the row shows a dragging visual state and a drop indicator appears between adjacent rows

#### Scenario: Complete row reorder
- **WHEN** the user releases the pointer over a valid drop position
- **THEN** the row moves to that position and the table re-renders with the new track order

#### Scenario: Cancel row drag
- **WHEN** the user releases the pointer outside any valid drop zone or presses Escape during the drag
- **THEN** the row returns to its original position and no order change occurs

#### Scenario: Reorder disabled in collection view
- **WHEN** the user is viewing the aggregate "All Tracks" view
- **THEN** rows provide no drag affordance and cannot be reordered

### Requirement: Persist reordered playlist track order
The system SHALL persist a reordered playlist sequence to the local library database by updating `playlist_song.seq` for the affected playlist, so the order survives application restarts. The order SHALL NOT be written back to Rekordbox's `master.db`; a subsequent Rekordbox re-sync re-imports the original Rekordbox order.

#### Scenario: Save order after reorder
- **WHEN** the user completes a row reorder in a playlist
- **THEN** the new `seq` values for that playlist's tracks are written to the local library database

#### Scenario: Restore order on reload
- **WHEN** the user re-selects the playlist or restarts the application after reordering
- **THEN** the tracks render in the previously saved order

#### Scenario: Re-sync reverts to Rekordbox order
- **WHEN** the user runs a Rekordbox sync after reordering a playlist locally
- **THEN** the playlist order is replaced by the order imported from Rekordbox
