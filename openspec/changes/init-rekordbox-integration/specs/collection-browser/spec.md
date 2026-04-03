## ADDED Requirements
### Requirement: Collection Table Display
The app SHALL display the parsed Rekordbox collection in a sortable table view similar to Rekordbox 7, showing columns for track number, title, artist, album, BPM, key, genre, duration, and a play indicator.

#### Scenario: Display collection tracks
- **WHEN** the collection is loaded successfully
- **THEN** all tracks are displayed in a table with columns matching Rekordbox 7 layout

#### Scenario: Sort by column
- **WHEN** the user clicks a column header
- **THEN** the table sorts tracks by that column in ascending order; clicking again sorts descending

#### Scenario: Empty collection
- **WHEN** the Rekordbox XML contains no tracks in the COLLECTION section
- **THEN** a message indicating the collection is empty is displayed

### Requirement: Track Selection
The app SHALL allow the user to select a single track from the collection table, visually highlighting the selected row.

#### Scenario: Select a track
- **WHEN** the user clicks a row in the collection table
- **THEN** that row is visually highlighted as the selected track
