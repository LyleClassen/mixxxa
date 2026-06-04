## MODIFIED Requirements

### Requirement: Selectable Analysis Aspects
The system SHALL let the user choose which aspects (Key, BPM, Energy, Mood, Genre, Bitrate) are analyzed, with BPM and Key enabled by default, and SHALL persist this selection.

#### Scenario: Default selection
- **WHEN** the user opens settings for the first time
- **THEN** Key and BPM are checked and Energy, Valence, Genre, and Bitrate are unchecked

#### Scenario: Toggle an aspect
- **WHEN** the user checks or unchecks an aspect
- **THEN** the selection is saved and used for subsequently enqueued analysis tasks
