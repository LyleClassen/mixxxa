## Why

Audio metadata stored in Rekordbox (and other sources) can report incorrect bitrates — ripped files, transcodes, or edited tags may carry stale or fabricated values. DJs and music managers need a verifiable "true bitrate" to audit file quality, and the existing analysis pipeline offers no way to measure it.

## What Changes

- Add `bitrate` as a new analysis aspect in the track analysis system
- Implement bitrate computation via ffprobe packet counting (more accurate than container header metadata)
- Store the analyzed bitrate alongside existing analyzed columns, separate from the Rekordbox-sourced bitrate
- Expose bitrate as a selectable aspect in the analysis settings UI (opt-in, like Key/BPM/Genre)
- Surface both metadata bitrate and analyzed bitrate in the track table so differences are visible

## Capabilities

### New Capabilities

- `bitrate-analysis`: Computes a track's true bitrate by invoking the bundled `ffprobe` with packet-level inspection, aggregating packet sizes over the stream duration to derive actual average bitrate — independent of container metadata.

### Modified Capabilities

- `track-analysis`: Adding `bitrate` as a supported analysis aspect, including persistence of the analyzed value and integration into the worker-phase/progress reporting flow.

## Impact

- **Analysis system**: New aspect enum value `bitrate`; analysis worker dispatches to ffprobe subprocess rather than Essentia DSP for this aspect
- **Database**: New analyzed column `analyzed_bitrate` (integer, kbps) on the tracks table; existing `bitrate` column (from Rekordbox) is preserved untouched
- **Settings UI**: `analysis-settings` gains a bitrate toggle alongside existing aspect toggles
- **Track table**: Optional column for analyzed bitrate; cells can visually flag when analyzed vs. metadata bitrate differ significantly
- **Dependencies**: Uses the already-bundled `ffprobe` binary — no new external dependencies
