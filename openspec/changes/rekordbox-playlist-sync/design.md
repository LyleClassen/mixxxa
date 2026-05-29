# Connect Rekordbox: Playlist Sync & Explorer - Technical Design

## Context
The app is an Electrobun (Bun backend + React webview) desktop application. The Bun process (`src/bun/index.ts`) already depends on `rbox-js`, which reads the Rekordbox `master.db` SQLite database. RPC between the Bun backend and the React webview is defined via `MixxxRPC` in `src/shared/types.ts` and consumed in `src/mainview/App.tsx`.

We want our own library store rather than reading Rekordbox live on every interaction: a local SQLite DB that mirrors the relevant Rekordbox tables. "Sync" pulls Rekordbox into this mirror; the app reads from the mirror. This isolates the app from Rekordbox's DB during normal use and sets up a safe place to stage user edits before writing them back to Rekordbox later (push-back is out of scope here).

`rbox-js` exposes a `MasterDb` class whose query methods are **instance** methods. `MasterDb.open()` is a static factory returning an opened instance (the existing code already does `const db = MasterDb.open(); db.getPlaylistTree()`):
- `static MasterDb.open(): MasterDb` — open the platform-default `master.db`. (`new MasterDb(path)` / `MasterDb.fromOptions(opts)` for a custom path / options.)
- `db.getPlaylistTree(): DjmdPlaylistTreeNode[]` — nested tree; each node has `{ id, name, attribute: PlaylistType, smartList?, children }`.
- `db.getPlaylistContents(playlistId): DjmdContent[]` — tracks in a playlist.
- `db.getContents(): DjmdContent[]` — all tracks; `db.getArtists()`, `db.getKeys()` — lookup tables.
- `db.getArtistById(id)`, `db.getKeyById(id)` — resolve FK id strings to records with a `.name`.

There is **no `close()` method** on `MasterDb`. `DjmdContent` stores artist/key/album/genre as foreign-key id strings (`artistId`, `keyId`, …), not resolved names. Numeric fields: `bpm?` (integer; may be stored ×100 — verify and scale during implementation), `length?` (milliseconds), `rating?`. `DjmdPlaylistTreeNode.attribute` is a `PlaylistType` enum: `List = 0`, `Folder = 1`, `Smart = 4`. The top-level `isRekordboxRunning()` helper informs the "locked" case.

The local mirror uses Bun's built-in `bun:sqlite` (no new dependency).

## Goals / Non-Goals
**Goals**
- Maintain a local SQLite mirror of the relevant Rekordbox library data.
- "Sync" pulls (imports) the Rekordbox library into the local mirror.
- Render the playlist/folder tree in the sidebar from the local mirror.
- Load a selected playlist's tracks (from the mirror) into the track table.
- Surface loading / error / empty states.
- Remove the "Add Tracks" button and its `getContents` flow from the UI.

**Non-Goals**
- Writing changes back to the Rekordbox database (push-back) — deferred to a later change.
- Editing the local mirror from the UI — this change only pulls and reads.
- A full 1:1 mirror of every Rekordbox table; mirror only what playlists + tracks need now, designed to extend.
- Full track metadata enrichment (cue points, energy, waveform analysis) — placeholders for now.
- Live/automatic re-sync or file watching; sync is user-initiated.

## Decisions

### 1. Local SQLite mirror via `bun:sqlite`
The local DB lives at a stable path in the app's data directory (e.g. `<appData>/mixxxa/library.db`). A `src/bun/db/` module owns it:
- `schema.ts` — `CREATE TABLE IF NOT EXISTS` statements for the mirrored tables.
- `index.ts` (or `localDb.ts`) — opens the `bun:sqlite` `Database`, runs schema migrations on first open, exposes typed read/write helpers, and (unlike `rbox-js`) can be `close()`d.

Mirrored tables (subset, names mirror Rekordbox for familiarity; columns trimmed to what we use now):
- `playlist(id TEXT PK, name TEXT, attribute INTEGER, parent_id TEXT, seq INTEGER, smart_list TEXT)`
- `playlist_song(id TEXT PK, playlist_id TEXT, content_id TEXT, seq INTEGER)`
- `content(id TEXT PK, title TEXT, artist_id TEXT, key_id TEXT, bpm INTEGER, length INTEGER, rating INTEGER)`
- `artist(id TEXT PK, name TEXT)`
- `key(id TEXT PK, name TEXT)`

The tree is reconstructed from `playlist.parent_id`; tracks for a playlist come from `playlist_song` joined to `content` (+ `artist`/`key`). This keeps the door open to add columns/tables incrementally and, later, to track local edits (e.g. a dirty/`rb_local_*` flag) for push-back.

### 2. Sync = pull Rekordbox → mirror, transactionally
The Sync handler:
1. Opens Rekordbox via `MasterDb.open()` (read-only; see Decision 7 for error classification).
2. Reads playlists (`getPlaylistTree`/`getPlaylists`), the playlist→song mapping, contents, artists, keys.
3. Writes them into the local mirror inside a single transaction, replacing prior contents (clear-then-insert, or upsert) so a sync is idempotent and never leaves a half-populated DB.

This "full refresh" is simple and correct for pull-only. Incremental/diff sync (needed once we track local edits) is deferred. Because `MasterDb` has no `close()`, the import opens it, reads, and lets the handle be GC'd; the **local** DB is the long-lived handle the app uses.

### 3. App reads from the mirror, not Rekordbox
After a sync, `getPlaylistTree` and `getPlaylistTracks` query the **local mirror**, never `rbox-js`. Rekordbox is touched only during sync. This is what makes future local edits safe and keeps reads fast/offline.

### 4. Organize RPC handlers into per-domain modules
Today every handler is defined inline in the single `BrowserView.defineRPC` call in `src/bun/index.ts`, mixing concerns and growing unboundedly. Restructure so each handler group lives in its own module and `index.ts` just composes them:

```
src/bun/
  index.ts            // window bootstrap + defineRPC(rpcHandlers)
  db/
    schema.ts         // local SQLite schema / migrations
    localDb.ts        // bun:sqlite handle + typed read/write helpers
  rpc/
    index.ts          // merges handler groups into { requests, messages }
    dialogs.ts        // common OS actions: file dialogs (openXmlFile + future)
    rekordbox.ts      // sync (rbox-js → mirror) + reads (mirror → DTOs)
```

- Each module exports a plain object of request handlers (e.g. `export const rekordboxHandlers = { syncFromRekordbox, getPlaylistTree, getPlaylistTracks }`).
- `rpc/index.ts` spreads the groups: `{ requests: { ...dialogsHandlers, ...rekordboxHandlers }, messages: {} }`.
- `index.ts` imports that and passes it to `defineRPC`, keeping bootstrap (window, updater, dev URL) separate from handler logic.
- The rbox→mirror import mapping and the mirror→DTO mapping live in `rekordbox.ts`/`localDb.ts` so the webview stays presentation-only.

Adding a new RPC action becomes "drop a handler into the right domain file" rather than editing one growing object.

### 5. RPC surface
Define backend request handlers in `MixxxRPC.bun.requests`:
- `syncFromRekordbox(): Promise<PlaylistNode[]>` — pull Rekordbox into the mirror, then return the freshly-built tree (one round trip for the Sync button).
- `getPlaylistTree(): Promise<PlaylistNode[]>` — read the tree from the mirror (for reloads without re-importing).
- `getPlaylistTracks(playlistId: string): Promise<Track[]>` — read a playlist's tracks from the mirror.
- `openXmlFile(): Promise<string | null>` — retained common dialog action (moved to `dialogs.ts`).

Replace the loose response types with shared DTO types (`PlaylistNode`, `Track`) in `src/shared/types.ts`. The stale `getContents` entry and the empty `webview` RPC block are cleaned up.

### 6. Mapping to UI DTOs
On **import** (rbox → mirror), `DjmdContent` rows are stored with their FK ids intact (artist_id, key_id) plus the `artist`/`key` lookup tables, so resolution happens at read time against the mirror. On **read** (mirror → DTO), each content row maps to a `Track`:
- `title` ← `content.title ?? ""`
- `artist` ← joined `artist.name ?? ""`
- `key` ← joined `key.name ?? ""`
- `bpm` ← stored bpm normalized (scale ÷100 if Rekordbox stores ×100, decided at import), else `null`
- `length` ← `length != null ? Math.round(length / 1000) : null` (ms → s)
- `rating` ← `rating ?? null`

The tree maps mirror `playlist` rows → app `PlaylistNode` recursively via `parent_id`, deriving `isFolder` from `attribute === PlaylistType.Folder` (smart lists `4` are selectable leaves).

### 7. Distinguish sync error kinds
Classified so the UI can give actionable feedback:
- `not-found` — the Rekordbox `master.db` does not exist (Rekordbox not installed / never run). Message points the user at installing/opening Rekordbox.
- `unreadable` — the file exists but cannot be opened/read (locked by a running Rekordbox, encrypted, or corrupt). Message suggests closing Rekordbox and retrying.

Since there is no `exists()` probe on `MasterDb`, the handler derives the default `master.db` path and checks the file directly (`node:fs`/`Bun.file().exists()`) before opening. Absent file → `not-found`. Exists but `MasterDb.open()`/read throws → `unreadable`, with `isRekordboxRunning()` refining the "likely locked" message. The handler attaches the `SyncErrorKind` to the thrown error so the webview can branch. (If an explicit path probe isn't readily available, fall back to attempting `MasterDb.open()` and classifying by the thrown error + `isRekordboxRunning()`.)

### 8. Sidebar explorer + App state
A recursive tree component renders `PlaylistNode[]`: folders expand/collapse; leaf playlists are selectable and trigger `getPlaylistTracks`. `App` holds `playlistTree`, `selectedPlaylistId`, `tracks`, `syncState` (`idle | loading | ready | error`), and `syncError: SyncErrorKind | null`. "Sync" calls `syncFromRekordbox`; selecting a playlist calls `getPlaylistTracks`. The mock `TRACKS` constant and the static sidebar items (Analysis Queue, My Collection, Improve Tracks, Recently Added) are removed entirely.

## Data Flow
```mermaid
sequenceDiagram
    participant UI as React (App.tsx)
    participant Bun as Bun backend (rekordbox.ts)
    participant RB as Rekordbox master.db (rbox-js)
    participant Mirror as Local mirror (bun:sqlite)

    UI->>Bun: Sync clicked → syncFromRekordbox()
    Bun->>RB: MasterDb.open() + read playlists/contents/artists/keys
    RB-->>Bun: rows
    Bun->>Mirror: BEGIN; clear; insert rows; COMMIT
    Bun->>Mirror: read playlist tree
    Mirror-->>Bun: playlist rows
    Bun-->>UI: PlaylistNode[]  (render sidebar)

    UI->>Bun: select playlist → getPlaylistTracks(id)
    Bun->>Mirror: SELECT tracks JOIN artist/key
    Mirror-->>Bun: rows
    Bun-->>UI: Track[]  (render table)
```

## Interface Contracts
```ts
// src/shared/types.ts
export interface PlaylistNode {
  id: string;
  name: string;
  isFolder: boolean;       // attribute === PlaylistType.Folder
  children: PlaylistNode[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;          // "" when unknown
  bpm: number | null;
  key: string;             // key label, "" when unknown
  length: number | null;   // seconds
  rating: number | null;
}

export type SyncErrorKind = "not-found" | "unreadable";

export type MixxxRPC = {
  bun: RPCSchema<{
    requests: {
      openXmlFile: { params: undefined; response: string | null };
      syncFromRekordbox: { params: undefined; response: PlaylistNode[] };
      getPlaylistTree: { params: undefined; response: PlaylistNode[] };
      getPlaylistTracks: { params: { playlistId: string }; response: Track[] };
    };
    messages: {};
  }>;
  webview: RPCSchema<{ requests: {}; messages: {} }>;
};
```

## Risks / Trade-offs
- **Mirror schema drift:** the mirror is a hand-picked subset; adding features means extending schema + import. Mitigated by `CREATE TABLE IF NOT EXISTS` + additive migrations, and by mirroring Rekordbox column semantics where practical.
- **Full-refresh sync loses local state:** clear-then-insert is fine while the app is read-only, but once we stage local edits a full refresh would clobber them. Incremental/merge sync is explicitly deferred to the push-back change; noted so we don't paint ourselves in.
- **Rekordbox DB encryption / location:** `MasterDb.open()` uses the platform default path; custom path/key is out of scope. Encrypted-DB open failure surfaces as `unreadable`.
- **No `close()` on `MasterDb`:** the rbox handle can't be closed; we keep its use confined to the sync import and rely on GC. The long-lived handle the app holds is the **local** `bun:sqlite` DB (which we do close on shutdown).
- **BPM scaling unknown:** Rekordbox `bpm` may be stored ×100; decide scaling at import against real data.
- **Large libraries:** import reads all contents synchronously via `rbox-js`; acceptable for now, batching/virtualization deferred.

## Migration Plan
1. Extend shared types (`PlaylistNode`, `Track`, `SyncErrorKind`, reworked `MixxxRPC`).
2. Add `src/bun/db/` (schema + `bun:sqlite` mirror with read/write helpers).
3. Split backend handlers into `src/bun/rpc/{dialogs,rekordbox,index}.ts`; implement `syncFromRekordbox` (import) and mirror-backed `getPlaylistTree`/`getPlaylistTracks`; reduce `index.ts` to bootstrap + `defineRPC(rpcHandlers)`.
4. Update `App.tsx`: remove Add Tracks + mock TRACKS, fully replace static sidebar items, add Sync button + explorer tree, wire selection and error/loading/empty states.
5. Verify against a real Rekordbox install: sync populates the mirror, tree/tracks render from the mirror, and `not-found`/`unreadable` states behave.

## Open Questions
_(resolved)_
- Sync errors are distinguished as `not-found` vs `unreadable` — see Decision 7.
- The static sidebar items are fully replaced by the explorer tree — see Decision 8.
- Local mirror is the app's read source; Rekordbox is pull-only this change; push-back deferred — see Decisions 1–3.
