## ADDED Requirements
### Requirement: Audio Playback Control
The app SHALL provide play and pause controls to play audio from the selected track using the file path resolved from the Rekordbox XML Location attribute.

#### Scenario: Play selected track
- **WHEN** a track is selected and the user clicks play
- **THEN** audio playback begins from the track's file location

#### Scenario: Pause playback
- **WHEN** audio is currently playing and the user clicks pause
- **THEN** playback pauses at the current position

#### Scenario: Play different track while one is playing
- **WHEN** a track is playing and the user selects a different track and clicks play
- **THEN** the current track stops and the new track begins playing

#### Scenario: Track file not found
- **WHEN** the user attempts to play a track whose file path does not exist
- **THEN** an error message is displayed and no playback occurs

### Requirement: Playback State Indicator
The app SHALL display the current playback state (playing, paused, stopped) and the currently playing track in the UI.

#### Scenario: Show playing state
- **WHEN** a track is playing
- **THEN** a play indicator is shown next to the track in the table and the play/pause button shows a pause icon

#### Scenario: Show paused state
- **WHEN** playback is paused
- **THEN** the play/pause button shows a play icon
