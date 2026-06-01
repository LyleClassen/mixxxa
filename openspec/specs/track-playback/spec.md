# Spec: track-playback

## Requirement: Load Track Into Player
The system SHALL load a track into the player when the user double-clicks that track in the track list, replacing any previously loaded track, and SHALL begin playback automatically once the audio is ready.

### Scenario: Double-click loads and plays
- **WHEN** the user double-clicks a track row
- **THEN** that track becomes the loaded track, its waveform begins rendering, and playback starts from the beginning once the audio is decoded

### Scenario: Loading a different track replaces the current one
- **WHEN** a track is already loaded and the user double-clicks a different track
- **THEN** the previous track's playback stops and is replaced by the newly loaded track

### Scenario: Track has no resolvable audio file
- **WHEN** the user double-clicks a track whose audio file cannot be located or served
- **THEN** the system surfaces a non-blocking error state in the player instead of crashing, and no audio plays

## Requirement: Waveform Display
The system SHALL render the loaded track's actual audio waveform using wavesurfer.js in the player section, replacing the placeholder visualization.

### Scenario: Waveform reflects the loaded audio
- **WHEN** a track finishes decoding
- **THEN** the displayed waveform corresponds to that track's audio and a progress indicator advances across it during playback

### Scenario: No track loaded
- **WHEN** no track has been loaded yet
- **THEN** the player shows an empty/idle waveform area rather than mock bars

## Requirement: Scrub Through Waveform
The system SHALL allow the user to seek to an arbitrary position by clicking or dragging on the waveform.

### Scenario: Seek by clicking the waveform
- **WHEN** the user clicks a point on the waveform of a loaded track
- **THEN** playback position jumps to the corresponding time and the current-time display updates accordingly

### Scenario: Seek preserves play/pause state
- **WHEN** the user scrubs while playing
- **THEN** playback continues from the new position; **WHEN** the user scrubs while paused, **THEN** the position updates and playback remains paused

## Requirement: Play And Pause Control
The system SHALL provide a transport control that toggles between playing and pausing the loaded track and reflects the current state.

### Scenario: Toggle playback
- **WHEN** the user activates the play/pause control while a track is loaded
- **THEN** playback toggles between playing and paused, and the control's icon reflects the resulting state

### Scenario: Reaching the end of the track
- **WHEN** playback reaches the end of the track
- **THEN** the player returns to a paused state

## Requirement: Volume Control
The system SHALL provide a volume control that adjusts the playback level of the loaded track over a 0–100% range. The chosen level SHALL persist across track loads and across app restarts.

### Scenario: Adjust volume
- **WHEN** the user changes the volume control
- **THEN** the audible playback level changes to match, and the level persists across track loads within the session

### Scenario: Volume restored after restart
- **WHEN** the user sets a volume level, closes the app, and reopens it
- **THEN** the volume control and playback level are restored to the previously chosen level

### Scenario: Volume at zero
- **WHEN** the user sets volume to 0%
- **THEN** playback continues silently without pausing

## Requirement: Player Metadata And Time Display
The system SHALL display the loaded track's title, artist, key, and BPM, plus a live current-time and total-duration readout, all derived from the loaded track's real data and decoded audio rather than placeholder values.

### Scenario: Metadata matches loaded track
- **WHEN** a track is loaded
- **THEN** the player shows that track's title, artist, key, and true BPM

### Scenario: Time readout updates during playback
- **WHEN** a track is playing
- **THEN** the current-time readout advances in real time and the total-duration readout matches the decoded audio length, formatted as mm:ss

### Scenario: Missing metadata
- **WHEN** a loaded track lacks a value for key or BPM
- **THEN** the player shows a neutral placeholder for that field instead of a fabricated value

## Requirement: Serve Loaded Track Audio To Webview
The system SHALL make the loaded track's audio file available to the webview over a local source that supports HTTP byte-range requests so the waveform can decode and seeking is responsive.

### Scenario: Resolve a playable URL for a track
- **WHEN** the webview requests playback of a track id
- **THEN** the system resolves the track's audio file path from the mirror and provides a local URL the webview can fetch

### Scenario: Range request for seeking
- **WHEN** the webview requests a byte range of the audio
- **THEN** the local source responds with the requested range so seeking does not require re-downloading the whole file

### Scenario: File missing on disk
- **WHEN** a track's stored file path does not exist on disk
- **THEN** the system responds with a not-found result rather than serving an unrelated or empty file
