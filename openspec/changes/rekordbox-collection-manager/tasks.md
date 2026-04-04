## 1. Project Setup & Dependencies

- [ ] 1.1 Install Tailwind CSS and configure `vite.config.ts` and `tailwind.config.ts` for the project
- [ ] 1.2 Initialise shadcn/ui with `npx shadcn@latest init` using `new-york` style and a dark DJ-themed palette
- [ ] 1.3 Add shadcn/ui components: `button`, `slider`, `table`, `scroll-area`, `dialog`, `tooltip`, `separator`
- [ ] 1.4 Add Rust dependencies to `src-tauri/Cargo.toml`: `quick-xml`, `serde`, `serde_json`, `tauri-plugin-dialog`, `tauri-plugin-store`, `tauri-plugin-fs`
- [ ] 1.5 Add JS dependencies: `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-fs`
- [ ] 1.6 Register all three plugins in `src-tauri/src/lib.rs` (`.plugin(tauri_plugin_dialog::init())` etc.)
- [ ] 1.7 Update `src-tauri/capabilities/default.json` to include `dialog:default`, `store:default`, `fs:default`, and `core:asset:default`
- [ ] 1.8 Update `tauri.conf.json` CSP to allow `asset:` and `http://asset.localhost` for local audio file playback

## 2. Rust Backend — Data Model & XML Parser

- [ ] 2.1 Define Rust structs: `Track` (id, title, artist, album, bpm, key, duration, genre, file_path), `Playlist` (id, name, track_ids), `Folder` (id, name, children: Vec<NavNode>), `NavNode` enum (Folder/Playlist), `Collection` (tracks: HashMap, nav_tree: Vec<NavNode>)
- [ ] 2.2 Implement `parse_rekordbox_xml(path: &str) -> Result<Collection, AppError>` using `quick-xml` — parse `<TRACK>` elements into `Track` structs
- [ ] 2.3 Extend parser to handle `<NODE>` elements for playlist folders and `<PLAYLIST>` entries, building the `nav_tree`
- [ ] 2.4 Define `AppError` enum with `#[derive(thiserror::Error)]` and implement `serde::Serialize` for IPC boundary compatibility
- [ ] 2.5 Add `AppState` struct with `Mutex<Option<Collection>>` and register it via `.manage()` in the Tauri builder

## 3. Rust Backend — Tauri Commands

- [ ] 3.1 Implement `get_stored_xml_path() -> Result<Option<String>, AppError>` — reads path from `tauri-plugin-store`
- [ ] 3.2 Implement `save_xml_path(path: String) -> Result<(), AppError>` — writes path to store
- [ ] 3.3 Implement `open_file_dialog(app: AppHandle) -> Result<Option<String>, AppError>` — opens native file picker filtered to `.xml` files using `tauri-plugin-dialog`
- [ ] 3.4 Implement `load_collection(path: String, state: State<Mutex<Option<Collection>>>) -> Result<NavTree, AppError>` — calls the parser, stores result in state, returns the nav tree for rendering
- [ ] 3.5 Implement `get_all_tracks(state: State<...>) -> Result<Vec<Track>, AppError>` — returns all tracks from cached state
- [ ] 3.6 Implement `get_playlist_tracks(playlist_id: String, state: State<...>) -> Result<Vec<Track>, AppError>` — returns tracks for a given playlist from cached state
- [ ] 3.7 Register all commands in `tauri::generate_handler![]` in `lib.rs`

## 4. Frontend — App Shell & Theme

- [ ] 4.1 Set up global CSS in `src/index.css` with dark DJ theme — deep charcoal background (`#0f0f11`), accent colour (`#6c5ce7` purple), custom scrollbar styles, and Google Font (Inter)
- [ ] 4.2 Create the three-zone app layout in `src/App.tsx`: fixed top header bar (containing the audio player controls), left nav pane (260px), main content area (flex-1)
- [ ] 4.3 Create `src/components/Header.tsx` — shows app name "mixxxa" and the currently loaded XML filename

## 5. Frontend — Collection Loader (Onboarding)

- [ ] 5.1 Create `src/components/CollectionLoader.tsx` — full-screen onboarding UI with a prominent "Select Collection" button and instructions for finding the Rekordbox XML file
- [ ] 5.2 On mount, invoke `get_stored_xml_path`; if a path is returned, immediately attempt `load_collection` and skip the onboarding screen; if the file is missing, show the onboarding with a "previous file not found" warning
- [ ] 5.3 Wire the "Select Collection" button to invoke `open_file_dialog`, then `save_xml_path` and `load_collection` on success
- [ ] 5.4 Handle cancellation (null return from dialog) — keep onboarding screen visible with a helper message

## 6. Frontend — Navigation Pane

- [ ] 6.1 Create `src/components/NavigationPane.tsx` accepting the `navTree` and `selectedView` as props, emitting `onSelectView(view: NavView)`
- [ ] 6.2 Render "All Tracks" as the first item (with a music library icon); highlight when active
- [ ] 6.3 Render the playlist tree recursively — folders with a chevron toggle (expand/collapse), playlists as leaf items with a playlist icon
- [ ] 6.4 Apply active highlight style to the currently selected nav item using shadcn/ui styling conventions

## 7. Frontend — Track Listing

- [ ] 7.1 Create `src/components/TrackListing.tsx` accepting `tracks`, `selectedTrackId`, and `onSelectTrack` props
- [ ] 7.2 Render a shadcn/ui `Table` with columns: #, Title, Artist, Album, BPM, Key, Duration (formatted as mm:ss), Genre
- [ ] 7.3 Highlight the selected track row and emit `onSelectTrack` on row click
- [ ] 7.4 Implement the empty state — centred message when the tracks array is empty
- [ ] 7.5 Wrap the table in a `ScrollArea` to handle large collections without scrolling the whole page

## 8. Frontend — Audio Player

- [ ] 8.1 Create `src/components/AudioPlayer.tsx` with a hidden `<audio>` element managed via a `useRef`
- [ ] 8.2 Use `convertFileSrc` from `@tauri-apps/api/core` to convert the track's absolute file path to an `asset://` URI for the audio src
- [ ] 8.3 Implement play/pause toggle — update `isPlaying` state and call `audioRef.current.play()` / `.pause()`
- [ ] 8.4 Implement volume slider using shadcn/ui `Slider` component, defaulting to 80%, updating `audioRef.current.volume` on change
- [ ] 8.5 Display currently loaded track title and artist; show placeholder text when no track is selected
- [ ] 8.6 Handle audio `onEnded` event to reset play state
- [ ] 8.7 Handle audio `onError` event to show an inline error message and disable the play button

## 9. Frontend — State Wiring

- [ ] 9.1 Lift collection state to `App.tsx`: `collection` (nav tree + tracks), `selectedView`, `selectedTrackId`, `currentTrack`
- [ ] 9.2 On successful `load_collection`, fetch `get_all_tracks` and store in state; switch from onboarding to main layout
- [ ] 9.3 On nav item selection, fetch `get_playlist_tracks` (or use cached all-tracks) and update the track listing
- [ ] 9.4 On track row click, set `selectedTrackId` and `currentTrack` — pass `currentTrack` down to `AudioPlayer`

## 10. Polish & Verification

- [ ] 10.1 Test with a real Rekordbox 7 XML export — verify all tracks, folders, and playlists parse correctly
- [ ] 10.2 Test audio playback for MP3, AAC, and FLAC files — surface any format-specific errors gracefully
- [ ] 10.3 Test the "missing file" path — manually delete or move the XML file and confirm the app re-prompts correctly
- [ ] 10.4 Verify keyboard accessibility: Tab navigation through nav items and track rows
- [ ] 10.5 Run `tsc --noEmit` to confirm no TypeScript errors
- [ ] 10.6 Run `cargo build` to confirm no Rust compilation errors
