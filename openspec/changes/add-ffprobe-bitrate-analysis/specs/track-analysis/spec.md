## MODIFIED Requirements

### Requirement: Audio Analysis Engine
The system SHALL provide an audio analysis engine that decodes a track's audio file natively (using bundled `ffmpeg`) in the Bun process and extracts the requested feature set using Essentia.js running in renderer Web Workers. The engine SHALL support extracting Key, BPM, Energy (arousal), Mood (valence), Genre, and Bitrate.

#### Scenario: Analyze a track for selected aspects
- **WHEN** the engine is asked to analyze a track for a given set of aspects
- **THEN** the audio file is decoded to PCM in Bun and handed to a worker that computes only the requested aspects, returning a result containing a value for each requested aspect

#### Scenario: Key and BPM via Essentia DSP
- **WHEN** Key or BPM is requested
- **THEN** the value is computed using Essentia DSP extractors (no machine-learning model required for these two aspects)

#### Scenario: Energy, Mood, and Genre via models
- **WHEN** Energy, Mood, or Genre is requested
- **THEN** the value is computed using the bundled TensorFlow.js models, with Genre using the Discogs `genre_discogs519` taxonomy and reporting a top label plus a confidence score, Energy stored as a normalized scalar, and Mood stored as a normalized valence scalar

#### Scenario: Bitrate via ffprobe packet counting
- **WHEN** Bitrate is requested
- **THEN** the bundled `ffprobe` binary is invoked via Bun subprocess with packet-level inspection of the first audio stream and the computed average kbps value is returned without PCM decoding

#### Scenario: Missing or unreadable audio file
- **WHEN** the track's audio file is missing or cannot be decoded
- **THEN** the engine reports a failure for that track with a reason and does not crash the analysis pipeline
