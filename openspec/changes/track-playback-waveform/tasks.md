## 1. Dependencies

- [x] 1.1 Add `wavesurfer.js` to `package.json` dependencies and install
- [x] 1.2 Verify it imports/builds under Vite in the webview (no SSR/node-only issues)

## 2. Mirror schema & sync: capture file path

- [x] 2.1 Add `file_path TEXT` column to the `content` table in `src/bun/db/schema.ts`
- [x] 2.2 In `getDb` (`src/bun/db/localDb.ts`), add an idempotent migration that `ALTER TABLE content ADD COLUMN file_path` when missing (guard via `PRAGMA table_info`)
- [x] 2.3 Extend `LibraryData.contents` and the `INSERT`/`replaceLibrary` logic to include `file_path`
- [x] 2.4 In `src/bun/rpc/rekordbox.ts`, map `DjmdContent.folderPath` into `contents[].file_path` during `syncFromRekordbox`

## 3. Mirror read: file path + correct BPM

- [x] 3.1 In `readPlaylistTracks` (`localDb.ts`), select `c.file_path` and include it as `filePath` in the returned `Track`
- [x] 3.2 Normalize BPM: return `bpm / 100` (true BPM) instead of the raw stored value
- [x] 3.3 Add `filePath: string | null` to the `Track` interface in `src/shared/types.ts`

## 4. Backend: local audio server + RPC

- [x] 4.1 Add a Range-capable `Bun.serve` on `127.0.0.1` (ephemeral port) exposing `GET /audio/:contentId`, with permissive CORS and `Accept-Ranges`/`Content-Range` handling via `Bun.file`
- [x] 4.2 Resolve `:contentId` → `file_path` from the mirror; respond 404 when the row or file is missing
- [x] 4.3 Add `getTrackAudioUrl({ trackId }): string | null` RPC handler returning `http://127.0.0.1:<port>/audio/<id>` (null when no playable file)
- [x] 4.4 Wire the handler into `rpcHandlers` (`src/bun/rpc/index.ts`) and add the request to `MixxxRPC` in `src/shared/types.ts`
- [x] 4.5 Start the audio server at boot in `src/bun/index.ts` and close it on process exit alongside `closeDb()`

## 5. Frontend: WaveformPlayer component

- [x] 5.1 Create a `WaveformPlayer` component in `src/mainview` that instantiates wavesurfer in a container ref and tears it down on unmount
- [x] 5.2 On `track` prop change, call `getTrackAudioUrl`, `wavesurfer.load(url)`; auto-play on `ready`; show a non-blocking error state when url is null or load/decode fails
- [x] 5.3 Implement play/pause toggle bound to wavesurfer state, with icon reflecting playing/paused
- [x] 5.4 Enable click/drag seeking (wavesurfer native) and confirm seek preserves play/paused state
- [x] 5.5 Add a 0–100% volume slider calling `setVolume`; persist the level in `localStorage` (`mixxxa.volume`), initializing from it on mount so it survives track loads and app restarts
- [x] 5.6 Bind current-time (from wavesurfer events) and total duration (`getDuration()`); format as mm:ss

## 6. Frontend: wire player into App and track list

- [x] 6.1 Lift `loadedTrack` state in `App.tsx`; add `onDoubleClick` to each track row to set it
- [x] 6.2 Replace the mock player section markup with `<WaveformPlayer track={loadedTrack} />`, removing the random-bars placeholder and static time/title
- [x] 6.3 Bind the player metadata panel (title, artist, key, BPM) to `loadedTrack`, using neutral placeholders for missing key/BPM
- [x] 6.4 Render the track list BPM column using the normalized `Track.bpm`

## 7. Verification

- [ ] 7.1 Run the app, sync the library, double-click a track: waveform renders and audio plays  ← ready for manual verification
- [ ] 7.2 Verify scrubbing seeks correctly (playing and paused), play/pause toggles, volume changes audible level, and the volume level is restored after closing and reopening the app
- [ ] 7.3 Verify player panel shows correct title/artist/key, true BPM, and live mm:ss current/total time
- [ ] 7.4 Verify a track with a missing/moved file shows the player error state without crashing
- [ ] 7.5 Confirm `http://127.0.0.1` audio loads under both HMR (`localhost:5173`) and built (`views://`) modes; if blocked, apply the Blob-URL fallback from design
