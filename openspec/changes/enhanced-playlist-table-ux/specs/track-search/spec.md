## ADDED Requirements

### Requirement: Multi-field track search
The system SHALL filter the visible track list in real time as the user types in the search input. The search SHALL match against track title, artist name, and album name simultaneously using case-insensitive substring matching. A track SHALL appear in results if the query matches ANY of the three fields.

#### Scenario: Search matches title
- **WHEN** the user types a string that is a substring of a track's title (case-insensitive)
- **THEN** that track appears in the filtered results

#### Scenario: Search matches artist
- **WHEN** the user types a string that is a substring of a track's artist name (case-insensitive)
- **THEN** that track appears in the filtered results

#### Scenario: Search matches album
- **WHEN** the user types a string that is a substring of a track's album name (case-insensitive)
- **THEN** that track appears in the filtered results

#### Scenario: No matches
- **WHEN** the user types a query that does not match any track's title, artist, or album
- **THEN** the track list displays an empty state message ("No tracks found")

#### Scenario: Clear search
- **WHEN** the user clears the search input
- **THEN** the full unfiltered track list is restored immediately

### Requirement: Debounced search input
The system SHALL debounce the search filter so that filtering is triggered no more than once per 200ms while the user is actively typing, to avoid excessive re-renders on every keystroke.

#### Scenario: Rapid typing debounce
- **WHEN** the user types multiple characters in quick succession within 200ms
- **THEN** the track list SHALL only update after the user pauses for at least 200ms

#### Scenario: Single character response
- **WHEN** the user types a character and waits more than 200ms
- **THEN** the track list updates to reflect the current search query

### Requirement: Search resets on playlist/collection change
The system SHALL clear the search input when the user selects a different playlist or the Collection entry in the sidebar, so the new selection always starts with an unfiltered view.

#### Scenario: Select new playlist clears search
- **WHEN** the user clicks a different playlist or Collection in the sidebar while a search query is active
- **THEN** the search input is cleared and the full track list for the new selection is displayed

### Requirement: Album field available on Track
The system SHALL include the album name as a field on the Track data type, populated from the local SQLite database. The album field SHALL be nullable for tracks that have no album metadata.

#### Scenario: Album displayed in table
- **WHEN** a track has album metadata in the local database
- **THEN** the Album column in the track table displays the album name

#### Scenario: Null album
- **WHEN** a track has no album metadata
- **THEN** the Album column displays an empty cell and the track is excluded from album-based search matches
