## 1. Setup and Tooling
- [ ] 1.1 Install and configure Biome as dev dependency (`@biomejs/biome`)
- [ ] 1.2 Create `biome.json` configuration file with lint and format rules
- [ ] 1.3 Add `lint`, `lint:fix`, `format`, `format:check` scripts to `package.json`
- [ ] 1.4 Run Biome format on all existing source files
- [ ] 1.5 Validate: `bun run lint` passes with no errors

## 2. UI Component Library
- [ ] 2.1 Install `@base-ui-components/react` dependency
- [ ] 2.2 Create `src/mainview/components/ui/` directory for shadcn-style components
- [ ] 2.3 Implement Table component (headless with Tailwind styling)
- [ ] 2.4 Implement Button component
- [ ] 2.5 Implement Dialog component (for file browser prompt)
- [ ] 2.6 Implement Input component
- [ ] 2.7 Validate: Components render correctly in a test page

## 3. Rekordbox XML Path Resolution
- [ ] 3.1 Create `src/mainview/lib/storage.ts` for localStorage utilities
- [ ] 3.2 Implement `getRekordboxPath()` and `setRekordboxPath()` functions
- [ ] 3.3 Create `src/mainview/components/PathPrompt.tsx` — dialog prompting user to browse for rekordbox.xml
- [ ] 3.4 Integrate Electrobun file dialog via IPC from Bun process to renderer
- [ ] 3.5 Add IPC handler in `src/bun/index.ts` for opening file dialogs
- [ ] 3.6 Validate: On first launch, file dialog appears; on second launch, it does not

## 4. Rekordbox XML Parsing
- [ ] 4.1 Install `fast-xml-parser` dependency
- [ ] 4.2 Create `src/mainview/lib/rekordbox-parser.ts`
- [ ] 4.3 Implement XML parsing function that extracts COLLECTION tracks into typed objects
- [ ] 4.4 Handle URL-decoding and `file://localhost/` prefix stripping for Location paths
- [ ] 4.5 Handle missing attributes gracefully (BPM, key, genre, etc.)
- [ ] 4.6 Validate: Parser correctly extracts all track fields from a sample rekordbox.xml

## 4.1 XML Auto-Reload (5-min Polling)
- [ ] 4.1.1 Add 5-minute polling interval to watch for rekordbox.xml changes
- [ ] 4.1.2 Implement file modification time check to avoid unnecessary re-parsing
- [ ] 4.1.3 Reload collection on detected changes, preserving sort/selection state
- [ ] 4.1.4 Validate: Modifying rekordbox.xml triggers collection refresh within 5 minutes

## 5. Collection Table View
- [ ] 5.1 Create `src/mainview/components/CollectionTable.tsx`
- [ ] 5.2 Implement sortable columns: #, Title, Artist, Album, BPM, Key, Genre, Duration
- [ ] 5.3 Implement row selection with visual highlight
- [ ] 5.4 Add play indicator column (icon for currently playing track)
- [ ] 5.5 Handle empty collection state with informational message
- [ ] 5.6 Validate: Table displays tracks, sorting works, row selection works

## 6. Audio Playback
- [ ] 6.1 Create `src/mainview/lib/audio-player.ts` — wrapper around HTML5 Audio
- [ ] 6.2 Implement `play(filePath)`, `pause()`, `stop()` functions
- [ ] 6.3 Create playback state management (playing, paused, stopped, currentTrack)
- [ ] 6.4 Create `src/mainview/components/PlaybackControls.tsx` with play/pause button
- [ ] 6.5 Wire play button to selected track's resolved file path
- [ ] 6.6 Handle file-not-found errors with user-facing message
- [ ] 6.7 Validate: Selecting a track and pressing play produces audio; pause stops at position

## 7. App Integration
- [ ] 7.1 Replace boilerplate `App.tsx` with main layout: sidebar (future), collection table, playback controls
- [ ] 7.2 Wire up conditional rendering: show PathPrompt if no path stored, else show CollectionTable
- [ ] 7.3 Connect collection loading flow: path -> read XML -> parse -> display
- [ ] 7.4 Update `electrobun.config.ts` app name and identifier to "mixxxa"
- [ ] 7.5 Validate: Full app flow works end-to-end from first launch through playback

## 7.1 Large XML Performance
- [ ] 7.1.1 Test parsing with 10k+ track XML file
- [ ] 7.1.2 If UI blocks, implement chunked parsing or Web Worker
- [ ] 7.1.3 Validate: No UI freeze with large collection

## 8. Final Validation
- [ ] 8.1 Run `bun run lint` — no errors
- [ ] 8.2 Run `bun run format:check` — all files formatted
- [ ] 8.3 Run `bun run build` — production build succeeds
- [ ] 8.4 Run `bun run dev` — app launches and full flow works
