# Mixxxa

A desktop DJ library tool that reads a Rekordbox collection, analyses the audio it points at, and writes selected results back. This file is the project's glossary — the agreed word for each concept, and the words we've decided not to use. It is not a spec: no implementation detail belongs here.

## Library

**Track**:
One piece of music in the collection. Stored in the `content` table (Rekordbox's name, kept for schema compatibility) and surfaced as `Track` everywhere above the DB layer.
_Avoid_: Song, content, item, file

**Rekordbox Library**:
The user's Pioneer Rekordbox collection — the external source of truth mixxxa imports from and can write back to. Read via the `rbox-js` native module.
_Avoid_: RB collection, the library (ambiguous with Local DB)

**Local DB**:
Mixxxa's own SQLite database (`library.db`). Mirrors the Rekordbox schema and adds mixxxa-only columns and tables. Every analysis result lands here first; reaching Rekordbox requires an explicit write-back.
_Avoid_: App DB, cache, mirror

**Write-back**:
The deliberate, user-confirmed act of pushing selected local results into the Rekordbox library. Distinct from analysis, which never touches Rekordbox.
_Avoid_: Sync, export, save

**Resync**:
Re-importing the Rekordbox library into the Local DB, e.g. after restoring a backup.
_Avoid_: Refresh, reimport

## Analysis

**Analysis Aspect**:
One thing the user opts into computing per track — key, BPM, bitrate, energy, structure, and so on. An aspect is a unit of *user intent*, not a unit of implementation: aspects differ in which engine or sidecar serves them, and how the audio reaches it.
_Avoid_: Feature, metric, attribute, analysis type

**Engine**:
The implementation that serves the bulk of the aspects — `essentia` (renderer-side WASM) or `orbit` (Python sidecar). Some aspects are engine-specific, some are engine-independent.
_Avoid_: Backend, analyzer, provider

**Sidecar**:
A frozen Python process mixxxa supervises over newline-delimited JSON on stdio. The general-purpose host for audio libraries that cannot run in Bun. Named individually — `orbit-sidecar`, `structure-sidecar` — since they ship as separate binaries with very different footprints.
_Avoid_: Worker (means the renderer-side web worker), subprocess, service, daemon

**Queue Item**:
One track's pending or in-flight analysis, carrying the set of aspects requested for it. The unit the analysis queue orders, runs, cancels and records.
_Avoid_: Job, task, run

**Phase**:
The named stage a running queue item is currently in — decoding, key, separating, persisting. What the user sees while they wait.
_Avoid_: Step, stage, state

**Parallelism**:
How many queue items may run concurrently. A user setting, not a fixed property — and some aspects are constrained below it by their own resource cost.
_Avoid_: Concurrency, thread count, workers

**Analysis Table**:
An engine's own table (`orbit_analysis`, `essentia_analysis`) holding that engine's current scalar aspect values for a track — one row per track, overwritten on every re-run. Never shared between engines, even for an aspect both can produce (e.g. both engines write their own BPM); nothing declares one engine's value "the" value for a track.
_Avoid_: Results table, output table, metrics table

**Analysis State**:
The engine-independent facts about a track's analysis pipeline — bitrate, readiness, fingerprint, waveform cache, and overall status — that belong to no single engine and so live outside any Analysis Table. One row per track, alongside the Analysis Tables rather than inside one of them.
_Avoid_: Analysis metadata, pipeline state, side table

**Analysis History**:
The append-only log of past analysis runs, one row per run rather than per track. Distinct from an Analysis Table: history answers "what happened over time," an Analysis Table answers "what is true right now."
_Avoid_: Run log, audit log

## Structure

**Segment**:
One labelled span of a track emitted by structure analysis — a start time, an end time, and one of the model's raw labels. The stored unit; segments are never merged in the database.
_Avoid_: Section (reserved — see below), part, region, block

**Section**:
Currently undecided. The model emits roughly one segment per phrase, so a user-facing "section" is likely a merged run of segments rather than one segment — but whether and how that merge happens is open. Do not use the two words interchangeably until it is settled.

**Downbeat**:
The first beat of a bar, as located by structure analysis. Persisted alongside segments; the payload most likely to matter to future mixing features.
_Avoid_: Beat marker, bar line

**Structure Version**:
The identifier that says which model and pipeline produced a track's stored structure. Structure is stale when it does not match the current version; staleness is resolved by re-running, never by patching.
_Avoid_: Schema version, revision

## Cues

**Cue**:
A user-visible marker at a point in a track. Cues live in the Rekordbox schema and are what a DJ actually jumps to.
_Avoid_: Marker, point, bookmark

**Drop**:
A high-energy moment located by the drop detector, with a confidence score. A candidate for a cue, not a cue itself, and deliberately independent of structure segments so the two can be compared.
_Avoid_: Peak, climax, hit, breakdown

**Auto-Cue**:
Placing cues automatically from detected drops, governed by per-BPM-range rules. The action; the drop detector is the machinery underneath it.
_Avoid_: Auto marker, cue generation

## Identification

**Fingerprint**:
A Chromaprint acoustic fingerprint of a track's audio — the lookup key for identification. Computed during analysis, stored locally.
_Avoid_: Hash, signature, checksum

**Identify**:
Resolving a track's real metadata by submitting its fingerprint to AcoustID and reviewing the ranked MusicBrainz candidates. Always user-reviewed; never applied silently.
_Avoid_: Match, tag, lookup, recognise

## Repository

**Internal Package**:
A workspace member that exists to organise this repo and is never published. Marked `private` in its manifest. `@mixxxa/sidecar` is the only one.
_Avoid_: Private package, local package, module

**Publishable Package**:
A workspace member intended to leave this repo and be installed by something outside it. Structurally an Internal Package without the `private` marking. None exists yet; the ability to add one is why the workspace exists.
_Avoid_: Public package, library, shared package, npm module
