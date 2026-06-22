## ADDED Requirements

### Requirement: Compute Diff Before Writing
The system SHALL compute a diff between the local mirror and the live Rekordbox `master.db` before performing any write, covering playlist track ordering and analyzed BPM/key promotions. The system SHALL NOT write to Rekordbox without first presenting this diff for confirmation.

#### Scenario: Diffs exist
- **WHEN** the user initiates write-back and the local mirror differs from Rekordbox
- **THEN** the system presents the changes (per-playlist reorder summaries, and per-track BPM/key changes with old vs new values) and waits for explicit confirmation before writing

#### Scenario: No diffs
- **WHEN** the user initiates write-back and the local mirror matches Rekordbox
- **THEN** the system reports that there is nothing to sync and performs no write

#### Scenario: User cancels confirmation
- **WHEN** a diff is presented and the user declines
- **THEN** the system performs no write and leaves both databases untouched

### Requirement: User Selects Which Aspects To Push
The diff confirmation SHALL present the changed aspects (playlist ordering, BPM, key) as individually selectable options, all selected by default, and write-back SHALL apply only the selected aspects.

#### Scenario: All aspects selected by default
- **WHEN** the diff is presented
- **THEN** every changed aspect is shown as a checked, toggleable option

#### Scenario: Deselected aspect is not written
- **WHEN** the user unchecks an aspect (e.g. BPM) and confirms
- **THEN** that aspect is left unchanged in Rekordbox while the remaining selected aspects are applied

### Requirement: Apply Confirmed Changes to Rekordbox
The system SHALL, only after explicit user confirmation, apply the confirmed and selected changes into the Rekordbox `master.db` using `rbox-js` write APIs, updating playlist song ordering and analyzed BPM/key on track records.

#### Scenario: Playlist reorder applied
- **WHEN** the user confirms a write-back that includes a reordered playlist
- **THEN** the song sequence positions in Rekordbox match the local order for that playlist

#### Scenario: Analyzed values applied
- **WHEN** the user confirms a write-back for a track whose analyzed BPM or key differs from Rekordbox
- **THEN** the corresponding Rekordbox track fields are updated to the analyzed values

### Requirement: Report Write Progress
Because changes are applied record-by-record, the system SHALL report incremental progress to the user during write-back, indicating how many of the total items have been applied.

#### Scenario: Progress during write
- **WHEN** a confirmed write-back is applying changes
- **THEN** the system emits progress updates (current/total and a label) that the UI displays as a determinate progress indicator

#### Scenario: Completion reported
- **WHEN** write-back finishes
- **THEN** the system reports completion with a summary of what was written

### Requirement: Detect Concurrent Rekordbox Changes
The system SHALL detect when Rekordbox has been modified between diff computation and write, and SHALL abort rather than apply against a stale diff.

#### Scenario: Rekordbox changed since diff
- **WHEN** the Rekordbox database's local update sequence number has changed since the diff was computed
- **THEN** the system aborts with a `stale-diff` error and prompts the user to re-run the diff

#### Scenario: Local update sequence respected
- **WHEN** the system writes records to Rekordbox
- **THEN** it updates them through the `rbox-js` write APIs so Rekordbox's update bookkeeping (USN / sync flags) stays consistent rather than mutating raw rows blindly

### Requirement: Backup Before Write
The system SHALL create a timestamped backup of `master.db` before the first write of a write-back operation, and SHALL abort the write if the backup cannot be created.

#### Scenario: Backup precedes write
- **WHEN** a confirmed write-back begins
- **THEN** a timestamped backup of the current `master.db` is created before any modification is made

#### Scenario: Backup failure aborts write
- **WHEN** the backup cannot be created (e.g. disk full or permission error)
- **THEN** the system aborts the write-back, makes no changes to `master.db`, and surfaces an error

### Requirement: Safe And Guarded Write Access
The system SHALL only write to Rekordbox when it is safe to do so, refusing to write while Rekordbox is running or the database is locked, and SHALL surface typed errors distinguishing the failure cases.

#### Scenario: Rekordbox running
- **WHEN** the user initiates write-back while Rekordbox is running or holds a lock on the database
- **THEN** the system refuses to write and surfaces a `locked` error instructing the user to close Rekordbox

#### Scenario: Database not found
- **WHEN** the user initiates write-back and `master.db` does not exist
- **THEN** the system surfaces a `not-found` error and performs no write

#### Scenario: Write fails mid-operation
- **WHEN** a write fails partway through applying changes
- **THEN** the system surfaces a `write-failed` error and informs the user that a pre-write backup is available to restore from

### Requirement: User-Initiated Only
The system SHALL perform write-back only as an explicit, user-initiated action and SHALL NOT write to Rekordbox automatically during pull/sync or analysis.

#### Scenario: Pull does not write
- **WHEN** the user performs a normal pull/sync from Rekordbox
- **THEN** no write-back occurs as a side effect
