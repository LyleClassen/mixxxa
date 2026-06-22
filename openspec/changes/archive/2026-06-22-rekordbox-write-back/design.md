## Context

Mixxxa mirrors the Rekordbox library into a local SQLite db (`library.db`) via `rbox-js` (`syncFromRekordbox` in [rekordbox.ts](src/bun/rpc/rekordbox.ts)). Today this is strictly pull-only — the `rekordbox-sync` spec explicitly forbids writes. Users can reorder playlists ([reorderPlaylistTracks](src/bun/db/localDb.ts#L258)) and re-analyze tracks (writing `analyzed_bpm`/`analyzed_key`), but those edits never reach Rekordbox.

`rbox-js` (v0.1.7) exposes write APIs on `MasterDb`: `updateContent`, `updateContentKey`, `createPlaylistSong`, `movePlaylistSong(s)`, `deletePlaylistSong`, and `setUnsafeWrites`. It also exposes `isRekordboxRunning()` and `getLocalUsn()`. The Rekordbox `master.db` is SQLCipher-encrypted; `rbox-js` holds the key, but a plain OS file copy of the encrypted blob is a valid backup.

The local mirror already retains Rekordbox's own primary-key IDs (playlist, playlist_song, content, key) and computes `bpmDiffers`/`keyDiffers` per track in [rowToTrack](src/bun/db/localDb.ts#L169). This makes a compute-on-demand diff feasible without separate dirty bookkeeping.

## Goals / Non-Goals

**Goals:**
- Let users push playlist track ordering and analyzed BPM/key back into Rekordbox, opt-in and reviewable.
- Always show a diff and require confirmation before writing.
- Always create a timestamped backup before overwriting `master.db`.
- Provide a Settings Restore view to roll back to any backup, with its own safety backup.
- Keep pull strictly read-only and unchanged.

**Non-Goals:**
- Two-way merge / conflict resolution beyond "local wins on confirmation" (Rekordbox-side edits made after the last pull are not merged; the diff shows current Rekordbox state so the user sees them).
- Writing cues/hot-cues back (local cue tracking exists via `source`/`dirty` but cue write-back is deferred to a later change).
- Creating/deleting/renaming playlists in Rekordbox (only track ordering within existing playlists in this change).
- Automatic/background write-back.

## Decisions

### Diff is computed on demand, not from a dirty log
At write-back time, re-open Rekordbox read-only and compare against the local mirror:
- **Playlist ordering**: for each non-folder playlist, compare the ordered `content_id` sequence in `playlist_song` (by `seq`) against `getPlaylistSongs(playlistId)` ordered by `trackNo`. Report playlists whose order differs.
- **Analyzed values**: for each track with a non-null `analyzed_bpm`/`analyzed_key` that differs from Rekordbox's `bpm` (÷100) / key name, report old→new.

Rationale: avoids a parallel dirty-tracking subsystem and stays correct even if the user edits both sides; the live Rekordbox read is the source of truth for "what's there now." Alternative (explicit dirty flags) was rejected as more state to keep consistent and prone to drift after re-syncs. Trade-off: diff cost is O(library) per invocation — acceptable for a manual, user-triggered action.

### Write path uses rbox-js APIs, guarded, never "unsafe"
Guard with `isRekordboxRunning()` before opening for write (mirrors the pull error handling). Apply changes via `movePlaylistSongs`/`movePlaylistSong` for ordering and `updateContent` (+ `updateContentKey` for key names) for analyzed values, so Rekordbox's USN/sync bookkeeping stays consistent. Do **not** call `setUnsafeWrites(true)` — we want the library's safety checks. BPM is written as `bpm = round(analyzedBpm * 100)` to match Rekordbox's ×100 storage.

### Backups are OS file copies in an app-managed dir
Backups live in `<dataDir>/backups/`. Each backup copies `master.db` plus any `-wal`/`-shm` sidecars. Filename encodes a sortable UTC timestamp and origin tag, e.g. `master-2026-06-22T14-30-05Z-prewrite.db` / `-prerestore.db`. Listing = read dir + `stat` for size/mtime, parse origin from the name. Rationale: encryption-agnostic, no dependency on `rbox-js` dump APIs, trivially restorable by copying back. A pre-write backup is created once per write-back operation before the first mutation; if it fails, the write aborts.

### Restore overwrites live files, after its own safety backup
Restore is guarded the same way (`isRekordboxRunning()` → `locked` error). It first creates a `prerestore` backup of the current `master.db`, then copies the selected backup's files over the live `master.db` (and sidecars, removing stale live sidecars not present in the backup). This makes restore itself reversible.

### Progress feedback for the row-by-row write
Because `rbox-js` writes one record at a time, write-back is a potentially long operation with no built-in progress. The handler emits incremental progress to the renderer over the existing broadcast channel (`rpc.send.X(...)`, as used by `autoCueProgress`/`analysisQueueUpdate` in [index.ts](src/bun/index.ts#L54) and [cues.ts](src/bun/rpc/cues.ts#L29)). A new `writeBackProgress` broadcast reports `{ phase, current, total, label }` as each playlist/track is applied, so the diff dialog can show a determinate progress bar. This is a general rule for the project — see AGENTS.md.

### User selects which aspects to push (resolved)
The diff-confirmation dialog presents the changed aspects (playlist ordering, BPM, key) as checkboxes, **all checked by default**. `writeBackToRekordbox` receives the user's selection and only applies the selected aspects. Unselected aspects are left untouched in Rekordbox.

### Backup retention (resolved)
A configurable max-backups count (default **10**) lives in a **dedicated `RekordboxSyncSettings` group**, separate from `AnalysisSettings`, with its own `getRekordboxSettings`/`setRekordboxSettings` RPC persisting to the `settings` table (mirroring the analysis-settings pattern). After each successful backup, the system prunes the oldest backups beyond the limit. Pre-restore safety backups count toward the limit. The setting is editable in the Settings Restore section.

### Concurrency guard (resolved)
Capture `getLocalUsn()` at diff time and re-check it at the start of `writeBackToRekordbox`. If it changed, Rekordbox was modified since the diff was computed — abort with a `stale-diff` error and prompt the user to re-run the diff.

### Surface area
- New backend module `src/bun/rpc/rekordbox-writeback.ts` with handlers `diffRekordbox`, `writeBackToRekordbox`, `listRekordboxBackups`, `restoreRekordboxBackup`; backup helpers in `src/bun/rekordboxBackup.ts`. Registered in [rpc/index.ts](src/bun/rpc/index.ts). `writeBackProgress` wired as a broadcast alongside `autoCueProgress` in [index.ts](src/bun/index.ts).
- New `SyncErrorKind` variants (`locked`, `write-failed`, `backup-failed`) and diff/backup result types in [shared/types.ts](src/shared/types.ts).
- Frontend: a "Sync to Rekordbox" action near the existing sync trigger in [App.tsx](src/mainview/App.tsx), a diff-confirmation dialog (reusing `components/ui/dialog.tsx`), and a Restore section added to [SettingsPage.tsx](src/mainview/features/settings/SettingsPage.tsx).

## Risks / Trade-offs

- **Partial write on mid-operation failure** → rbox-js applies row-by-row, not one transaction. Mitigation: mandatory pre-write backup + `write-failed` error that points the user to Restore.
- **WAL not checkpointed when copying** → if Rekordbox left a dirty WAL, a bare `master.db` copy could miss recent data. Mitigation: require Rekordbox closed (guarded), and always copy the `-wal`/`-shm` sidecars alongside so the snapshot is consistent.
- **Overwriting Rekordbox grid BPM** → promoting analyzed BPM replaces Rekordbox's own value. Mitigation: diff shows old→new explicitly and write is confirmation-gated; default selection can be reviewed before applying.
- **Stale diff vs. Rekordbox edited between diff and write** → small TOCTOU window. Mitigation: capture `getLocalUsn()` at diff time and re-check before applying; abort with `stale-diff` if it changed.
- **Backups consume disk** → many timestamped copies of a large db. Mitigation: configurable retention (default 10) prunes oldest backups after each new one; size is surfaced in the Restore list.
- **Long row-by-row write feels frozen** → no native progress from `rbox-js`. Mitigation: `writeBackProgress` broadcast drives a determinate progress bar in the dialog.

## Open Questions

_All resolved:_ aspect-selection checkboxes (all on by default), configurable backup retention (default 10), `getLocalUsn()` concurrency guard, and progress feedback are all adopted above.
