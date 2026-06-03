# Spec: track-analysis

## Requirement: Audio Analysis Engine
The system SHALL provide an audio analysis engine that decodes a track's audio file natively (using bundled `ffmpeg`) in the Bun process and extracts the requested feature set using Essentia.js running in renderer Web Workers. The engine SHALL support extracting Key, BPM, Energy (arousal), Mood (valence), and Genre.

### Scenario: Analyze a track for selected aspects
- **WHEN** the engine is asked to analyze a track for a given set of aspects
- **THEN** the audio file is decoded to PCM in Bun and handed to a worker that computes only the requested aspects, returning a result containing a value for each requested aspect

### Scenario: Key and BPM via Essentia DSP
- **WHEN** Key or BPM is requested
- **THEN** the value is computed using Essentia DSP extractors (no machine-learning model required for these two aspects)

### Scenario: Energy, Mood, and Genre via models
- **WHEN** Energy, Mood, or Genre is requested
- **THEN** the value is computed using the bundled TensorFlow.js models, with Genre using the Discogs `genre_discogs519` taxonomy and reporting a top label plus a confidence score, Energy stored as a normalized scalar, and Mood stored as a normalized valence scalar

### Scenario: Missing or unreadable audio file
- **WHEN** the track's audio file is missing or cannot be decoded
- **THEN** the engine reports a failure for that track with a reason and does not crash the analysis pipeline

## Requirement: Live Phase And Progress Reporting
The system SHALL report, for each track currently being analyzed, the active phase (e.g. decoding, key, bpm, embedding, genre, energy, valence, persisting) and a progress value, so the view can show a real-time phase label and progress indicator.

### Scenario: Phase advances during analysis
- **WHEN** an in-flight track moves from one analysis phase to the next
- **THEN** the reported phase updates accordingly and the progress value increases

### Scenario: Progress visible per track
- **WHEN** a track is being analyzed
- **THEN** the view can display that track's current phase and progress without a manual refresh

## Requirement: Per-Aspect And Total Timing
The system SHALL measure and record the time taken for each analyzed aspect (key, bpm, energy, valence, genre), the decode time, and the total analysis time for each track.

### Scenario: Record timing on completion
- **WHEN** a track's analysis completes
- **THEN** the per-aspect durations, decode time, and total time are recorded for that run

### Scenario: Timing available for tuning
- **WHEN** the user inspects analysis timings
- **THEN** per-aspect and total durations are available to inform parallelism choices

## Requirement: Parallel Worker Pool
The system SHALL run analysis tasks across a renderer Web Worker pool whose size equals the user-configured parallelism setting, processing at most that many tracks concurrently, with Bun applying backpressure so it does not decode faster than workers can consume.

### Scenario: Concurrency bounded by parallelism setting
- **WHEN** more tracks are pending than the configured parallelism
- **THEN** at most `parallelism` tracks are analyzed concurrently and the remainder wait

### Scenario: Worker isolation on failure
- **WHEN** analysis of one track fails
- **THEN** the worker remains available for subsequent tasks and other in-flight tasks are unaffected

## Requirement: Persist Analyzed Values
The system SHALL store analyzed values in the local database alongside (never overwriting) the Rekordbox-sourced values, and SHALL record when each track was last analyzed.

### Scenario: Store results without clobbering Rekordbox data
- **WHEN** a track's analysis completes successfully
- **THEN** the analyzed values are written to the track's analyzed columns and the original Rekordbox `bpm` and key remain unchanged

### Scenario: Partial aspect storage
- **WHEN** a track is analyzed for only some aspects
- **THEN** only those analyzed columns are updated and previously stored analyzed values for other aspects are preserved
