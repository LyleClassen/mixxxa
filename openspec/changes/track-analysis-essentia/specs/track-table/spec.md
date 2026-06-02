## ADDED Requirements

### Requirement: Track row context menu for analysis
The system SHALL provide a right-click context menu on individual track rows offering to analyze that track. This row context menu SHALL be distinct from the existing header column-visibility context menu.

#### Scenario: Open row context menu
- **WHEN** the user right-clicks a track row in the table body
- **THEN** a context menu appears with an option to analyze that track

#### Scenario: Enqueue track from row menu
- **WHEN** the user selects the analyze option from the row context menu
- **THEN** that track is added to the analysis queue using the currently selected aspects

#### Scenario: Header menu unaffected
- **WHEN** the user right-clicks the table header row
- **THEN** the column-visibility menu (not the row analysis menu) appears

### Requirement: Analyzed feature columns
The system SHALL add Energy, Mood, and Genre columns to the track table. Energy SHALL display the analyzed arousal value on a 0–10 scale, Mood SHALL display the analyzed valence value as an emoji, and Genre SHALL display the analyzed genre label. These columns SHALL be hideable like other non-Title columns and SHALL be hidden by default.

#### Scenario: New columns available but hidden by default
- **WHEN** the table loads with no saved configuration
- **THEN** the Energy, Mood, and Genre columns exist in the column menu but are not shown

#### Scenario: Show an analyzed column
- **WHEN** the user enables Energy, Mood, or Genre in the column menu
- **THEN** that column appears and displays the track's analyzed value (Energy as 0–10, Mood as an emoji, Genre as a label), or a neutral placeholder when not analyzed

### Requirement: Highlight cells that differ from Rekordbox
The system SHALL visually highlight a track's BPM and Key cells when the analyzed value differs from the value stored in the Rekordbox DB, using a distinct color.

#### Scenario: Highlight a differing BPM cell
- **WHEN** a track's analyzed BPM differs from its Rekordbox BPM
- **THEN** that track's BPM cell is rendered with the distinct highlight color

#### Scenario: Highlight a differing Key cell
- **WHEN** a track's analyzed Key differs from its Rekordbox Key
- **THEN** that track's Key cell is rendered with the distinct highlight color

#### Scenario: No highlight when values agree or track is unanalyzed
- **WHEN** the analyzed value matches the Rekordbox value, or the track has not been analyzed for that aspect
- **THEN** the cell is rendered normally without the highlight color
