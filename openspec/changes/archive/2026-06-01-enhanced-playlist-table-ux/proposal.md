## Why

The current playlist table is a static HTML table with hard-coded columns, no functional search, and no full-collection view — making it significantly less capable than the Rekordbox 7 interface that DJs expect. Column management, a persistent full-library view, and working multi-field search are baseline requirements for a professional DJ application.

## What Changes

- Replace the static `<table>` in `App.tsx` with a headless, configurable `TrackTable` component that supports drag-to-reorder columns, drag-to-resize columns, and per-column show/hide via a right-click context menu
- Add a "Collection" entry as the first item in the sidebar playlist tree that, when selected, loads every track in the local library — no separate panel, just a virtual playlist
- Wire the existing (currently no-op) search input to filter tracks in real time across title, artist, and album fields
- Add `album` field to the `Track` type and populate it from the existing SQLite schema

## Capabilities

### New Capabilities

- `track-table`: Configurable, interactive table component with draggable column reordering, drag-to-resize columns, right-click column context menu for show/hide, and column state persistence (order, widths, visibility) via localStorage
- `track-collection-view`: A "Collection" virtual playlist entry pinned at the top of the sidebar tree that, when selected, populates the main track table with all tracks from the local DB — behaves like any other playlist selection
- `track-search`: Multi-field real-time search filtering tracks by title, artist, and album with debounced input and case-insensitive matching

### Modified Capabilities

- None

## Impact

- `src/mainview/App.tsx` — existing table markup replaced; Collection sidebar entry added; search wired up
- `src/shared/types.ts` — `Track` type gains `album` field
- `src/bun/db/localDb.ts` — queries updated to include album in SELECT
- `src/bun/db/schema.ts` — verify album column exists; no schema migration needed (column already present in `content` table)
- No new dependencies required (drag interactions via pointer events; context menu via custom component)
