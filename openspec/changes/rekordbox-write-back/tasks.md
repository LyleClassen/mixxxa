## 1. Shared types

- [ ] 1.1 Add `SyncErrorKind` variants `locked`, `write-failed`, `backup-failed`, `stale-diff` in [shared/types.ts](src/shared/types.ts)
- [ ] 1.2 Add `RekordboxDiff` types: per-playlist reorder summary (playlistId, name, changedCount), per-track value change (trackId, title, field, oldValue, newValue), and a captured `localUsn`
- [ ] 1.3 Add `BackupInfo` type (filename, createdAt, sizeBytes, origin: "prewrite" | "prerestore" | "manual")
- [ ] 1.4 Add a dedicated `RekordboxSyncSettings` type (`{ maxBackups: number }`, default 10) — separate from `AnalysisSettings` — and a `writeBackProgress` broadcast message type `{ phase, current, total, label }`
- [ ] 1.5 Add `getRekordboxSettings`/`setRekordboxSettings` RPC signatures (mirroring `getAnalysisSettings`/`setAnalysisSettings`) persisting to the `settings` table

## 2. Backup helpers (backend)

- [ ] 2.1 Create `src/bun/rekordboxBackup.ts` with `getBackupsDir(dataDir)` resolving/creating `<dataDir>/backups/`
- [ ] 2.2 Implement `createBackup(masterDbPath, backupsDir, origin)` copying `master.db` + `-wal`/`-shm` sidecars to a sortable-timestamp + origin filename; throw `backup-failed` on copy error
- [ ] 2.3 Implement `listBackups(backupsDir)` returning `BackupInfo[]` newest-first (stat for size/mtime, parse origin from name)
- [ ] 2.4 Implement `restoreBackup(backupFile, masterDbPath)` copying backup files over live `master.db` (+sidecars) and removing stale live sidecars not in the backup
- [ ] 2.5 Implement `pruneBackups(backupsDir, maxBackups)` deleting oldest backups beyond the limit; call it after each `createBackup`

## 3. Diff + write-back handlers (backend)

- [ ] 3.1 Create `src/bun/rpc/rekordbox-writeback.ts`; reuse `getDefaultMasterDbPath`, `makeSyncError`, and the `isRekordboxRunning`/open guards from [rekordbox.ts](src/bun/rpc/rekordbox.ts) (extract shared helpers if needed)
- [ ] 3.2 Implement `diffRekordbox`: open Rekordbox read-only, compare playlist song order (local `playlist_song.seq` vs `getPlaylistSongs` trackNo) and analyzed BPM/key vs Rekordbox `bpm`÷100 / key name; capture `getLocalUsn()`; return `RekordboxDiff`
- [ ] 3.3 Implement `writeBackToRekordbox({ confirmedDiff, selectedAspects })`: guard `isRekordboxRunning()` → `locked`; re-check `getLocalUsn()` vs captured → `stale-diff` if changed; create `prewrite` backup (abort → `backup-failed`); apply only selected aspects — ordering via `movePlaylistSongs`/`movePlaylistSong`, BPM via `updateContent` (bpm = round(analyzedBpm×100)), key via `updateContentKey`; on failure surface `write-failed`
- [ ] 3.4 Emit `rpc.send.writeBackProgress({ phase, current, total, label })` as each playlist/track is applied (wire the broadcast next to `autoCueProgress` in [index.ts](src/bun/index.ts))
- [ ] 3.5 Do NOT call `setUnsafeWrites(true)`; return a summary of what was written
- [ ] 3.6 Implement `listRekordboxBackups` and `restoreRekordboxBackup({ filename })`: guard `isRekordboxRunning()` → `locked`; create `prerestore` backup; restore selected backup; prune to `maxBackups`
- [ ] 3.7 Register the new handlers in [rpc/index.ts](src/bun/rpc/index.ts)

## 4. Frontend — write-back flow

- [ ] 4.1 Add a "Sync to Rekordbox" action near the existing sync trigger in [App.tsx](src/mainview/App.tsx) that calls `diffRekordbox`
- [ ] 4.2 Build a diff-confirmation dialog (using [dialog.tsx](src/mainview/components/ui/dialog.tsx)) listing playlist reorders and per-track BPM/key old→new, with a checkbox per changed aspect (all checked by default)
- [ ] 4.3 On confirm, call `writeBackToRekordbox` with the selected aspects; on no-diff show a "nothing to sync" state; on cancel do nothing
- [ ] 4.4 Subscribe to `writeBackProgress` and show a determinate progress bar in the dialog during the write
- [ ] 4.5 Map `locked`/`not-found`/`write-failed`/`backup-failed`/`stale-diff` errors to clear user messages (point `write-failed` at Restore; `stale-diff` prompts re-run diff)

## 5. Frontend — Restore view (Settings)

- [ ] 5.1 Add a "Rekordbox Backups / Restore" section to [SettingsPage.tsx](src/mainview/features/settings/SettingsPage.tsx) calling `listRekordboxBackups`
- [ ] 5.2 Render backups newest-first with timestamp, size, origin; empty state when none
- [ ] 5.3 Add a per-backup Restore button with a confirmation prompt that calls `restoreRekordboxBackup`; show success/error and `locked` guidance
- [ ] 5.4 Add a "Max backups to keep" numeric control (default 10) wired to `RekordboxSyncSettings.maxBackups` via `getRekordboxSettings`/`setRekordboxSettings`

## 6. Documentation

- [ ] 6.1 Update [AGENTS.md](AGENTS.md): add a "Rekordbox write-back" section stating that any new Mixxxa-side edit to a Rekordbox-mirrored field (e.g. track titles, comments, ratings, colors) MUST be wired into the write-back diff + apply path, and that any potentially long-running process MUST report progress to the user (via the `rpc.send.*Progress` broadcast pattern)

## 7. Verification

- [ ] 7.1 Manual: edit playlist order + analyze a track, run Sync to Rekordbox, confirm diff shows correct old→new with per-aspect checkboxes, verify Rekordbox updated and a `prewrite` backup exists
- [ ] 7.2 Manual: uncheck one aspect and confirm only the selected aspects are written
- [ ] 7.3 Manual: confirm a progress bar advances during a multi-item write-back
- [ ] 7.4 Manual: with Rekordbox open, confirm write-back and restore both refuse with `locked`
- [ ] 7.5 Manual: modify Rekordbox after computing a diff, then confirm → `stale-diff` and re-run prompt
- [ ] 7.6 Manual: restore a backup, verify a `prerestore` safety backup is created and live `master.db` matches the chosen backup
- [ ] 7.7 Manual: set max backups to a small number and verify oldest backups are pruned after new ones
- [ ] 7.8 Manual: run write-back with no changes → "nothing to sync", no backup, no write
