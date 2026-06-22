## Why

Today Mixxxa is pull-only: it mirrors the Rekordbox library locally and lets users re-analyze tracks and reorder playlists, but those changes are stranded in the local mirror — there is no way to get them back into Rekordbox. Users need their analysis results and playlist ordering reflected in Rekordbox so the work is actually usable on their gear. Writing to `master.db` is risky, so write-back must be opt-in, reviewable diff-first, and fully reversible.

## What Changes

- Add an opt-in **write-back** flow that applies local changes (playlist track ordering, and analyzed BPM/key) back into the Rekordbox `master.db` via `rbox-js` write APIs.
- Before any write, **compute a diff** between the local mirror and the live Rekordbox database and present it to the user; nothing is written without explicit confirmation. If there are no diffs, tell the user and write nothing. The diff dialog presents each changed aspect (ordering, BPM, key) as a **checkbox, all selected by default**, so the user controls what gets pushed.
- Because writes are applied record-by-record, **report incremental progress** to the user during write-back (and detect concurrent Rekordbox changes via the local update sequence number, aborting on a stale diff).
- Before the first write of a session, create a **timestamped backup** of `master.db` (and its WAL/SHM sidecars) into an app-managed backups directory. Reuse Rekordbox's "is it running / locked" guards already used by the pull path.
- Add a **Restore** view in Settings that lists timestamped backups (with date, size, origin) and lets the user restore one over the live `master.db`, with a confirmation prompt. Restoring also creates a safety backup of the current state first. Backup **retention is configurable (default 10)**; oldest backups are pruned after each new one.
- Surface clear, typed errors (Rekordbox running/locked, db not found/unreadable, write failed mid-apply, stale diff) so the UI can guide the user.
- **BREAKING** (spec-level): the `rekordbox-sync` capability is no longer strictly read-only. Its read-only guarantee is narrowed to the *pull* operation; a new, separate write operation is introduced.

## Capabilities

### New Capabilities
- `rekordbox-write-back`: Diff the local mirror against live Rekordbox, present changes for confirmation, and apply confirmed changes (playlist ordering, analyzed BPM/key) into `master.db` safely and atomically.
- `rekordbox-backup-restore`: Create timestamped backups of `master.db` before destructive operations, list existing backups, and restore a chosen backup over the live database.

### Modified Capabilities
- `rekordbox-sync`: The "Read-Only Rekordbox Access" requirement is scoped to the pull operation only; pull remains read-only, while write-back is a distinct, explicitly user-initiated operation.

## Impact

- **Backend (`src/bun/`)**: new RPC handlers in `src/bun/rpc/rekordbox.ts` (or a new `rekordbox-writeback.ts`) for `diffRekordbox`, `writeBackToRekordbox`, `listRekordboxBackups`, `restoreRekordboxBackup`; new backup helpers (file copy of `master.db` + WAL/SHM). Uses `rbox-js` write APIs (`movePlaylistSongs`, `updateContent`/`updateContentKey`, `setUnsafeWrites`).
- **Local DB (`src/bun/db/`)**: add dirty/diff tracking so write-back knows what changed (playlist song order, analyzed values promoted to Rekordbox fields).
- **Frontend (`src/mainview/`)**: a write-back trigger + diff-confirmation dialog, and a new Restore section in `features/settings/SettingsPage.tsx`.
- **Shared types (`src/shared/types.ts`)**: diff result, backup metadata, a `writeBackProgress` broadcast message, a dedicated `RekordboxSyncSettings` group (with `maxBackups`, default 10) plus its `getRekordboxSettings`/`setRekordboxSettings` RPC, and new `SyncErrorKind` variants (`locked`, `write-failed`, `backup-failed`, `stale-diff`).
- **Filesystem**: a new `backups/` directory under the app data dir holding timestamped `master.db` copies.
