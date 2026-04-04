## ADDED Requirements

### Requirement: Persistent player bar
The system SHALL render a fixed audio player bar at the top of the application window that is always visible when a collection is loaded.

#### Scenario: Collection is loaded
- **WHEN** the main collection view is displayed
- **THEN** the audio player bar SHALL occupy the full width at the top of the window and SHALL remain visible regardless of which navigation item or track is selected

### Requirement: Track loading
The audio player SHALL load a track when the user selects a row in the track listing. The player SHALL display the track's title and artist name.

#### Scenario: User selects a track
- **WHEN** the user clicks a track row in the track listing
- **THEN** the audio player SHALL update to show the selected track's title and artist, and SHALL prepare the audio source using the track's local file path (converted via Tauri's `convertFileSrc` helper)

#### Scenario: No track is selected
- **WHEN** no track has been selected yet
- **THEN** the audio player bar SHALL display a placeholder state (e.g., "No track selected") with play/pause disabled

### Requirement: Play and pause control
The audio player SHALL provide a play/pause toggle button that starts or suspends playback of the currently loaded track.

#### Scenario: User presses Play on a loaded track
- **WHEN** a track is loaded and the user clicks the play button
- **THEN** the track SHALL begin playing and the button icon SHALL change to a Pause icon

#### Scenario: User presses Pause during playback
- **WHEN** a track is playing and the user clicks the pause button
- **THEN** playback SHALL pause and the button icon SHALL revert to a Play icon

#### Scenario: Track reaches end
- **WHEN** a track plays to its end
- **THEN** playback SHALL stop and the play button SHALL return to its Play state

### Requirement: Volume control
The audio player SHALL provide a volume slider that allows the user to adjust playback volume from 0% to 100%.

#### Scenario: User adjusts the volume slider
- **WHEN** the user drags the volume slider
- **THEN** the audio output volume SHALL change in real time to match the slider's value

#### Scenario: Default volume on load
- **WHEN** the application first loads
- **THEN** the volume SHALL default to 80%

### Requirement: Playback error handling
The audio player SHALL surface an error if the selected track's file cannot be played.

#### Scenario: Track file is missing or unsupported format
- **WHEN** the audio element raises an error while attempting to load or play a track
- **THEN** the player SHALL display a visible error message beneath the track info (e.g., "Unable to play this track") and the play button SHALL be disabled
