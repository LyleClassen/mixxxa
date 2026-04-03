## Context
The app is an Electrobun + React + Tailwind + Vite desktop application. It currently ships with a boilerplate counter demo. We need to layer in Rekordbox XML integration, a collection browser UI, audio playback, shadcn BaseUI components, and Biome tooling — all as the foundational layer for future playlist creation features.

## Goals / Non-Goals
- Goals:
  - Prompt user for rekordbox.xml path on first launch, persist it
  - Parse and display the Rekordbox collection in a Rekordbox 7-style table
  - Play/pause audio tracks from the parsed collection
  - Install and configure shadcn BaseUI components
  - Install and configure Biome for linting/formatting
- Non-Goals:
  - Playlist creation/editing (future change)
  - Writing back to rekordbox.xml (future change)
  - Audio waveform visualization, cue points, or EQ (future change)
  - Master.db / encrypted SQLite support

## Decisions
- Decision: Use `fast-xml-parser` for Rekordbox XML parsing — it is fast, pure-JS, and works well in both Bun and browser contexts
- Decision: Persist the rekordbox.xml path using `localStorage` (simple, sufficient for single-user desktop app)
- Decision: Use HTML5 `<audio>` element via a React-managed ref for playback — no native audio library needed for basic play/pause
- Decision: Use shadcn BaseUI (headless primitives) styled with Tailwind — matches the existing Tailwind setup and gives accessible, composable components
- Decision: Use Biome over ESLint + Prettier — single tool, faster, covers both linting and formatting
- Decision: Rekordbox XML Location attribute uses `file://localhost/` prefix; strip this prefix to get a usable local file path

## Risks / Trade-offs
- Risk: Rekordbox XML can be very large (10k+ tracks) — synchronous parsing may block the UI
  - Mitigation: Parse in a Web Worker or use `requestIdleCallback` / chunked parsing for large files
- Risk: File paths in XML may point to disconnected drives or missing files
  - Mitigation: Validate file existence before playback; show a warning icon for missing tracks
- Risk: shadcn BaseUI is relatively new and may have limited docs
  - Mitigation: Start with a small subset of components (Table, Button, Dialog, Input); fall back to plain Tailwind if needed
- Risk: Electron/Bun file system access from renderer is restricted
  - Mitigation: Use Electrobun's IPC mechanism to read file paths and stream audio metadata from the Bun process

## Migration Plan
Not applicable — this is a greenfield project with no existing users.

## Open Questions
- ~~Should the app watch the rekordbox.xml for changes and auto-reload the collection?~~ → **Yes**, implement 5-minute polling interval
- ~~Should we support both Rekordbox 6 (master.db) and Rekordbox 7 XML exports, or only XML?~~ → **Rekordbox 7 XML only** for MVP
