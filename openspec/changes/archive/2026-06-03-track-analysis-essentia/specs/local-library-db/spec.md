## ADDED Requirements

### Requirement: Store Analyzed Track Features
The system SHALL extend the local mirror's track storage with columns for analyzed Key, BPM, Energy (arousal), Valence (mood), Genre (including a genre confidence), an analysis status, an analyzed-at timestamp, and per-aspect plus total analysis timing. These analyzed columns SHALL be stored separately from the Rekordbox-sourced values and SHALL default to empty for tracks that have not been analyzed. The schema migration SHALL be additive and idempotent, matching the existing column-migration pattern.

#### Scenario: Migration adds analyzed columns
- **WHEN** the database is opened against a mirror that predates the analyzed columns
- **THEN** the analyzed columns are added without error and existing data is preserved

#### Scenario: Unanalyzed tracks have empty analyzed values
- **WHEN** a track has never been analyzed
- **THEN** its analyzed columns are empty/null and its Rekordbox-sourced values are unaffected

### Requirement: Expose Analyzed Values And Diff Flags
The system SHALL include the analyzed values on the track DTO returned to the view, and SHALL include per-track flags indicating whether the analyzed BPM and analyzed Key differ from the Rekordbox-sourced values. BPM comparison SHALL apply a small tolerance and Key comparison SHALL normalize values before comparing.

#### Scenario: Diff flag set on mismatch
- **WHEN** a track's analyzed BPM or Key differs from its Rekordbox-sourced value beyond the comparison tolerance
- **THEN** the corresponding diff flag on the returned track is true

#### Scenario: No diff flag when equal or unanalyzed
- **WHEN** a track's analyzed value matches the Rekordbox value within tolerance, or the track has not been analyzed for that aspect
- **THEN** the corresponding diff flag is false

### Requirement: Write Analyzed Values To Mirror
The system SHALL provide a write helper that persists a track's analyzed values, analysis status, and timings to the mirror without modifying that track's Rekordbox-sourced fields.

#### Scenario: Persist analysis result
- **WHEN** the analysis engine writes a completed result for a track
- **THEN** only the analyzed columns, timings, and analysis status/timestamp for that track are updated

### Requirement: Persist Analysis History
The system SHALL maintain an analysis history table recording each completed or failed analysis run (track, aspects, outcome, timings, finished-at), and SHALL provide helpers to read and to clear (prune) the history.

#### Scenario: Append history row
- **WHEN** an analysis run finishes
- **THEN** a history row is written with the track, aspects, outcome, timings, and finished-at timestamp

#### Scenario: Prune history
- **WHEN** the prune helper is invoked
- **THEN** all analysis history rows are removed and track-level analyzed values are unaffected
