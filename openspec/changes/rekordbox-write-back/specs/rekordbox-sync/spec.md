## MODIFIED Requirements

### Requirement: Read-Only Rekordbox Access
The system SHALL only read from the Rekordbox database during the pull/sync operation and SHALL NOT modify it as part of pull. Writing to Rekordbox is handled exclusively by the separate, user-initiated `rekordbox-write-back` capability and never occurs as a side effect of pull.

#### Scenario: No writes performed during pull
- **WHEN** a pull/sync runs
- **THEN** the Rekordbox `master.db` is accessed for reading only, and no Rekordbox-mutating operations are invoked

#### Scenario: Writes only via explicit write-back
- **WHEN** the Rekordbox database is modified by Mixxxa
- **THEN** the modification originates from the user-initiated write-back operation, not from a pull/sync or analysis run
