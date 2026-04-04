## ADDED Requirements

### Requirement: First-launch XML file selection
The system SHALL prompt the user to select their Rekordbox XML file via a native OS file picker dialog on first launch, or whenever no valid stored path is found.

#### Scenario: No stored path on launch
- **WHEN** the application starts and no XML file path is found in persistent storage
- **THEN** the system SHALL display a full-screen onboarding prompt inviting the user to select their `rekordbox.xml` file

#### Scenario: User selects a valid XML file
- **WHEN** the user clicks the "Select Collection" button and chooses a valid XML file
- **THEN** the system SHALL begin parsing the file, store the file path persistently, and transition to the main collection view

#### Scenario: User dismisses the file picker without selecting
- **WHEN** the user opens the file picker and cancels without selecting a file
- **THEN** the system SHALL remain on the onboarding screen and display a descriptive message explaining how to find the file

### Requirement: Persistent XML path storage
The system SHALL store the selected XML file path using `tauri-plugin-store` so that it survives app restarts.

#### Scenario: App restarts with a valid stored path
- **WHEN** the application starts and a valid, accessible XML file path is found in storage
- **THEN** the system SHALL automatically load and parse the collection without showing the file selection prompt

#### Scenario: Stored path is invalid or file is missing
- **WHEN** the application starts and the stored XML path points to a file that does not exist or cannot be read
- **THEN** the system SHALL clear the stored path and display the file selection onboarding screen with a warning that the previous file could not be found

### Requirement: Rekordbox XML parsing
The system SHALL parse the Rekordbox XML format in Rust using `quick-xml`, extracting all TRACK entries and PLAYLIST/NODE entries into typed in-memory structs.

#### Scenario: Successful parse of a valid Rekordbox XML
- **WHEN** a valid Rekordbox XML file is loaded
- **THEN** the system SHALL emit a parsed collection containing all tracks (with title, artist, album, BPM, musical key, duration in seconds, genre, file path, and track ID) and the full playlist tree (folders and playlists with their constituent track IDs)

#### Scenario: Parse of a malformed or non-Rekordbox XML file
- **WHEN** the selected file cannot be parsed as a valid Rekordbox XML collection
- **THEN** the system SHALL return an error to the frontend and prompt the user to select a different file

### Requirement: Collection cached in Tauri state
The system SHALL store the parsed collection in Tauri managed state (`Mutex<Option<Collection>>`) after the initial parse so that subsequent navigation requests do not re-parse the file.

#### Scenario: Frontend requests track data after collection is loaded
- **WHEN** the frontend invokes a Tauri command to retrieve tracks or playlist contents
- **THEN** the system SHALL return the requested data from the in-memory cache without reading from disk again
