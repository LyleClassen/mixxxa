## Context

The current playlist view is a static HTML `<table>` inside `App.tsx` with seven hard-coded columns and no interactivity beyond double-click-to-play. Search input is rendered but not wired to any filter logic. There is no concept of a "full collection" view separate from the playlist-scoped view. The application targets DJs who are familiar with Rekordbox 7, so column management and a persistent collection view are expected features, not enhancements.

The project uses React 18 + TypeScript + Tailwind CSS 4 inside an Electrobun (Electron-like) desktop app. State is managed via `useState` in `App.tsx`. No external table library is currently present.

## Goals / Non-Goals

**Goals:**
- Introduce a reusable `TrackTable` component that supports drag-to-reorder columns, drag-to-resize column widths, and per-column show/hide toggling
- Surface column management through a right-click context menu on the header row
- Persist column order, widths, and visibility in `localStorage` so preferences survive restarts
- Add a "Collection" entry pinned at the top of the sidebar playlist tree that loads all tracks when selected — identical UX to selecting a playlist
- Wire search inputs to filter by title, artist, and album in real time with debouncing
- Add `album` to the `Track` type and backend query

**Non-Goals:**
- Virtual/windowed rendering (list sizes are <10k rows for typical DJ libraries; full render is acceptable for now)
- Server-side search or pagination
- Column sorting (click-to-sort on headers) — not in this change
- Drag-and-drop reordering of tracks between playlists

## Decisions

### 1. Custom table component rather than a headless library

**Decision**: Build `TrackTable` from scratch using pointer events for drag interactions rather than introducing TanStack Table or AG Grid.

**Rationale**: The project has no existing dependency on a table library. TanStack Table v8 is a solid choice for complex grids, but it introduces ~15 KB and a new mental model. Given the small scope (fixed columns, simple data, no virtual scrolling needed), a purpose-built component keeps the dependency tree lean and stays idiomatic with the existing codebase style.

**Alternative considered**: TanStack Table. Rejected for now to avoid scope creep, but the `TrackTable` interface is designed to be replaceable later.

### 2. Pointer events for drag interactions (not HTML5 drag API)

**Decision**: Use `onPointerDown / onPointerMove / onPointerUp` with `setPointerCapture` for both column resize and column reorder handles.

**Rationale**: The HTML5 drag-and-drop API has poor cross-platform UX (ghost images, inconsistent cursor behavior). Pointer events give pixel-accurate control, work without browser-specific hacks, and are already supported in all Chromium-based Electrobun webviews.

### 3. Column state persisted in localStorage

**Decision**: Store `{ order: string[], widths: Record<string, number>, hidden: Set<string> }` under a fixed key (`mixxxa.trackTableColumns`) in `localStorage`.

**Rationale**: No backend required. Column preferences are purely local UI state. localStorage survives restarts and is trivially writable from renderer without an RPC round-trip.

### 4. Collection view as a pinned sidebar entry, not a separate panel

**Decision**: Add a "Collection" node as the first item in the sidebar playlist tree. Selecting it calls `readAllTracks()` and populates the existing single track panel — the same way any playlist selection works. No second panel, no split layout.

**Rationale**: Rekordbox 7 puts "Collection" at the top of the left sidebar tree as a special playlist-like entry. Reusing the existing selection mechanism means zero new layout complexity — the only difference is the data source. The sidebar node is flagged with a synthetic ID (e.g., `__collection__`) so `App.tsx` can branch on it to call `readAllTracks` instead of `readPlaylistTracks`.

### 5. Album field added to Track type and backend query

**Decision**: Add `album: string | null` to `Track` in `shared/types.ts`. Update `readPlaylistTracks()` and a new `readAllTracks()` query in `localDb.ts` to JOIN/select album from the `content` table.

**Rationale**: Album is already stored in the Rekordbox SQLite schema in the `content` table. No migration is needed. It is required for album-based search.

## Risks / Trade-offs

- [Column drag on narrow columns] Resize handles overlap the cell when columns are very narrow → Mitigation: enforce a minimum column width of 40px
- [Performance on large libraries] Full re-render on every keystroke during search in large libraries could lag → Mitigation: debounce search input at 200ms; React's reconciler handles lists of <10k rows without virtualization
- [Electrobun webview pointer events] Pointer capture behavior is Chromium-based and should work, but untested on the target webview version → Mitigation: include a fallback `onMouseMove` handler in case pointer capture is unavailable

## Migration Plan

1. Extract the existing `<table>` block from `App.tsx` into `TrackTable.tsx`, preserving current behavior as a baseline
2. Add column config state and persistence
3. Add drag handles for resize and reorder
4. Add context menu for column visibility
5. Add Collection sidebar entry and `readAllTracks` RPC
6. Wire search input

No data migration required. No RPC interface changes visible to the backend beyond the new `readAllTracks` handler.

## Open Questions

- Is there a minimum set of columns that should always be visible and non-hideable (e.g., Title)? Rekordbox locks the title column — should we do the same?
