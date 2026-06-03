### Requirement: Configurable column visibility
The system SHALL allow the user to show or hide any individual column via a right-click context menu on the table header row. The Title column SHALL always remain visible and SHALL NOT appear as a toggleable option in the menu.

#### Scenario: Open column visibility menu
- **WHEN** the user right-clicks anywhere on the table header row
- **THEN** a context menu appears listing all columns except Title, each with a checkbox indicating current visibility

#### Scenario: Hide a visible column
- **WHEN** the user unchecks a column in the context menu
- **THEN** that column disappears from the table and the remaining columns fill the available space

#### Scenario: Show a hidden column
- **WHEN** the user checks a hidden column in the context menu
- **THEN** that column reappears at its last known position

#### Scenario: Dismiss context menu without change
- **WHEN** the user clicks outside the context menu or presses Escape
- **THEN** the menu closes and no column visibility changes

### Requirement: Drag-to-reorder columns
The system SHALL allow the user to reorder columns by dragging a column header to a new position. The drag initiates on pointer-down on the header cell and a visual indicator SHALL show the drop target position.

#### Scenario: Initiate column drag
- **WHEN** the user presses and holds the pointer on a column header and moves it horizontally
- **THEN** the column header shows a dragging visual state and a drop indicator appears between adjacent columns

#### Scenario: Complete column reorder
- **WHEN** the user releases the pointer over a valid drop position
- **THEN** the column moves to that position and the table re-renders with the new order

#### Scenario: Cancel column drag
- **WHEN** the user releases the pointer outside any valid drop zone or presses Escape during drag
- **THEN** the column returns to its original position

### Requirement: Drag-to-resize columns
The system SHALL allow the user to resize columns by dragging a resize handle at the right edge of each column header. Columns SHALL have a minimum width of 40px. The Title column width SHALL NOT be directly resizable — it SHALL fill remaining space automatically.

#### Scenario: Resize a column wider
- **WHEN** the user drags a column's right-edge resize handle to the right
- **THEN** the column width increases in real time as the pointer moves

#### Scenario: Resize a column narrower
- **WHEN** the user drags a column's right-edge resize handle to the left
- **THEN** the column width decreases but SHALL NOT go below 40px

#### Scenario: Resize handle visibility
- **WHEN** the user hovers near the right edge of a column header
- **THEN** the cursor changes to a column-resize cursor indicating the handle is active

### Requirement: Column state persistence
The system SHALL persist column order, individual column widths, and column visibility in localStorage so that preferences survive application restarts.

#### Scenario: Save column config on change
- **WHEN** the user reorders, resizes, or toggles the visibility of any column
- **THEN** the updated configuration is saved to localStorage immediately

#### Scenario: Restore column config on load
- **WHEN** the application loads and a saved column configuration exists in localStorage
- **THEN** the table renders with the saved order, widths, and visibility

#### Scenario: No saved config on first load
- **WHEN** the application loads and no saved column configuration exists
- **THEN** the table renders with the default column order, default widths, and all columns visible

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
