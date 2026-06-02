## Context

Mixxxa is an Electrobun app: a Bun process (`src/bun/`) hosts native/IO logic and exposes RPC to a React WebView (`src/mainview/`). Library data is mirrored from Rekordbox's `master.db` into a local SQLite DB (`library.db`) via `rbox-js`, and the WebView reads tracks/playlists exclusively from that mirror. An HTTP audio server already streams track files to the WebView for waveform playback.

Today the only track features are the Rekordbox-sourced Key and BPM. There is no facility to compute our own analysis, no background job system, and the header's `TUTORIALS` / `SOFTWARE` buttons are inert placeholders.

This change adds local audio analysis. Decoding is done natively with a bundled `ffmpeg` in the Bun process; the MIR analysis is powered by Essentia.js (WASM) plus pre-trained TensorFlow.js models (Discogs-EffNet for 519-class genre, arousal/valence classifiers) that consume Essentia-extracted embeddings, running in a pool of Web Workers in the renderer. Analysis is CPU-heavy and long-running, so it runs off the main UI thread (in workers), is throttled by a user-controlled degree of parallelism, and reports phase/progress/timing back to the view.

## Goals / Non-Goals

**Goals:**

- Compute Key, BPM, Energy (arousal), Mood (valence), and Genre for tracks on demand, from individual tracks or whole playlists via a right-click context menu.
- Decode audio natively with bundled `ffmpeg` in Bun and run Essentia.js analysis in a renderer Web Worker pool whose size the user controls.
- Provide a persistent, editable analysis queue with pause/resume and cancel, live per-item phase + progress indicators, and per-aspect timing.
- Keep an analysis history (with timings) for tuning parallelism, with a manual prune control.
- Display Mood as an emoji and Energy/Arousal on a 0–10 scale.
- Store analyzed values in the local DB *alongside* the Rekordbox values (never overwriting them) so the two can be compared.
- Surface disagreements: highlight table cells where the analyzed value differs from the Rekordbox value.
- Let the user choose which aspects to analyze; default Key + BPM on, Energy/Valence/Genre off.

**Non-Goals:**

- Writing analyzed values back into Rekordbox's `master.db` (a later change).
- Re-analyzing automatically on sync or on import; analysis is always user-initiated.
- Cue-point / structural (intro/outro) detection, stems, or key-change-over-time.
- Editing analyzed values by hand.

## Decisions

### D1: Split architecture — native decode in Bun, Essentia analysis in renderer Web Workers

Work is split across the two processes by what each is best at:

- **Bun main process** owns the persistent queue (SQLite), decodes audio with **bundled native `ffmpeg`** (format probe + decode → mono float PCM), persists results/timings/history, and is the source of truth for queue state and settings.
- **WebView (renderer)** hosts a pool of **Web Workers** running **Essentia.js (WASM) + TF.js** that perform the actual MIR analysis. Pool size = `settings.parallelism`.

The renderer's worker pool pulls dispatched items from Bun; Bun decodes each track and hands the PCM to a free worker; the worker runs the extractors and reports phase/progress/timings back, and the final features are persisted by Bun.

- **Why:** `ffmpeg` is the most reliable, fastest decoder for the long tail of formats, and decoding is the part that genuinely benefits from native code. The MIR algorithms are already vectorized C++ compiled to WASM; the ~2–4× WASM overhead is acceptable, and running them in the renderer keeps many analyses parallel without blocking Bun's IO/RPC. The persistent queue staying in Bun means in-flight work is recoverable across view reloads.
- **Alternatives considered:** Essentia in a Bun worker pool (original plan) — rejected per updated direction; simpler process model but loses the renderer parallelism the user wants and couples decode+analysis. Decoding in the renderer via Web Audio — rejected; less format coverage than `ffmpeg` and slower.

### D2: Audio decoding to PCM with bundled ffmpeg

Bun shells out to a **bundled `ffmpeg`** to probe format and decode each track to mono float PCM, resampled per consumer (44.1 kHz for DSP Key/BPM extractors, 16 kHz for the TF embedding/model path). The decoded PCM is handed to a renderer worker as a transferable `ArrayBuffer` (served as a binary blob via the existing local HTTP server, or posted directly), avoiding a costly JSON round-trip.

- **Why:** `ffmpeg` handles MP3/AAC/WAV/AIFF/FLAC and obscure variants reliably; sample-level access is required by Essentia.
- **Trade-off:** PCM is large (~50 MB for a 5-min 44.1 kHz mono track), so transfer uses transferables/binary, not RPC JSON. Decode failures mark the item `failed` with a reason and never crash a worker.

### D3: Feature extraction mapping

- **Key** → Essentia `KeyExtractor` (DSP), output normalized to the same Camelot/musical-key string vocabulary already used in the `key` table where possible.
- **BPM** → Essentia `RhythmExtractor2013` / `PercivalBpmEstimator` (DSP), stored as true BPM (float), mirroring the existing ×100 normalization convention on read where relevant.
- **Genre** → Discogs-EffNet `genre_discogs519` TF.js model on Essentia embeddings; store the top-1 label (and confidence) — 519-class taxonomy.
- **Energy (Arousal)** → Essentia arousal/energy model; store a normalized 0..1 scalar internally, **displayed on a 0–10 scale**.
- **Mood (Valence)** → Essentia valence model; store a normalized 0..1 scalar internally, **displayed as an emoji** mapped from valence buckets (e.g. 😢 → 😐 → 🙂 → 😄).
- **Why:** These are the canonical Essentia pipelines; the TF models require the EffNet embedding step, so genre/energy/mood share one embedding pass and are computed together when multiple are selected. Storing raw 0..1 keeps the underlying value precise; the 0–10 and emoji forms are presentation only.

### D4: Schema — analyzed columns stored separately

Add nullable columns to `content`: `analyzed_bpm REAL`, `analyzed_key TEXT`, `analyzed_energy REAL` (arousal, 0..1), `analyzed_valence REAL` (mood, 0..1), `analyzed_genre TEXT`, `analyzed_genre_confidence REAL`, `analysis_status TEXT`, `analyzed_at INTEGER`, plus per-aspect timing columns `time_key_ms`, `time_bpm_ms`, `time_energy_ms`, `time_valence_ms`, `time_genre_ms`, `time_decode_ms`, and `time_total_ms`. Migration is additive and idempotent (matching the existing `PRAGMA table_info` + `ALTER TABLE` pattern in `localDb.ts`). Rekordbox-sourced `bpm`/`key_id` are never modified.

- **Why:** Keeping both copies is required to compute and display the diff highlight, and to support a future Rekordbox write-back.
- **Diff computation:** The read helpers compute boolean diff flags (`bpmDiffers`, `keyDiffers`) by comparing the analyzed value to the Rekordbox value with a tolerance (BPM within ±1 considered equal; Key compared as normalized strings). Flags are carried on the `Track` DTO so the table can highlight without re-deriving rules in the view.

### D5: Queue model and lifecycle

The authoritative `AnalysisQueue` lives in **Bun** and owns an ordered list of items `{ id, trackId, aspects, status, phase, progress, timings, error }` where `status ∈ {queued, running, done, failed, canceled}` and `phase ∈ {decoding, key, bpm, embedding, genre, energy, valence, persisting}`. It is persisted in a SQLite table (`analysis_queue`) so it survives restarts (running items revert to `queued` on load). The Bun scheduler dispatches `queued` items up to the parallelism limit and decodes each track; the **renderer worker pool executes** the extractors and streams phase/progress/timing back. Bun applies backpressure so it never decodes faster than free workers can consume.

- **Controls:** `pause` (stop dispatching new items; in-flight items finish), `resume`, `cancel` (clear queued items + signal in-flight to abort), per-item `remove` and `move up/down` (only meaningful for `queued` items). Controls are issued to Bun (source of truth) and reflected to the renderer.
- **Enqueue:** single track, or expand a playlist id into one item per contained track (dedup tracks already `queued`/`running`). Aspects come from current settings.
- **Reporting:** Bun pushes `analysisQueueUpdate` RPC *messages* to the WebView on every state/phase/progress transition (throttled), plus a `getAnalysisQueue` request for initial load. The renderer reports each worker's phase/progress/per-aspect timing up to Bun via a request (e.g. `reportAnalysisProgress` / `reportAnalysisResult`).

### D6: RPC surface

New requests: `enqueueTrack`, `enqueuePlaylist`, `getAnalysisQueue`, `pauseAnalysis`, `resumeAnalysis`, `cancelAnalysis`, `removeQueueItem`, `moveQueueItem`, `getAnalysisSettings`, `setAnalysisSettings`, `getAnalysisHistory`, `pruneAnalysisHistory`, plus renderer→bun `claimAnalysisWork` / `reportAnalysisProgress` / `reportAnalysisResult` for the worker pool. New message: `analysisQueueUpdate` (bun → webview). Settings persist in a small `settings` table (or JSON file in userData).

### D8: Phase tracking, per-aspect timing, and analysis history

Each worker reports the **current phase** (decode, key, bpm, embedding, genre, energy, valence, persist) and a **0..1 progress** value for the active item, surfaced live in the queue UI as a labelled progress indicator. Each phase is timed; per-aspect durations (`time_*_ms`), decode time, and `time_total_ms` are persisted on `content` (latest run) and appended to an `analysis_history` table (one row per completed/failed run: trackId, aspects, status, timings, finished_at). The history powers a totals view (total analysis time, average per aspect) to help the user tune parallelism, and is retained until explicitly pruned.

- **Why:** Real-time phase + progress gives the user insight into long runs; per-aspect timing is the data needed to reason about parallelism; keeping history (rather than discarding completed items) is an explicit requirement.
- **Prune:** a `pruneAnalysisHistory` action clears the history table; current queue items are unaffected.

### D7: UI surface

- Header `TUTORIALS`/`SOFTWARE` replaced with `ANALYSIS` (toggles a queue panel) and `SETTINGS` (opens the settings view).
- `TrackTable` rows get an `onContextMenu` row menu — distinct from the existing header column menu — with "Analyze track" (and, when invoked from a playlist context, "Analyze playlist"). Sidebar playlist nodes in `App.tsx` get a parallel right-click menu to "Analyze playlist".
- New columns `energy`, `valence`, `genre` added to `DEFAULT_COLUMNS` (hidden by default via the existing config). Cells for `bpm`/`key` render a highlight class when the corresponding diff flag is set.
- Settings page: parallelism stepper, aspect checkboxes (Key+BPM default on), and a queue editor list with up/down/remove and pause/resume/cancel buttons.

## Risks / Trade-offs

- **[Model bundle size — Discogs-EffNet + mood models are large (100s of MB) and slow first-load]** → Load models lazily (only when an ML aspect is selected) and once per worker; ship as app resources; document size in README. Key/BPM-only analysis pays no model cost.
- **[Large PCM transfer between Bun and renderer workers]** → Use transferable `ArrayBuffer`s / binary over the local HTTP server rather than RPC JSON; decode at the lowest sample rate each consumer needs; free buffers promptly after extraction.
- **[Bundling a native `ffmpeg` binary per platform]** → Ship the platform `ffmpeg` as an app resource and resolve its path at runtime; mirror the native-asset bundling caution in AGENTS.md; treat a missing/incompatible binary as a clear startup-surfaced error.
- **[Worker pool starvation / memory pressure at high parallelism]** → Clamp parallelism to a sane max; each renderer worker holds its own WASM+model copy, so memory scales with pool size — surface a guidance note in settings, and use the recorded per-aspect timings to inform a sensible default.
- **[Essentia key/genre vocabularies differ from Rekordbox's]** → Normalize Key to the existing key vocabulary for comparison; store Genre as Essentia's own label (no Rekordbox genre to diff against in this change).
- **[Long queue + frequent progress messages flood RPC]** → Throttle `analysisQueueUpdate` (e.g. coalesce to ~4/sec) and send compact deltas.
- **[Aborting in-flight WASM work is not cleanly interruptible]** → `cancel` marks intent and drops the result on completion; workers check the abort flag at pipeline boundaries (after decode, after each extractor) rather than mid-algorithm.

## Migration Plan

1. Additive, idempotent SQLite migration in `getDb()` — new nullable columns + timing columns on `content`, plus new `analysis_queue`, `analysis_history`, and `settings` tables. No data backfill; analyzed columns start `NULL`.
2. Ship new dependencies (`essentia.js`, `@tensorflow/tfjs`), the model resource files, and the platform `ffmpeg` binary; verify bundling under Electrobun (mirror the `rbox-js` native-asset caution in AGENTS.md).
3. Feature is purely additive to the UI; no behavior changes for users who never trigger analysis. Rollback = revert code; the extra nullable columns are inert if unused.

## Open Questions

- Exact source/packaging of the bundled `ffmpeg` binaries per platform and their licensing footprint.
- Emoji set and valence→emoji bucket thresholds; arousal 0..1 → 0–10 rounding (e.g. nearest integer vs one decimal).
- How long to retain `analysis_history` before suggesting a prune (manual prune is supported; auto-prune TBD).
