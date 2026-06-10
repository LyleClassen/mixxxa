## Context

The track table feature lives in `src/mainview/features/track-table/`. Today an App-level toggle (`useTrackTableMode`) chooses between the original `TrackTable` (hand-rolled `<table>` with pointer-driven column reorder/resize, localStorage column config) and `MaterialTrackTable` (Material React Table + MUI/Emotion). `TrackTableSwitch` renders whichever the mode selects, and `TrackTableModeToggle` renders the segmented control in the track-list header in `App.tsx`.

Playlist order is already correct at the data layer: `syncFromRekordbox` reads `getPlaylistSongs(playlist.id)` and stores `song.trackNo` as `playlist_song.seq`; `readPlaylistTracks` selects `ORDER BY ps.seq ASC`. What's missing is (a) a single table, (b) row drag-to-reorder, and (c) persistence of a user-chosen order back into `playlist_song.seq`.

RPC is defined via Electrobun's `RPCSchema` in `src/shared/types.ts` and implemented in `src/bun/rpc/rekordbox.ts`; the renderer calls `electroview.rpc!.request.<method>()`.

## Goals / Non-Goals

**Goals:**
- One table implementation (`TrackTable`); remove `MaterialTrackTable`, the mode toggle, and MUI/Emotion/MRT dependencies.
- Drag-to-reorder rows in a playlist, with a clear drop indicator, mirroring the existing pointer-event pattern used for column reorder.
- Persist the reordered sequence to `playlist_song.seq` in the local `library.db` via a new RPC.
- Keep playlist tracks rendered in `seq` order (already the case).

**Non-Goals:**
- Writing order changes back to Rekordbox's `master.db`.
- Reordering in the aggregate "All Tracks"/Collection view (no playlist sequence exists there).
- Multi-row drag selection, keyboard-driven reordering beyond Escape-to-cancel, or undo.
- Changing column reorder/resize/visibility behavior.

## Decisions

### Decision: Single table — delete the switch layer, keep `TrackTable`
`TrackTableSwitch.tsx` collapses to nothing useful once `material` is gone. Remove `MaterialTrackTable.tsx` and `muiTheme.ts`, delete `useTrackTableMode`/`TrackTableModeToggle`/`TrackTableSwitch`, and have `App.tsx` import and render `TrackTable` directly. Update `index.ts` to export `TrackTable` (and its props type) only.

- *Alternative considered:* keep `TrackTableSwitch` as a thin pass-through for future modes. Rejected — dead indirection; reintroduce later if a second mode is ever needed.

`columns.ts` header comment references the MRT table; update the comment but keep the column metadata (still the single source of truth for `TrackTable`).

### Decision: Row reorder via native pointer events, matching the column-reorder pattern
`TrackTable` already implements column drag with `onPointerDown`/`Move`/`Up`/`Cancel`, a `reorderRef`, a `reorderDrag` state, a `computeDropIndex` helper, and a drop-indicator `<span>`. Reuse this exact approach for rows: a `rowReorderRef`, a `rowDrag` state, a vertical `computeRowDropIndex` (cumulative row heights / `getBoundingClientRect` against the `<tbody>`), and a horizontal drop-indicator line between rows. A dedicated drag-handle cell (e.g. a grip icon column, shown only for playlists) initiates the drag so row double-click/context-menu and cell interactions are unaffected.

- *Alternative considered:* HTML5 Drag-and-Drop API (`draggable`, `dragover`). Rejected — inconsistent drop-position math, ghost-image quirks, and it diverges from the pointer-based pattern already proven in this component.
- *Alternative considered:* adopt the `tanstack-table` row-DnD recipe. Rejected for this change — `TrackTable` is intentionally headless/hand-rolled; pulling in a table lib reverses the dependency-reduction goal.

### Decision: Persist order with one transactional RPC `reorderPlaylistTracks`
Add `reorderPlaylistTracks({ playlistId, orderedTrackIds })` to the RPC schema and `rekordbox.ts`. It delegates to a new `localDb` helper that, in a single transaction, rewrites `playlist_song.seq` for that playlist so each `content_id` gets its index in `orderedTrackIds`. Sending the full ordered id list (not a from/to pair) keeps the server stateless and idempotent, and naturally normalizes `seq` to `0..n-1`.

- *Alternative considered:* send `{ trackId, newIndex }` and shift on the server. Rejected — more fragile under concurrent edits and partial state; full-list replace is simpler and self-correcting.

On the client, apply the new order optimistically to local `tracks` state, then fire the RPC; on failure, reload via the existing `getPlaylistTracks` path. Persistence is per-playlist keyed by `currentPlaylistId`.

### Decision: Dependency removal
Drop `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, and `material-react-table` from `package.json` and regenerate `bun.lock`. Replace any MUI icon used by the (now-deleted) material table with `lucide-react`, which is already a dependency, where any stray usage remains.

## Risks / Trade-offs

- **Local order diverges from Rekordbox** → By design (Non-Goal). Documented: a re-sync (`replaceLibrary`) overwrites `playlist_song`, reverting to Rekordbox order. Acceptable for now; surfacing a "modified locally" hint is a future enhancement.
- **Reorder while a search filter is active shows a subset** → Restrict the drag handle / persistence to the unfiltered playlist view, or compute the new full order by splicing the moved track relative to the filtered neighbors. Mitigation: disable row reorder when `searchQuery` is non-empty to avoid ambiguous sequencing.
- **Lingering MUI imports break the build after dep removal** → Grep for `@mui`, `@emotion`, `material-react-table` across `src/` after deletion; the type-check/build step in tasks gates completion.
- **Pointer-capture interplay between row drag and existing row double-click/context-menu** → Confine drag initiation to the dedicated handle cell and `stopPropagation` there, leaving row-level handlers intact (same isolation the resize handle already uses).

## Migration Plan

1. Add the `reorderPlaylistTracks` RPC + `localDb` helper (additive, safe).
2. Implement row drag + persistence in `TrackTable`; wire callback from `App.tsx`.
3. Remove `MaterialTrackTable`, mode toggle, switch indirection, and `muiTheme.ts`; point `App.tsx`/`index.ts` at `TrackTable`.
4. Remove the five dependencies and regenerate the lockfile; build + type-check.

Rollback: revert the branch; no DB schema change is involved (`playlist_song.seq` already exists), so no data migration to undo. Any locally reordered playlists revert on the next Rekordbox sync regardless.
