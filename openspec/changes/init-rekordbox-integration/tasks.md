## 1. Setup and Tooling
- [x] 1.1 Install and configure Biome as dev dependency (`@biomejs/biome`)
- [x] 1.2 Create `biome.json` configuration file with lint and format rules
- [x] 1.3 Add `lint`, `lint:fix`, `format`, `format:check` scripts to `package.json`
- [x] 1.4 Run Biome format on all existing source files
- [x] 1.5 Validate: `bun run lint` passes with no errors

## 2. UI Component Library
- [x] 2.1 Install `@base-ui-components/react` dependency
- [x] 2.2 Create `src/mainview/components/ui/` directory for shadcn-style components
- [x] 2.3 Implement Table component (headless with Tailwind styling)
- [x] 2.4 Implement Button component
- [x] 2.5 Implement Dialog component (for file browser prompt)
- [x] 2.6 Implement Input component
- [x] 2.7 Validate: Components render correctly in a test page

## 3. Rekordbox XML Path Resolution
- [x] 3.1 Create `src/mainview/lib/storage.ts` for localStorage utilities
- [x] 3.2 Implement `getRekordboxPath()` and `setRekordboxPath()` functions
- [x] 3.3 Create `src/mainview/components/PathPrompt.tsx` — dialog prompting user to browse for rekordbox.xml
- [x] 3.4 Integrate Electrobun file dialog via IPC from Bun process to renderer
- [x] 3.5 Add IPC handler in `src/bun/index.ts` for opening file dialogs
- [x] 3.6 Validate: On first launch, file dialog appears; on second launch, it does not

## 4. Rekordbox XML Parsing
- [x] 4.1 Install `fast-xml-parser` dependency
- [x] 4.2 Create `src/mainview/lib/rekordbox-parser.ts`
- [x] 4.3 Implement XML parsing function that extracts COLLECTION tracks into typed objects
- [x] 4.4 Handle URL-decoding and `file://localhost/` prefix stripping for Location paths
- [x] 4.5 Handle missing attributes gracefully (BPM, key, genre, etc.)
- [x] 4.6 Validate: Parser correctly extracts all track fields from a sample rekordbox.xml

## 4.1 XML Auto-Reload (5-min Polling)
- [x] 4.1.1 Add 5-minute polling interval to watch for rekordbox.xml changes
- [x] 4.1.2 Implement file modification time check to avoid unnecessary re-parses
- [x] 4.1.3 Reload collection on detected changes, preserving sort/selection state
- [x] 4.1.4 Validate: Modifying rekordbox.xml triggers collection refresh within 5 minutes

## 5. Collection Table View
- [x] 5.1 Create `src/mainview/components/CollectionTable.tsx`
- [x] 5.2 Implement sortable columns: #, Title, Artist, Album, BPM, Key, Genre, Duration
- [x] 5.3 Implement row selection with visual highlight
- [x] 5.4 Add play indicator column (icon for currently playing track)
- [x] 5.5 Handle empty collection state with informational message
- [x] 5.6 Validate: Table displays tracks, sorting works, row selection works

## 6. Audio Playback
- [x] 6.1 Create `src/mainview/lib/audio-player.ts` — wrapper around HTML5 Audio
- [x] 6.2 Implement `play(filePath)`, `pause()`, `stop()` functions
- [x] 6.3 Create playback state management (playing, paused, stopped, currentTrack)
- [x] 6.4 Create `src/mainview/components/PlaybackControls.tsx` with play/pause button
- [x] 6.5 Wire play button to selected track's resolved file path
- [x] 6.6 Handle file-not-found errors with user-facing message
- [x] 6.7 Validate: Selecting a track and pressing play produces audio; pause stops at position

## 7. App Integration
- [x] 7.1 Replace boilerplate `App.tsx` with main layout: sidebar (future), collection table, playback controls
- [x] 7.2 Wire up conditional rendering: show PathPrompt if no path stored, else show CollectionTable
- [x] 7.3 Connect collection loading flow: path -> read XML -> parse -> display
- [x] 7.4 Update `electrobun.config.ts` app name and identifier to "mixxxa"
- [x] 7.5 Validate: Full app flow works end-to-end from first launch through playback

## 7.1 Large XML Performance
- [x] 7.1.1 Test parsing with 10k+ track XML file
- [x] 7.1.2 If UI blocks, implement chunked parsing or Web Worker
- [x] 7.1.3 Validate: No UI freeze with large collection

## 8. Final Validation
- [x] 8.1 Run `bun run lint` — no errors
- [x] 8.2 Run `bun run format:check` — all files formatted
- [x] 8.3 Run `bun run build` — production build succeeds
- [x] 8.4 Run `bun run dev` — app launches and full flow works
