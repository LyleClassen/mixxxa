## Why

The track table currently ships in two parallel implementations — the original `TrackTable` and a Material React Table variant (`MaterialTrackTable`) — selectable via a runtime toggle. Maintaining both doubles the surface area, and the Material variant drags in a heavy MUI/Emotion dependency stack. We want a single, lightweight table. At the same time, DJs need playlist tracks shown in their real Rekordbox order and need to drag rows to re-sequence a set.

## What Changes

- **BREAKING (UI):** Remove the classic/material mode toggle. The app always renders the original `TrackTable`. The persisted `mixxxa.trackTableMode` preference is no longer read.
- Delete `MaterialTrackTable.tsx`, the mode-switch wiring in `TrackTableSwitch.tsx`, and `muiTheme.ts`.
- Remove the `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, and `material-react-table` dependencies from `package.json`.
- Track rows in a playlist SHALL render in playlist order (the `trackNo`/`seq` sourced from `getPlaylistSongs`), which is already stored in `playlist_song.seq`.
- Add drag-to-reorder for table rows: the user drags a row to a new position to re-sequence playlist tracks.
- Persist the new order to the local library DB (`playlist_song.seq`) via a new RPC so it survives restarts. (Not written back to Rekordbox's `master.db`; a Rekordbox re-sync re-imports the original order.)
- Row reorder is enabled only for real playlists; it is disabled for the aggregate "All Tracks"/Collection view, which has no playlist sequence.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `track-table`: Adds drag-to-reorder of track rows with persisted playlist order; removes the dual classic/material rendering mode (single table only).

## Impact

- **Code:**
  - `src/mainview/features/track-table/` — remove `MaterialTrackTable.tsx`; collapse `TrackTableSwitch.tsx` (drop `material` mode, `useTrackTableMode`, `TrackTableModeToggle`); add row drag-and-drop to `TrackTable.tsx`; update `index.ts` exports.
  - `src/mainview/lib/muiTheme.ts` — delete.
  - `src/mainview/App.tsx` — drop the mode toggle + switch usage; render `TrackTable` directly; wire the reorder-persist callback.
  - `src/bun/db/localDb.ts` — add a helper to update `playlist_song.seq` for a playlist.
  - `src/bun/rpc/rekordbox.ts` + `src/shared/types.ts` (RPC schema) — add a `reorderPlaylistTracks` RPC.
- **Dependencies:** remove 5 packages (MUI, Emotion, material-react-table); lockfile regenerated.
- **Persistence:** local `library.db` only; no change to Rekordbox `master.db`.
- **Data flow:** playlist order already preserved via `ORDER BY ps.seq ASC` in `readPlaylistTracks`; no schema migration needed.
