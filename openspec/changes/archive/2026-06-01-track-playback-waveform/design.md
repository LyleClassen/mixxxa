## Context

Mixxxa is an Electrobun app: a Bun backend (`src/bun`) and a React/Vite webview (`src/mainview`) communicating over Electrobun's typed RPC bridge (`MixxxRPC` in `src/shared/types.ts`). The webview is loaded from `views://mainview/index.html` in production and `http://localhost:5173` under HMR.

Today the player section in `App.tsx` is pure mockup: random-height bars for a "waveform", a hardcoded title/key/BPM, a static `00:00 / 04:00`, and transport buttons with no handlers. The local mirror (`content` table) stores `title, artist_id, key_id, bpm, length, rating` but **not** the audio file path, so there is no way to locate a track on disk. BPM is stored as Rekordbox's raw integer, which is the true BPM ×100 (`DjmdContent.bpm`, e.g. `12800`), and is shown unscaled in the track list.

`rbox-js`'s `MasterDb.getContents()` returns `DjmdContent[]`, which exposes `folderPath` (the absolute file path) and `length` (milliseconds). That gives us the file location at sync time.

## Goals / Non-Goals

**Goals:**
- Double-click a track → load + play it, with a real wavesurfer.js waveform.
- Click/drag the waveform to seek; responsive (no full re-download per seek).
- Play/pause toggle and a 0–100% volume control.
- Player panel shows the loaded track's real title/artist/key/BPM and a live mm:ss current/total time.
- Correct BPM everywhere (player panel and track list).

**Non-Goals:**
- Cue points, hot cues, the Camelot wheel, the virtual piano, beat-grid/tempo sync (left as existing mock UI).
- Editing or writing anything back to Rekordbox.
- Crossfading, multiple decks, or EQ — single-track audition only.
- Waveform analysis/peaks caching or coloring by frequency; wavesurfer's default decode is sufficient.

## Decisions

### Decision: Serve audio from a local Bun.serve HTTP endpoint with Range support
Electrobun exposes no built-in arbitrary-file protocol; the webview can only load app assets via `views://`. wavesurfer fetches the audio (to decode peaks) and the `<audio>`/WebAudio element streams it for playback and seeking, both of which want **HTTP byte-range** support for responsive scrubbing.

Approach: the Bun backend starts a small `Bun.serve` instance bound to `127.0.0.1` on an ephemeral port. It exposes `GET /audio/:contentId`, which looks up the track's `file_path` in the mirror, validates the file exists, and streams it with `Accept-Ranges`/`Content-Range` handling (`Bun.file(path).slice(...)` honors Range). Permissive CORS (`Access-Control-Allow-Origin: *`) is set so the webview can `fetch` it for decoding under both `views://` and `http://localhost:5173`. An RPC request `getTrackAudioUrl({ trackId })` returns the resolved `http://127.0.0.1:<port>/audio/<id>` URL (or `null` when the file is missing), keeping the port discovery on the backend.

- **Alternatives considered:**
  - *Read bytes over RPC → Blob URL.* Simpler, but pulls the entire file (often 5–40 MB) through the JSON-ish RPC bridge into memory, with no streaming and no Range; rejected for memory/latency.
  - *`file://` directly.* Custom-scheme/secure-context pages block `file://`, and paths with spaces/unicode are fragile; rejected.
  - *Static dir mount.* Would expose a whole directory; the per-id lookup keeps us serving only known library files.

### Decision: Persist absolute `file_path` in the mirror, populated at sync
Add a `file_path TEXT` column to the `content` table. During `syncFromRekordbox`, map `DjmdContent.folderPath` (absolute path) into `contents[].file_path`. `getTrackAudioUrl` and `readPlaylistTracks` both read it. Because `replaceLibrary` already does a full delete+reinsert in a transaction, adding a column keeps sync idempotent. `getDb` runs `CREATE TABLE IF NOT EXISTS`; to migrate an existing DB we additionally run an idempotent `ALTER TABLE content ADD COLUMN file_path` guarded by a column-existence check (or `PRAGMA table_info`).

### Decision: Normalize BPM at the read boundary (÷100)
`DjmdContent.bpm` is BPM×100. Rather than mutate stored data semantics, `readPlaylistTracks` divides the stored value by 100 (rounded to one decimal, or integer when whole) so `Track.bpm` is the true BPM. The track list and player panel then render `Track.bpm` directly. Storing raw and converting on read keeps the mirror a faithful copy of Rekordbox.

### Decision: Encapsulate the player in a `WaveformPlayer` React component
Add a self-contained component in `src/mainview` that owns a `wavesurfer.js` instance via `useRef`/`useEffect`. Props: `track: Track | null`. On track change it calls `getTrackAudioUrl`, then `wavesurfer.load(url)`; on `ready` it auto-plays. It exposes/binds play-pause, volume (`setVolume`), and wires wavesurfer's native click-to-seek (built in) and `interaction`/`audioprocess`/`timeupdate` events to update the current-time display. Total duration comes from wavesurfer's decoded `getDuration()` (authoritative), sidestepping any DB length ambiguity. `App` lifts a `loadedTrack` state set by the row's `onDoubleClick`.

- **Alternative:** drive an external `<audio>` element and pass it to wavesurfer as media. Not needed — wavesurfer manages its own media and gives us a simpler event surface.

## Risks / Trade-offs

- **Secure-context / mixed-content blocking of `http://127.0.0.1` from `views://`** → localhost is treated as a potentially-trustworthy origin by browsers/CEF, so it should load; if CEF blocks it, fall back to a Blob-URL path (already-known alternative). Verify early during apply.
- **Local server port/lifecycle** → bind to an ephemeral port on `127.0.0.1` only, start once at boot alongside the window, and close it on `process exit` next to `closeDb()`. Risk of port conflict is minimized by letting the OS assign the port.
- **File path drift / moved files** → `folderPath` is a snapshot from last sync; files moved after sync 404. Handled by the "file missing" scenarios: `getTrackAudioUrl` returns null and the player shows a non-blocking error.
- **Non-decodable / DRM / unusual codecs (e.g. AIFF, ALAC)** → CEF/WebAudio may fail to decode some formats wavesurfer relies on. Surface the same player error state; broad codec coverage is out of scope.
- **BPM rounding** → variable-BPM tracks store a representative value; ÷100 with light rounding is adequate for display and matches Rekordbox's shown BPM.
- **Large files decode latency** → wavesurfer decodes the whole file for peaks; big lossless files take a moment. Acceptable for single-track audition; peak caching is a future optimization.

## Migration Plan

1. Add `file_path` column (idempotent `ALTER TABLE` on existing mirrors; included in `CREATE TABLE` for fresh ones).
2. Existing users must re-run **Sync** once to populate `file_path` (old rows have null paths → those tracks show the player error until re-synced). No destructive migration; sync already rebuilds the mirror.
3. No rollback concerns: the column and endpoint are additive; reverting the frontend restores the old mockup.

## Open Questions

- Does CEF on Windows permit `http://127.0.0.1:<port>` audio fetch from the `views://` origin without extra CSP relaxation? (Validate during apply; Blob-URL fallback ready.)

## Decided

- **Volume persistence**: volume persists across app restarts. The webview stores the level in `localStorage` (e.g. key `mixxxa.volume`), reads it on player mount to initialize `setVolume`, and writes it on change. This keeps it a pure frontend concern with no backend/RPC round-trip.
