## 1. Dependencies & Assets

- [x] 1.1 Add `essentia.js` and `@tensorflow/tfjs` (renderer) to `package.json` and `bun install`
- [ ] 1.2 Add the bundled model files (Discogs-EffNet `genre_discogs519`, Essentia arousal/valence classifiers) as app resources and confirm they load in the renderer
- [ ] 1.3 Bundle a platform `ffmpeg` binary as an app resource; resolve its path at runtime; confirm it is copied into the Electrobun bundle (watch the native-asset caveats in AGENTS.md)
- [ ] 1.4 Verify Essentia WASM + TF.js load inside a renderer Web Worker (scratch smoke test)

## 2. Database Schema & Helpers

- [x] 2.1 Add analyzed columns to `content` in `schema.ts`: `analyzed_bpm`, `analyzed_key`, `analyzed_energy`, `analyzed_valence`, `analyzed_genre`, `analyzed_genre_confidence`, `analysis_status`, `analyzed_at`
- [x] 2.2 Add timing columns to `content`: `time_decode_ms`, `time_key_ms`, `time_bpm_ms`, `time_energy_ms`, `time_valence_ms`, `time_genre_ms`, `time_total_ms`
- [x] 2.3 Add `analysis_queue`, `analysis_history`, and `settings` tables to the schema
- [x] 2.4 Add idempotent `PRAGMA table_info` + `ALTER TABLE` migration for the new `content` columns in `localDb.ts` (matching existing pattern)
- [x] 2.5 Add write helper to persist a track's analyzed values + timings + status without touching Rekordbox fields
- [x] 2.6 Add history helpers: append a run row, read history (with aggregate totals), and prune (clear) history
- [x] 2.7 Update `readAllTracks` / `readPlaylistTracks` to include analyzed values and compute `bpmDiffers` / `keyDiffers` flags (BPM ±1 tolerance; normalized Key comparison)

## 3. Shared Types & RPC

- [x] 3.1 Extend `Track` in `shared/types.ts` with analyzed fields (`analyzedBpm`, `analyzedKey`, `energy`, `valence`, `genre`, `genreConfidence`) and diff flags (`bpmDiffers`, `keyDiffers`)
- [x] 3.2 Define `AnalysisAspect`, `AnalysisSettings`, `AnalysisPhase`, `QueueItem` (status + phase + progress + timings), and `HistoryEntry` types
- [x] 3.3 Add bun→view request defs: `enqueueTrack`, `enqueuePlaylist`, `getAnalysisQueue`, `pauseAnalysis`, `resumeAnalysis`, `cancelAnalysis`, `removeQueueItem`, `moveQueueItem`, `getAnalysisSettings`, `setAnalysisSettings`, `getAnalysisHistory`, `pruneAnalysisHistory`
- [x] 3.4 Add renderer→bun request defs for the worker pool: `claimAnalysisWork`, `reportAnalysisProgress`, `reportAnalysisResult`; add `analysisQueueUpdate` message (bun → view)

## 4. Decode Service & Queue (Bun)

- [x] 4.1 Implement the `ffmpeg` decode service: probe + decode to mono float PCM at the required sample rate(s); expose PCM to the renderer as transferable binary (e.g. via the local HTTP server)
- [x] 4.2 Implement `AnalysisQueue` with ordered items, statuses (`queued`/`running`/`done`/`failed`/`canceled`), phase, progress, timings, and SQLite persistence
- [x] 4.3 Implement the scheduler: dispatch up to `parallelism` items, with backpressure so decode does not outrun free workers
- [x] 4.4 Implement enqueue for a single track and for a playlist (expand to tracks, dedup queued/running)
- [x] 4.5 Implement pause / resume / cancel (cancel clears queued + aborts in-flight and discards results)
- [x] 4.6 Implement remove and move-up/move-down for queued items
- [x] 4.7 On startup, restore persisted queue (running → queued)
- [x] 4.8 Handle `claim`/`report` from renderer workers; on result, persist analyzed values + timings and append a history row; push throttled `analysisQueueUpdate` on state/phase/progress changes

## 5. Analysis Workers (Renderer)

- [x] 5.1 Create a Web Worker pool in the renderer sized by `settings.parallelism`
- [x] 5.2 In each worker, load Essentia.js (WASM) once and lazily load TF.js models when an ML aspect is needed
- [x] 5.3 Implement Key (KeyExtractor) and BPM (RhythmExtractor) via Essentia DSP, normalizing Key to the existing key vocabulary
- [x] 5.4 Implement the shared EffNet embedding pass feeding Genre (`genre_discogs519` top-1 + confidence), Energy (arousal 0..1), and Mood (valence 0..1)
- [x] 5.5 Time each phase (decode-wait, key, bpm, embedding, genre, energy, valence) and report phase + progress + timings back to Bun
- [x] 5.6 Report per-task failures with a reason; keep the worker available for the next task

## 6. Settings (Bun)

- [x] 6.1 Implement settings load/save (parallelism + selected aspects) in the `settings` table; defaults: Key+BPM on, parallelism to a sane default
- [x] 6.2 Wire `getAnalysisSettings` / `setAnalysisSettings`; apply parallelism changes to the renderer worker pool

## 7. RPC Wiring

- [x] 7.1 Add an `analysis` RPC handler module and register it in `rpc/index.ts`
- [x] 7.2 Initialize the queue/decode service in `bun/index.ts` (alongside `initRekordboxHandlers`) and tear down cleanly on exit

## 8. UI — Table & Context Menus

- [x] 8.1 Add a row right-click context menu in `TrackTable.tsx` (distinct from the header menu) with "Analyze track"
- [x] 8.2 Add Energy (0–10), Mood (emoji), and Genre columns to `DEFAULT_COLUMNS` (hidden by default) and render their cells; map valence buckets → emoji and arousal 0..1 → 0–10
- [x] 8.3 Apply a distinct highlight class to BPM/Key cells when `bpmDiffers`/`keyDiffers` is set; define the highlight color in the theme
- [x] 8.4 Add a right-click context menu to sidebar playlist nodes in `App.tsx` with "Analyze playlist"

## 9. UI — Header, Settings Page, Queue Panel & History

- [x] 9.1 Replace the `TUTORIALS`/`SOFTWARE` header buttons with `ANALYSIS` and `SETTINGS` entry points
- [x] 9.2 Build the Settings page: parallelism stepper (clamped) and aspect checkboxes wired to `get/setAnalysisSettings`
- [x] 9.3 Build the Analysis queue panel/editor: live list with status, current phase label, and progress indicator; per-item remove + move up/down; pause/resume/cancel controls
- [x] 9.4 Build the history/timings view: per-run and per-aspect durations + aggregate total time, with a prune button (`getAnalysisHistory` / `pruneAnalysisHistory`)
- [x] 9.5 Subscribe to `analysisQueueUpdate` and load initial state via `getAnalysisQueue`; refresh track rows when analysis completes

## 10. Verification

- [ ] 10.1 Verify single-track and whole-playlist enqueue from both context menus
- [ ] 10.2 Verify parallelism limit + backpressure, pause/resume, cancel, remove, and reorder behave per spec
- [ ] 10.3 Verify live phase + progress indicators update per track during analysis
- [ ] 10.4 Verify analyzed values + timings persist, diff highlight appears on mismatches, Mood renders as emoji and Energy as 0–10, and Rekordbox values are never overwritten
- [ ] 10.5 Verify history records runs/timings and the prune control clears it
- [ ] 10.6 Verify queue survives an app restart (running → queued)
- [ ] 10.7 Run `bun run dev:hmr` and confirm no bundling/native-binding regressions (ffmpeg + models resolve)
