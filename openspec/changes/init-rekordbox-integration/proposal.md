# Change: Initialize Rekordbox integration and core music management UI

## Why
Building a music management and playlist creator Electron app (mixxxa) that works alongside Rekordbox 7. The app currently contains only a starter template. We need to establish the foundational capabilities: locating and parsing the user's Rekordbox library, displaying tracks in a Rekordbox-style table, and adding basic audio playback controls.

## What Changes
- Add a startup flow that prompts the user to locate their `rekordbox.xml` on first launch, then persists the path for subsequent launches
- Parse the Rekordbox XML collection and expose track data (title, artist, album, BPM, key, genre, duration, location)
- Display the collection in a table view similar to Rekordbox 7 with sortable columns
- Add basic audio playback (play/pause) for tracks using the file paths from the XML
- Set up shadcn BaseUI component library for consistent UI primitives
- Add Biome for linting and formatting

## Impact
- Affected specs: rekordbox-config, collection-browser, audio-playback, ui-components, dev-tooling
- Affected code: `src/bun/index.ts`, `src/mainview/App.tsx`, new modules for XML parsing, storage, and playback
- New dependencies: `fast-xml-parser` (or similar), `@base-ui-components/react`, `@biomejs/biome`
