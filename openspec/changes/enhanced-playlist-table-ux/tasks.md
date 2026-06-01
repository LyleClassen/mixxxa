## 1. Data Layer — Album Field

- [ ] 1.1 Add `album: string | null` to the `Track` interface in `src/shared/types.ts`
- [ ] 1.2 Update `readPlaylistTracks()` in `src/bun/db/localDb.ts` to SELECT album from the `content` table

## 2. TrackTable Component — Base

- [ ] 2.1 Create `src/mainview/TrackTable.tsx` — extract the existing table markup from `App.tsx` into a new component accepting `tracks: Track[]` and `onTrackDoubleClick: (track: Track) => void` props
- [ ] 2.2 Define a `ColumnDef` type with `id`, `label`, `defaultWidth`, `minWidth`, `alwaysVisible` fields
- [ ] 2.3 Define the default column definitions array (cover, artist, title, album, bpm, key, length, rating)
- [ ] 2.4 Implement `useColumnConfig(storageKey: string)` hook that loads/saves `{ order, widths, hidden }` from localStorage and exposes update functions

## 3. TrackTable Component — Column Resize

- [ ] 3.1 Add resize handle element at the right edge of each resizable column header cell
- [ ] 3.2 Implement `onPointerDown` on the resize handle that initiates a resize drag using `setPointerCapture`
- [ ] 3.3 Handle `onPointerMove` to update the column width in state in real time, clamped to minWidth (40px)
- [ ] 3.4 Handle `onPointerUp` / `onPointerCancel` to commit the new width and release pointer capture
- [ ] 3.5 Set `cursor: col-resize` on the handle and suppress it from triggering column reorder drag

## 4. TrackTable Component — Column Reorder

- [ ] 4.1 Implement `onPointerDown` on column header cells (excluding the resize handle) to initiate a reorder drag
- [ ] 4.2 Track drag position and compute the target drop index based on horizontal pointer position
- [ ] 4.3 Render a visual drop indicator (vertical line) between columns at the current drop target
- [ ] 4.4 On `onPointerUp`, commit the new column order to the config; cancel on Escape or out-of-bounds release
- [ ] 4.5 Show a dragging visual state on the header being dragged (opacity / outline)

## 5. TrackTable Component — Column Visibility Context Menu

- [ ] 5.1 Create a `ColumnContextMenu` component that renders a positioned menu with checkboxes for each hideable column
- [ ] 5.2 Attach `onContextMenu` to the table header row to open the menu at the pointer position
- [ ] 5.3 Implement show/hide toggle in the menu that updates column config; exclude the Title column from the menu
- [ ] 5.4 Close the menu on outside click or Escape keydown

## 6. Track Collection View — Sidebar Entry

- [ ] 6.1 Add `readAllTracks()` query in `src/bun/db/localDb.ts` returning every track with album field
- [ ] 6.2 Register a `getAllTracks` RPC handler in `src/bun/rpc/index.ts` that calls `readAllTracks()`
- [ ] 6.3 Add `getAllTracks` to the RPC client in `src/mainview/rpc.ts`
- [ ] 6.4 Add a synthetic Collection node (id `__collection__`) to the sidebar playlist tree, rendered first with a library icon and not deletable
- [ ] 6.5 In `App.tsx`, branch on `selectedPlaylistId === '__collection__'` to call `getAllTracks` instead of `readPlaylistTracks` when loading tracks
- [ ] 6.6 Default `selectedPlaylistId` to `'__collection__'` on first load; persist and restore last selection via localStorage

## 7. Search — Wire Up and Multi-field Filter

- [ ] 7.1 Add `searchQuery` state string in `App.tsx`
- [ ] 7.2 Implement a `useDebounce(value, 200)` hook in `src/mainview/hooks/useDebounce.ts`
- [ ] 7.3 Apply debounced filter to the active `tracks` list: match title, artist, or album case-insensitively
- [ ] 7.4 Wire the existing search input to `searchQuery` state
- [ ] 7.5 Reset `searchQuery` to empty string when the user selects a different playlist or Collection
- [ ] 7.6 Show "No tracks found" empty state when a search yields zero results

## 8. Integration and Cleanup

- [ ] 8.1 Replace the inline table in `App.tsx` with `<TrackTable>`, passing `storageKey="mixxxa.trackTableColumns"`
- [ ] 8.2 Verify the Album column appears and displays data from the updated query
- [ ] 8.3 Remove dead code from `App.tsx` (old inline table markup)
- [ ] 8.4 Smoke-test column reorder, resize, and visibility toggle
- [ ] 8.5 Verify localStorage persistence: change column config, restart app, confirm config is restored
