# Implementation Tasks

## 1. Shared contracts
- [x] 1.1 Add `PlaylistNode`, `Track`, and `SyncErrorKind` types to `src/shared/types.ts`.
- [x] 1.2 Rework `MixxxRPC.bun.requests`: `openXmlFile`, `syncFromRekordbox() → PlaylistNode[]`, `getPlaylistTree() → PlaylistNode[]`, `getPlaylistTracks({ playlistId }) → Track[]`.
- [x] 1.3 Remove the stale `getContents` request and the empty `webview` block if unused.

## 2. Local mirror database (`bun:sqlite`)
- [x] 2.1 Create `src/bun/db/schema.ts` with `CREATE TABLE IF NOT EXISTS` for `playlist`, `playlist_song`, `content`, `artist`, `key`.
- [x] 2.2 Create `src/bun/db/localDb.ts`: open a `bun:sqlite` `Database` at `<appData>/mixxxa/library.db`, run schema on first open, expose typed read/write helpers, and a `close()`.
- [x] 2.3 Add read helpers: build the nested `PlaylistNode[]` tree from `playlist.parent_id`; fetch a playlist's tracks via `playlist_song` joined to `content`/`artist`/`key`.
- [x] 2.4 Add write helpers: a transactional `replaceLibrary({playlists, playlistSongs, contents, artists, keys})` (clear-then-insert) so import is idempotent and all-or-nothing.

## 3. RPC handler reorganization
- [x] 3.1 Create `src/bun/rpc/dialogs.ts` exporting `dialogsHandlers` with `openXmlFile` (moved from `index.ts`).
- [x] 3.2 Create `src/bun/rpc/rekordbox.ts` exporting `rekordboxHandlers` (`syncFromRekordbox`, `getPlaylistTree`, `getPlaylistTracks`) plus mapping helpers.
- [x] 3.3 Create `src/bun/rpc/index.ts` merging groups into `{ requests: { ...dialogsHandlers, ...rekordboxHandlers }, messages: {} }`.
- [x] 3.4 Reduce `src/bun/index.ts` to bootstrap (window, updater, dev URL) + `BrowserView.defineRPC(rpcHandlers)`; close the local DB on shutdown.

## 4. Sync (pull Rekordbox → mirror) + reads
- [x] 4.1 `syncFromRekordbox`: `MasterDb.open()`, read playlists (tree/`getPlaylists`), playlist→song mapping, contents, artists, keys; map and write into the mirror via `replaceLibrary` in one transaction; return the freshly-built tree.
- [x] 4.2 `getPlaylistTree`: read the tree from the mirror (empty tree before first sync).
- [x] 4.3 `getPlaylistTracks(playlistId)`: read from the mirror, map rows → `Track[]` (resolve artist/key via joins, convert `length` ms→s, normalize `bpm`, `null`/`""` fallbacks).
- [x] 4.4 Classify sync failures: default `master.db` path missing on disk → throw `not-found`; `open()`/read failure → `unreadable` (use `isRekordboxRunning()` to refine the locked message); attach `SyncErrorKind` to the thrown error.
- [x] 4.5 Verify whether `DjmdContent.bpm` is stored ×100 against real data and scale during import accordingly.
- [x] 4.6 Ensure Rekordbox access is read-only (no `create*`/`update*`/`delete*`/`setUnsafeWrites` calls).

## 5. Sidebar explorer UI
- [x] 5.1 Remove the "ADD TRACKS" button and `handleAddTracks` from `src/mainview/App.tsx`.
- [x] 5.2 Fully remove the static sidebar nav items (Analysis Queue, My Collection, Improve Tracks, Recently Added).
- [x] 5.3 Add a recursive playlist tree component rendering `PlaylistNode[]` with folder expand/collapse and selectable leaf playlists.

## 6. Top-nav Sync + data wiring
- [x] 6.1 Add a "Sync" button to the top navigation.
- [x] 6.2 Add `App` state: `playlistTree`, `selectedPlaylistId`, `tracks`, `syncState` (`idle | loading | ready | error`) and `syncError: SyncErrorKind | null`.
- [x] 6.3 Wire Sync → `syncFromRekordbox()`; populate sidebar; show loading state while in progress.
- [x] 6.4 On startup, load any already-synced tree via `getPlaylistTree()` so the sidebar isn't empty after a prior sync.
- [x] 6.5 Wire playlist selection → `getPlaylistTracks({ playlistId })`; render results in the track table.
- [x] 6.6 Remove the mock `TRACKS` constant and bind the table to real `tracks`.
- [x] 6.7 Add empty-playlist state and distinct sync-error messages for `not-found` vs `unreadable`.

## 7. Verification
- [x] 7.1 Type-check / build the app.
- [ ] 7.2 Run against a real Rekordbox install: click Sync, confirm the mirror populates and the tree matches Rekordbox.
- [ ] 7.3 Select multiple playlists and confirm tracks load from the mirror correctly.
- [ ] 7.4 Restart the app and confirm the previously-synced library still loads from the mirror without re-syncing.
- [ ] 7.5 Confirm `not-found` when `master.db` is absent, and `unreadable` when it cannot be opened (e.g. Rekordbox running/locked).
