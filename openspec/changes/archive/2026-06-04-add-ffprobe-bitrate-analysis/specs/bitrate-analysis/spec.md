## ADDED Requirements

### Requirement: Bitrate Measurement Via ffprobe Packet Counting
The system SHALL compute a track's true average bitrate by invoking the bundled `ffprobe` binary with packet-level inspection of the first audio stream, summing packet byte sizes and dividing by stream duration, and reporting the result in kbps as an integer.

#### Scenario: Successful bitrate measurement
- **WHEN** bitrate analysis is requested for a track whose audio file is present and readable
- **THEN** ffprobe is invoked with packet-level output for the first audio stream and the computed kbps value is returned as the analyzed bitrate

#### Scenario: ffprobe exits with non-zero code
- **WHEN** ffprobe returns a non-zero exit code for a given file
- **THEN** the bitrate aspect is marked as failed with the stderr output as the reason and no `analyzed_bitrate` value is written

#### Scenario: ffprobe produces empty packet output
- **WHEN** ffprobe exits successfully but returns no packet data
- **THEN** the bitrate aspect is marked as failed with reason "no packet data" and no value is written

#### Scenario: Missing audio file
- **WHEN** the track's audio file does not exist at the stored path
- **THEN** the bitrate aspect is marked as failed with reason "file not found" and processing continues for other tracks

### Requirement: Analyzed Bitrate Stored Separately From Metadata Bitrate
The system SHALL store the ffprobe-computed bitrate in a dedicated `analyzed_bitrate` column and SHALL NOT modify the existing `bitrate` column populated from Rekordbox or other metadata sources.

#### Scenario: Analyzed bitrate persisted without overwriting metadata
- **WHEN** bitrate analysis completes successfully for a track
- **THEN** the `analyzed_bitrate` column is updated with the computed kbps value and the `bitrate` column retains its original metadata value

#### Scenario: Partial analysis preserves prior analyzed bitrate
- **WHEN** a track is re-analyzed for aspects that do not include bitrate
- **THEN** the existing `analyzed_bitrate` value is left unchanged
