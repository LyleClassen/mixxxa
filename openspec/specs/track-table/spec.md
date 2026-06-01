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
