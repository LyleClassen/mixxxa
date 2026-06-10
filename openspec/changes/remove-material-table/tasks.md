## 1. Persistence layer (RPC + DB)

- [x] 1.1 Add `reorderPlaylistTracks(database, playlistId, orderedTrackIds)` to `src/bun/db/localDb.ts` that, in a single transaction, sets `playlist_song.seq` for each `content_id` in the playlist to its index in `orderedTrackIds`
- [x] 1.2 Add `reorderPlaylistTracks` to the RPC schema in `src/shared/types.ts` with params `{ playlistId: string; orderedTrackIds: string[] }` returning `void`/updated tracks
- [x] 1.3 Implement the `reorderPlaylistTracks` handler in `src/bun/rpc/rekordbox.ts` delegating to the `localDb` helper (using `getDb(dataDir)`)

## 2. Row drag-to-reorder in TrackTable

- [x] 2.1 Add an `onReorder?: (orderedTrackIds: string[]) => void` prop (and a `reorderable` flag) to `TrackTable` so the Collection view can disable reordering
- [x] 2.2 Add a drag-handle affordance per row (grip cell, shown only when `reorderable`) that initiates the drag via `setPointerCapture`, mirroring the existing column-reorder pointer pattern
- [x] 2.3 Add `rowReorderRef`, `rowDrag` state, and a vertical `computeRowDropIndex` helper using the `<tbody>` bounding rect / cumulative row heights
- [x] 2.4 Render a horizontal drop indicator between rows and a dragging visual state on the moved row
- [x] 2.5 On pointer-up over a valid target, compute the new ordered id list, call `onReorder`, and reset drag state; on Escape/pointer-cancel, abort with no change
- [x] 2.6 Ensure drag handle `stopPropagation` so row double-click and row context menu remain unaffected
- [x] 2.7 Disable the drag handle when a search filter is active (avoid ambiguous ordering over a filtered subset)

## 3. Wire reorder into App

- [x] 3.1 In `src/mainview/App.tsx`, pass `onReorder` to `TrackTable`: optimistically reorder local `tracks` state, then call `reorderPlaylistTracks` RPC; on failure, reload via `getPlaylistTracks`
- [x] 3.2 Set `reorderable` true only for real playlists (false when `selectedPlaylistId === COLLECTION_ID`)

## 4. Remove material table + switch indirection

- [x] 4.1 Delete `src/mainview/features/track-table/MaterialTrackTable.tsx`
- [x] 4.2 Delete `src/mainview/lib/muiTheme.ts`
- [x] 4.3 Remove `TrackTableSwitch`, `TrackTableModeToggle`, `useTrackTableMode`, and `TrackTableMode` from `TrackTableSwitch.tsx` (delete the file if nothing else remains)
- [x] 4.4 Update `src/mainview/features/track-table/index.ts` to export `TrackTable` and its props type only
- [x] 4.5 Update `src/mainview/App.tsx` to import and render `TrackTable` directly and remove the `TrackTableModeToggle` from the track-list header and the `tableMode` state
- [x] 4.6 Update the header comment in `columns.ts` to drop the MaterialTrackTable reference

## 5. Remove dependencies

- [x] 5.1 Remove `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, and `material-react-table` from `package.json`
- [x] 5.2 Grep `src/` for any remaining `@mui`, `@emotion`, or `material-react-table` imports and replace stray icon usage with `lucide-react`
- [x] 5.3 Run `bun install` to regenerate `bun.lock`

## 6. Verify

- [x] 6.1 Type-check / build (`vite build`) passes with no MUI/Emotion references
- [ ] 6.2 Manually verify: playlist tracks render in Rekordbox order; dragging a row reorders it; order persists across playlist switch and app restart
- [ ] 6.3 Verify the Collection / "All Tracks" view shows no drag handle and cannot be reordered
- [ ] 6.4 Verify a Rekordbox re-sync reverts a locally reordered playlist to Rekordbox order
