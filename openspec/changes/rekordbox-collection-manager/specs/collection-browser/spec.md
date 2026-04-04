## ADDED Requirements

### Requirement: Navigation pane layout
The system SHALL render a left-hand navigation pane of fixed width (~260px) that is always visible when a collection is loaded, mirroring the structure of Rekordbox's browser panel.

#### Scenario: Collection is loaded and navigation pane is visible
- **WHEN** a Rekordbox XML collection has been successfully loaded
- **THEN** the navigation pane SHALL be displayed on the left side of the screen showing at minimum an "All Tracks" entry at the top and a "Playlists" section below it

### Requirement: All Tracks entry
The navigation pane SHALL include a top-level "All Tracks" item that, when selected, shows every track in the collection in the main pane.

#### Scenario: User selects "All Tracks"
- **WHEN** the user clicks "All Tracks" in the navigation pane
- **THEN** the main track listing pane SHALL display all tracks in the collection and the "All Tracks" item SHALL appear highlighted/active

### Requirement: Playlist tree navigation
The navigation pane SHALL render the full Rekordbox playlist hierarchy, including nested folders and playlists, as an expandable/collapsible tree.

#### Scenario: Folder is collapsed by default
- **WHEN** the navigation pane first renders
- **THEN** top-level playlist folders SHALL be shown collapsed (children hidden)

#### Scenario: User expands a folder
- **WHEN** the user clicks on a playlist folder chevron or label
- **THEN** the folder SHALL expand to reveal its child playlists and sub-folders

#### Scenario: User selects a playlist
- **WHEN** the user clicks on a playlist item in the navigation tree
- **THEN** the main track listing pane SHALL update to show only the tracks belonging to that playlist, and the playlist item SHALL appear highlighted/active

### Requirement: Active selection highlight
The currently selected navigation item (All Tracks or a specific playlist) SHALL be visually differentiated from other items using a distinct highlight style.

#### Scenario: Navigation item is active
- **WHEN** a navigation item is selected
- **THEN** it SHALL display with a highlighted background and contrasting text colour to indicate it is the active view
