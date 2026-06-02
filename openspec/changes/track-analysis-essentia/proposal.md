## Why

Mixxxa currently mirrors whatever Key/BPM Rekordbox already computed, but DJs frequently have tracks with missing, stale, or low-confidence analysis — and Rekordbox offers no Energy, Mood, or genre intelligence. By analyzing audio ourselves with Essentia.js we can fill those gaps, surface where our analysis disagrees with Rekordbox, and lay the groundwork for re-syncing corrected values back later.

## What Changes

- Add an **audio analysis engine** with a split architecture: bundled native **`ffmpeg`** decodes audio in the Bun process, and **Essentia.js (WASM) + TF.js run in a configurable pool of renderer Web Workers**. Key and BPM are computed with Essentia DSP; Energy (arousal), Mood (valence), and Genre use bundled TensorFlow.js models (Discogs-EffNet `genre_discogs519` for genre).
- Add an **analysis queue**: right-clicking a track (or a playlist in the sidebar) opens a context menu to enqueue that track / every track in the playlist. The queue runs in the background with **pause/resume** and **cancel** controls, and shows **live per-track phase and a progress indicator**.
- Track **per-aspect analysis time** (key, bpm, energy, mood, genre, decode) and **total time**, and keep an **analysis history** with a **prune** control, to help the user tune parallelism.
- Add a **Settings page** to control analysis parallelism (worker count), choose which aspects to analyze (Key and BPM checked by default; Energy, Mood, Genre opt-in), edit the queue (remove items, move up/down), and view history/timings.
- Persist analyzed values to the local SQLite DB alongside the existing Rekordbox-sourced values, keeping both so we can compare them.
- **Highlight table cells** where our analyzed value differs from the value stored in the Rekordbox DB (e.g. BPM/Key mismatch) using a distinct color.
- Add **Energy (0–10 arousal), Mood (emoji valence), and Genre columns** to the track table (hidden by default, toggleable via the existing column menu).
- **Replace the non-functional `TUTORIALS` and `SOFTWARE` header buttons** with `ANALYSIS` (queue panel) and `SETTINGS` entry points.
- Syncing analyzed values **back** to Rekordbox is explicitly **out of scope** for this change (handled later); we only store locally and flag differences.

## Capabilities

### New Capabilities

- `track-analysis`: Split audio analysis engine — native `ffmpeg` decode in Bun feeding Essentia.js + TF.js in a renderer Web Worker pool; extracts Key, BPM (Essentia DSP) and Energy/arousal, Mood/valence, Genre (TF.js models); records per-aspect + total timing; writes results to the local DB and reports phase/progress over RPC.
- `analysis-queue`: A background job queue for analysis tasks with enqueue-from-context-menu (single track or whole playlist), persistence across restarts, live phase + progress reporting, pause / resume / cancel controls, and a retained analysis history with a prune action.
- `analysis-settings`: A settings page controlling worker parallelism, per-aspect analysis toggles (defaults: Key + BPM on), queue editing (reorder up/down, remove items), and a history/timings view.

### Modified Capabilities

- `local-library-db`: The `content` table gains columns for analyzed Key, BPM, Energy, Valence, Genre (stored separately from Rekordbox values), per-track analysis status, and per-aspect + total timing; new `analysis_history` table; new read/write helpers expose these to the view.
- `track-table`: Track rows gain a right-click context menu to enqueue analysis; new Energy (0–10), Mood (emoji), and Genre columns are added; cells where the analyzed value differs from the Rekordbox value are visually highlighted.

## Impact

- **New dependencies:** `essentia.js` (WASM core + TF.js model add-on) and `@tensorflow/tfjs` (runs in the renderer); a bundled platform **`ffmpeg`** binary for native decode in Bun; bundled model weight files (Discogs-EffNet `genre_discogs519`, arousal/valence classifiers) shipped as app resources.
- `src/bun/` — new `analysis/` module (ffmpeg decode service, queue manager, scheduler/backpressure, history + timing persistence), new RPC handlers for enqueue/queue-state/controls/settings/history and renderer worker claim/report.
- `src/bun/db/schema.ts`, `src/bun/db/localDb.ts` — schema migration for analyzed + timing columns, analysis status, and `analysis_history` table; new read/write helpers.
- `src/shared/types.ts` — `Track` gains analyzed fields + diff flags; new types for aspects, settings, queue items (with phase/progress/timings); new RPC request/message definitions.
- `src/mainview/` — Web Worker pool running Essentia.js + TF.js; row context menu in `TrackTable.tsx`, new columns + diff-highlight rendering, sidebar playlist context menu in `App.tsx`, header buttons replaced, new Settings page and Analysis queue panel (live phase/progress) + history view.
- Native `ffmpeg` decoding of arbitrary formats (MP3/AAC/WAV/AIFF/FLAC) in Bun, with PCM handed to renderer workers as transferable binary.
