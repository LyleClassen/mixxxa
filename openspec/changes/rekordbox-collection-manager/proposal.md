## Why

DJs using Rekordbox 7 need a companion tool to browse, manage, and prepare their music collections and playlists outside of Rekordbox's walled garden. Mixxxa provides a native desktop interface that reads the Rekordbox XML export format, letting users visually explore their collection, build playlists, and preview tracks without needing to open Rekordbox.

## What Changes

- **New**: On first launch, prompt user to select their Rekordbox collection XML file via a native file picker dialog
- **New**: Persist the selected XML file path in local app storage so users are not re-prompted on subsequent launches (unless the file is missing)
- **New**: Parse the Rekordbox XML into an in-memory collection model (tracks, playlists, folders)
- **New**: Left navigation pane displaying the full collection tree (All Tracks, Playlists folder hierarchy)
- **New**: Main track listing pane showing track metadata (title, artist, album, BPM, key, duration, genre)
- **New**: In-app audio player with play/pause toggle and volume control for selected tracks
- **New**: Track selection interaction that loads the selected track into the audio player

## Capabilities

### New Capabilities

- `xml-collection-loader`: Handles locating, loading, and parsing the Rekordbox XML collection file. Manages file path persistence via Tauri store plugin. Emits parsed collection data to the frontend.
- `collection-browser`: Navigation pane UI displaying the collection hierarchy (All Tracks, playlists organized in folders). Allows the user to switch between views.
- `track-listing`: Main content pane rendering a table of tracks for the currently selected collection view, with columns for key metadata fields.
- `audio-player`: In-app audio playback controls (play/pause, volume slider) for the currently selected track. Uses the HTML5 Audio API with the track's file path resolved via Tauri asset protocol.

### Modified Capabilities

- None

## Impact

- **Frontend**: New React components — `CollectionLoader`, `NavigationPane`, `TrackListing`, `AudioPlayer` — all built with shadcn/ui and Tailwind CSS
- **Backend (Rust/Tauri)**: New Tauri commands for `open_file_dialog`, `load_collection`, `get_stored_xml_path`, `save_xml_path`. XML parsing handled in Rust using `quick-xml` crate.
- **Tauri Plugins**: `tauri-plugin-dialog` (file picker), `tauri-plugin-store` (path persistence), `tauri-plugin-fs` (file reading)
- **Tauri Capabilities**: Must add `dialog:default`, `store:default`, `fs:default` to capability config
- **Dependencies**: Add `quick-xml` and `serde` to Cargo.toml; add shadcn/ui, Tailwind CSS, and required shadcn components to the frontend
