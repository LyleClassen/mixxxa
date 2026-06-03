## Context

The existing analysis pipeline runs audio DSP (Key, BPM, Energy, Mood, Genre) inside renderer Web Workers via Essentia.js, fed PCM decoded by ffmpeg in the Bun process. Rekordbox-imported tracks already carry a `bitrate` column populated from container metadata, but that value is unreliable: transcoded files, re-tagged files, and some encoders write a nominal or inherited bitrate that does not reflect the actual encoded stream.

Bitrate is a stream-level property, not a signal-level one — it does not require PCM decoding or ML inference. The bundled `ffprobe` binary (already shipped alongside `ffmpeg`) can inspect the packet stream directly without decoding audio.

## Goals / Non-Goals

**Goals:**
- Add `bitrate` as a first-class analysis aspect the user can opt into
- Measure actual average bitrate via ffprobe packet counting (accurate for CBR and VBR files alike)
- Store the result in a separate `analyzed_bitrate` column, preserving the Rekordbox-sourced value
- Expose a visual flag in the track table when the two values diverge significantly

**Non-Goals:**
- Replacing or overwriting the Rekordbox `bitrate` column
- Per-segment or histogram bitrate analysis (average kbps is sufficient)
- Reporting codec, sample rate, or other stream properties (those are separate concerns)
- Measuring bitrate for video streams

## Decisions

### 1. ffprobe packet counting over container header reading

**Decision**: Invoke `ffprobe -v quiet -select_streams a:0 -show_packets -show_entries packet=size,duration_time -of csv=p=0` and compute `(total_bytes * 8) / duration_seconds / 1000` for the result in kbps.

**Rationale**: Container headers store a nominal bitrate field written at encode time; this is what Rekordbox reads and what can be wrong. Packet-level counting measures the bytes that are actually in the stream, giving the true average. It handles VBR files correctly and catches header lies.

**Alternative considered**: Read the `bit_rate` field from `ffprobe -show_streams` — this reads the header value and has the same accuracy problem as Rekordbox.

### 2. Bun subprocess, not a renderer worker

**Decision**: Run the ffprobe invocation as a `Bun.spawn` subprocess in the main Bun process, similar to how ffmpeg decoding already works, rather than dispatching to a renderer worker.

**Rationale**: Spawning a child process is a Bun-side capability. Renderer workers run JS/WASM and cannot spawn processes. The bitrate phase is fast (reading packet metadata is much lighter than decoding PCM) so it does not block worker throughput. It fits naturally as a pre-decode or standalone phase in the existing Bun-side orchestration.

**Alternative considered**: Pass the file path to the renderer worker and have it IPC back to Bun to spawn — unnecessary round-trip complexity.

### 3. Integrate as an analysis phase, not a standalone pipeline

**Decision**: Add `bitrate` as an aspect alongside Key/BPM/etc., handled in the same queue item and reported through the same phase/progress mechanism.

**Rationale**: Users want to analyze bitrate as part of a batch analysis run (e.g., analyze all tracks for BPM + bitrate). Keeping it in the same queue item means one history entry, one progress indicator, and consistent pause/resume semantics.

**Alternative considered**: A separate "verify bitrate" operation outside the analysis queue — this would fragment the UX and duplicate queue management.

### 4. Divergence threshold for visual flag

**Decision**: Flag a cell in the track table as mismatched when `abs(analyzed_bitrate - metadata_bitrate) > 10 kbps`.

**Rationale**: Encoder rounding and header precision can cause ±1–5 kbps differences that are not meaningful. A 10 kbps threshold catches genuine metadata errors (e.g., 128 kbps header on a 320 kbps file) without false positives on minor rounding.

## Risks / Trade-offs

- **ffprobe startup cost** → Each invocation spawns a subprocess. For large batches this adds latency. Mitigation: the packet-counting approach is still much faster than PCM decoding; for tracks already analyzed, the result is cached in `analyzed_bitrate` and ffprobe is not re-invoked.
- **Incomplete packet data on corrupt files** → ffprobe may emit partial output. Mitigation: treat any exit code != 0 or empty output as a failure for this aspect; do not write `analyzed_bitrate`; report the failure reason.
- **ffprobe not present on non-packaged builds** → Dev environments may lack the bundled binary. Mitigation: the bitrate aspect follows the same "missing binary" error path as the existing ffmpeg decode failure.

## Open Questions

- Should the bitrate aspect be enabled by default (like BPM/Key) or opt-in (like Energy/Genre)? Current intent: **opt-in** (off by default) since it's a verification tool rather than a creative analysis tool. Revisit if user testing shows strong default demand.
