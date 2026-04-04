## Context

Mixxxa is a Tauri v2 desktop application with a React 19 + Vite frontend. The project already has a working shell; this change builds the core product experience on top of it. Rekordbox 7 can export its full library as an XML file (`rekordbox.xml`) — a well-documented format containing tracks, playlists, and folders. We will read this file on the Rust side and stream the parsed collection to the frontend.

The app must feel like a premium DJ tool — dark-themed, snappy, and familiar to Rekordbox users. We use shadcn/ui for components and Tailwind CSS for styling.

## Goals / Non-Goals

**Goals:**
- One-time XML file selection prompt with persistent path storage
- Full Rekordbox XML parsing (tracks, playlists, folders) in Rust
- Navigation pane mirroring Rekordbox's left panel: All Tracks + Playlist tree
- Track listing table with key DJ metadata columns (title, artist, BPM, key, duration, genre)
- In-app audio preview via HTML5 Audio API with play/pause and volume control

**Non-Goals:**
- Writing back to Rekordbox XML or modifying the collection
- Sync / two-way integration with a running Rekordbox process
- Track analysis (waveform, BPM detection)
- Drag-and-drop playlist editing in this iteration
- Mobile / cross-platform (desktop only for now)

## Decisions

### 1. XML Parsing in Rust, not JS

**Decision:** Parse `rekordbox.xml` in Rust using `quick-xml` and return strongly typed structs over the Tauri IPC boundary.

**Rationale:** Rekordbox XML files can be very large (100k+ tracks). Rust parsing is significantly faster and avoids blocking the JS main thread. The parsed collection is serialised to JSON once and cached in Tauri state.

**Alternatives considered:** Parsing in JS with `DOMParser` — simpler but blocks UI on large files; no easy path to background processing.

### 2. Collection Stored in Tauri Managed State

**Decision:** After parsing, store the collection as `Mutex<Option<Collection>>` in Tauri managed state. Frontend fetches slices via invoke calls (`get_all_tracks`, `get_playlist_tracks`).

**Rationale:** Avoids re-parsing on every navigation action. Keeps Rust as the single source of truth.

**Alternatives considered:** Re-parsing on every request — simpler but unacceptably slow for large collections. Storing in frontend state via a single large JSON payload — works but makes incremental fetching harder.

### 3. File Path Persistence via `tauri-plugin-store`

**Decision:** Use `tauri-plugin-store` (a simple JSON key-value store) to persist the XML file path between sessions.

**Rationale:** Minimal setup, no external database. The store plugin is the idiomatic Tauri approach for lightweight settings.

**Alternatives considered:** Writing a custom config file via `tauri-plugin-fs` — more work for no benefit.

### 4. Audio Playback via HTML5 Audio API

**Decision:** Use the browser's native `HTMLAudioElement` with Tauri's asset protocol (`asset://localhost/…`) to stream local files.

**Rationale:** Native audio handling handles codec support, seeking, and buffering for free. Tauri's `convertFileSrc` helper maps absolute file paths to safe asset:// URIs.

**Alternatives considered:** Streaming audio bytes from Rust via a Tauri command — much higher complexity, no benefit for local files.

**Required capability:** `asset:` protocol must be allowed by adding `"core:asset:allow-http-asset-protocol"` to the capability config and enabling `dangerousUseHttpScheme` if needed. More simply, use `asset` as the protocol in CSP.

### 5. UI Layout

**Decision:** Three-zone layout — top bar (app title + audio player + loaded file indicator), left nav pane (~260px fixed), main content pane (flex-1). Audio player is integrated into the fixed top bar so it is always visible.

**Rationale:** The fixed top bar ensures player controls are always accessible and at the top of the visual hierarchy during browsing.

### 6. shadcn/ui + Tailwind CSS

**Decision:** Use shadcn/ui with the `new-york` style and a custom dark DJ-themed color palette.

**Rationale:** The project has no UI framework yet. shadcn/ui gives us accessible, composable primitives. `new-york` style is cleaner and more minimal than `default`.

## Risks / Trade-offs

- **Large XML files** → Parsing may take 1-3 seconds for very large collections. Mitigation: show a loading indicator; parsing runs in a Tauri async command so the UI thread is not blocked.
- **File path invalidation** → Stored path may become invalid if user moves the Rekordbox library. Mitigation: validate path on startup and re-prompt if missing.
- **Audio format support** → Rekordbox supports AIFF, MP3, WAV, FLAC, AAC. Not all formats are supported in all WebViews. Mitigation: attempt playback and surface any errors in the player UI.
- **Tauri asset protocol CSP** → Needs explicit CSP configuration to load local audio files. Mitigation: configure `tauri.conf.json` CSP to include `asset:` and `http://asset.localhost`.

## Migration Plan

This is a greenfield feature with no existing functionality to migrate. Deployment steps:

1. Add Rust dependencies to `Cargo.toml`
2. Install and register Tauri plugins
3. Update capabilities config
4. Install shadcn/ui and Tailwind CSS
5. Implement Rust commands
6. Implement React components
7. Wire together and test with a real Rekordbox XML export
