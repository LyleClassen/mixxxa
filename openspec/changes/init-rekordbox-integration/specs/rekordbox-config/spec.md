## ADDED Requirements
### Requirement: Rekordbox XML Path Resolution
The app SHALL locate the user's rekordbox.xml file. On first launch, the app SHALL prompt the user to browse for and select their rekordbox.xml file. The selected path SHALL be persisted so that on subsequent launches the app loads the collection automatically without prompting.

#### Scenario: First launch - user prompted to browse
- **WHEN** the app launches and no rekordbox.xml path is stored
- **THEN** a file browser dialog is shown asking the user to select their rekordbox.xml

#### Scenario: First launch - user selects valid XML
- **WHEN** the user selects a file through the browser dialog
- **THEN** the path is persisted and the collection is loaded

#### Scenario: Subsequent launch - path already stored
- **WHEN** the app launches and a rekordbox.xml path is already persisted
- **THEN** the app loads the collection directly without showing the file browser

#### Scenario: User selects non-XML file
- **WHEN** the user selects a file that is not a valid Rekordbox XML
- **THEN** an error message is displayed and the file browser remains open

### Requirement: Rekordbox XML Collection Parsing
The app SHALL parse the Rekordbox XML file and extract track metadata from the COLLECTION section, including TrackID, Name, Artist, Album, BPM, Tonality (key), Genre, TotalTime (duration), and Location.

#### Scenario: Parse valid Rekordbox XML
- **WHEN** a valid Rekordbox XML file is provided
- **THEN** all TRACK nodes from the COLLECTION section are parsed into structured track objects

#### Scenario: Handle escaped file paths
- **WHEN** a track Location attribute contains URL-encoded characters (e.g., `%20`)
- **THEN** the path is decoded and the `file://localhost/` prefix is stripped to produce a usable local file path

#### Scenario: Handle missing Location attribute
- **WHEN** a TRACK node lacks a Location attribute
- **THEN** the track is included in the collection but marked as having no playable file
