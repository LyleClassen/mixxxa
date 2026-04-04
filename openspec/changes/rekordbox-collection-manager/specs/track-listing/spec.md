## ADDED Requirements

### Requirement: Track table display
The main content pane SHALL render a table of tracks for the currently selected navigation view, with one row per track.

#### Scenario: All Tracks view is selected
- **WHEN** "All Tracks" is the active navigation item
- **THEN** the track table SHALL display all tracks from the collection, sorted by title ascending by default

#### Scenario: Playlist view is selected
- **WHEN** a playlist is the active navigation item
- **THEN** the track table SHALL display only the tracks belonging to that playlist, in playlist order

### Requirement: Track metadata columns
The track table SHALL display the following metadata columns for each track: Title, Artist, Album, BPM, Key, Duration, Genre.

#### Scenario: Track row is rendered
- **WHEN** a track is displayed in the table
- **THEN** each visible column SHALL show the corresponding metadata value from the parsed collection, or an em-dash (—) if the value is absent

### Requirement: Track selection
The user SHALL be able to select a single track by clicking its row. The selected track SHALL be visually highlighted and loaded into the audio player.

#### Scenario: User clicks a track row
- **WHEN** the user single-clicks a track row
- **THEN** the row SHALL display a highlighted background, and the audio player component SHALL load the selected track (updating its title and artist display and preparing the audio source)

#### Scenario: Only one track can be selected at a time
- **WHEN** the user clicks a different track row
- **THEN** the previous row's highlight SHALL be cleared and the new row SHALL become the active selection

### Requirement: Empty state
The track table SHALL display a friendly empty state when the selected playlist contains no tracks.

#### Scenario: Empty playlist selected
- **WHEN** the active navigation item is a playlist with zero tracks
- **THEN** the main pane SHALL display a centred message such as "No tracks in this playlist" instead of an empty table
