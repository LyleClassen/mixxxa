## ADDED Requirements

### Requirement: Create Timestamped Backups
The system SHALL create timestamped backups of the Rekordbox `master.db`, including its WAL and SHM sidecar files when present, into an app-managed backups directory so a consistent snapshot can be restored later.

#### Scenario: Backup created with timestamp
- **WHEN** a backup is requested (before a write-back, or before a restore)
- **THEN** the system copies `master.db` (and any `-wal`/`-shm` sidecars) into the backups directory under a name containing a sortable timestamp

#### Scenario: Backup directory created on demand
- **WHEN** a backup is requested and the backups directory does not yet exist
- **THEN** the system creates the directory and then writes the backup

### Requirement: Configurable Backup Retention
The system SHALL retain a configurable maximum number of backups (default 10) and SHALL prune the oldest backups beyond that limit after creating a new one. The limit SHALL be editable in Settings.

#### Scenario: Oldest backups pruned
- **WHEN** a new backup is created and the number of backups exceeds the configured limit
- **THEN** the oldest backups are deleted so that at most the configured number remain

#### Scenario: Default retention
- **WHEN** the user has not changed the setting
- **THEN** the retention limit is 10

#### Scenario: Retention configurable
- **WHEN** the user changes the maximum backups value in Settings
- **THEN** subsequent pruning honors the new limit

### Requirement: List Available Backups
The system SHALL expose the list of available backups with metadata sufficient for the user to choose one, including timestamp/creation time, file size, and origin (automatic pre-write vs. pre-restore safety backup).

#### Scenario: Backups listed newest first
- **WHEN** the user opens the Restore view in Settings
- **THEN** the system lists existing backups ordered newest-first with their timestamp and size

#### Scenario: No backups present
- **WHEN** the user opens the Restore view and no backups exist
- **THEN** the system shows an empty state rather than an error

### Requirement: Restore A Backup
The system SHALL restore a user-selected backup over the live `master.db`, only after explicit confirmation, and SHALL first create a safety backup of the current `master.db` so the restore itself is reversible.

#### Scenario: Restore with confirmation
- **WHEN** the user selects a backup and confirms the restore
- **THEN** the system first backs up the current `master.db`, then overwrites the live `master.db` (and sidecars) with the selected backup

#### Scenario: Restore blocked while Rekordbox running
- **WHEN** the user attempts a restore while Rekordbox is running or the database is locked
- **THEN** the system refuses and surfaces a `locked` error instructing the user to close Rekordbox

#### Scenario: Restore without confirmation
- **WHEN** the user selects a backup but does not confirm
- **THEN** no files are overwritten
