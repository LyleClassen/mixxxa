## Why

The app can browse Rekordbox playlists and list tracks, but the player section is entirely static mockup data (a random-bars "waveform", hardcoded "Daft Punk – Digital Love", fake BPM/key, dead transport buttons). DJs need to actually audition tracks — double-click to load and hear a track, see its real waveform, scrub, and read its true metadata — for the collection browser to be useful.

## What Changes

- Double-clicking a track in the track list loads it into the player and starts playback.
- Render the loaded track's real waveform with **wavesurfer.js**, replacing the random-bars placeholder.
- Click/drag on the waveform to seek (scrub) to any position in the track.
- Working **Play/Pause** toggle on the transport control.
- **Volume control** (slider, 0–100%) affecting playback level.
- Player metadata panel shows the **loaded track's** real title, artist, key, BPM, and duration (current time / total) — driven by actual track data and decoded audio, not mock values.
- **BPM correctness**: Rekordbox stores BPM ×100 (e.g. `12800`); the app currently surfaces the raw value. Display true BPM (e.g. `128`) in both the player panel and the track list.
- Make the loaded track's audio file available to the webview so wavesurfer can fetch and decode it, with byte-range support so seeking is responsive.
- Persist each track's absolute audio file path in the local mirror during sync (from `DjmdContent.folderPath`) so a loaded track can be located on disk.

## Capabilities

### New Capabilities
- `track-playback`: Loading a selected track into the player, decoding and rendering its waveform, transport (play/pause), scrubbing/seeking, volume control, and the live metadata/time display for the currently loaded track.

### Modified Capabilities
- `rekordbox-sync`: The pull import must also capture each track's absolute file path (`DjmdContent.folderPath` + file name) so loaded tracks can be located and played.
- `local-library-db`: The `content` mirror table and the `Track` DTO gain the track's audio file path; the `Track.bpm` field is normalized to true BPM (raw value ÷ 100) rather than the raw ×100 integer.

## Impact

- **Dependencies**: add `wavesurfer.js`.
- **Backend (`src/bun`)**: new local audio-serving endpoint (Range-capable `Bun.serve`) and an RPC handler resolving a track id to a playable URL; sync writes `file_path`; `content` schema migration; `readPlaylistTracks` returns `filePath` and normalized `bpm`.
- **Shared (`src/shared/types.ts`)**: `Track` DTO gains `filePath`; new RPC request for resolving a track's audio URL.
- **Frontend (`src/mainview/App.tsx`)**: player section rewritten to use a wavesurfer-backed player component with real transport, scrub, volume, and metadata bound to the loaded track; track rows gain double-click-to-load.
- No changes to Rekordbox itself (still read-only).
