# Spec: analysis-settings

## Requirement: Settings Page
The system SHALL provide a settings page reachable from the application header, replacing the former Tutorials/Software placeholder buttons with Analysis and Settings entry points.

### Scenario: Open settings
- **WHEN** the user activates the Settings entry point in the header
- **THEN** the settings page is shown

### Scenario: Header no longer shows placeholders
- **WHEN** the user views the application header
- **THEN** the inert Tutorials and Software buttons are absent and Analysis and Settings entry points are present

## Requirement: Configurable Parallelism
The system SHALL let the user set the analysis parallelism (number of tracks analyzed concurrently), within a valid range, and SHALL persist this setting.

### Scenario: Change parallelism
- **WHEN** the user changes the parallelism value
- **THEN** the setting is saved and applied to subsequent dispatching, bounded to the allowed minimum and maximum

### Scenario: Parallelism persists
- **WHEN** the user restarts the application
- **THEN** the previously chosen parallelism value is restored

## Requirement: Selectable Analysis Aspects
The system SHALL let the user choose which aspects (Key, BPM, Energy, Mood, Genre) are analyzed, with BPM and Key enabled by default, and SHALL persist this selection.

### Scenario: Default selection
- **WHEN** the user opens settings for the first time
- **THEN** Key and BPM are checked and Energy, Valence, and Genre are unchecked

### Scenario: Toggle an aspect
- **WHEN** the user checks or unchecks an aspect
- **THEN** the selection is saved and used for subsequently enqueued analysis tasks

## Requirement: Queue Editor In Settings
The system SHALL present the analysis queue within the settings/analysis surface with controls to remove items, move items up or down, and pause, resume, or cancel the queue.

### Scenario: Edit queue from settings
- **WHEN** the user views the queue editor
- **THEN** each queued item is listed with controls to remove it or move it up or down, and global pause, resume, and cancel controls are available

### Scenario: Queue editor reflects live state
- **WHEN** queue items change status, phase, or progress
- **THEN** the queue editor updates to reflect the current state, showing each running item's phase and progress

## Requirement: History And Timings View
The system SHALL present a view of analysis history and timings, including per-aspect and total analysis time, to help the user tune parallelism, with a control to prune the history.

### Scenario: View timings
- **WHEN** the user opens the history/timings view
- **THEN** the view shows recorded analysis runs with their per-aspect and total durations and an aggregate total analysis time

### Scenario: Prune from settings
- **WHEN** the user activates the prune control in the history/timings view
- **THEN** the analysis history is cleared
