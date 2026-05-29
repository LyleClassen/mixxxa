# Connect Rekordbox: Playlist Sync & Explorer

## Why
The app currently loads tracks through a manual "Add Tracks" action against mock data, which doesn't reflect how DJs actually organize their music. Reading directly from the user's Rekordbox library lets them browse their real playlist structure and tracks inside the app, removing manual import friction.

## What Changes
- **BREAKING** Remove the "Add Tracks" button from the sidebar.
- Add a local SQLite database that mirrors the relevant parts of the Rekordbox schema. This is the app's own library store, giving us a safe place to (later) stage edits before pushing them back to Rekordbox.
- Add a "Sync" button to the top navigation that **pulls** the user's Rekordbox library into the local mirror DB and populates the sidebar from it. (Pull only for now — writing changes back to Rekordbox is deferred.)
- The app reads playlists and tracks from the local mirror DB (not directly from Rekordbox), so Rekordbox's own `master.db` is only touched during a Sync.
- Replace the static sidebar items with a Rekordbox-style explorer tree of the user's playlists and folders (nested).
- Selecting a playlist loads and displays that playlist's tracks in the main track list, replacing the mock track data.
- Show clear states for syncing in progress, sync errors (e.g. Rekordbox library not found), and empty playlists.

## Capabilities

### New Capabilities
- `local-library-db`: A local SQLite database (via Bun's built-in `bun:sqlite`) mirroring the relevant Rekordbox tables (playlists, playlist songs, tracks, artists, keys). Acts as the app's read source and the future staging ground for edits before push-back.
- `rekordbox-sync`: Pulling the user's Rekordbox library (`master.db` via `rbox-js`) and importing it into the local mirror DB.
- `playlist-explorer`: Sidebar explorer tree of playlists/folders and a track view that loads the selected playlist's tracks, both read from the local mirror DB.

### Modified Capabilities
- (none — no existing specs)

## Impact
- `src/shared/types.ts`: new `PlaylistNode`/`Track` DTOs; reworked `MixxxRPC` request surface.
- New `src/bun/db/` (local SQLite schema + access) and `src/bun/rpc/` (`dialogs.ts`, `rekordbox.ts`, `index.ts`) modules.
- `src/bun/index.ts`: reduced to bootstrap + composed RPC; removal of `getContents`/inline handlers.
- `src/mainview/App.tsx`: remove Add Tracks button + mock `TRACKS`; add Sync button, explorer tree, selection/loading/error state.
- Dependencies: relies on installed `rbox-js` (already present) for the Rekordbox read, and `bun:sqlite` (built in) for the local mirror DB.
- A local DB file is created in the app's data directory on first sync.
