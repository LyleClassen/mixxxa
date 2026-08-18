# Map: Mix audition (dual-track testing)

Label: wayfinder:map

## Destination

An implementation-ready spec for a Mixed In Key Pro-style audition section: load two tracks, tempo-sync them to a common BPM (key-preserving time-stretch), and play them together from selectable mix-in points to judge how they blend.

## Notes

- Settled during charting (2026-07-11):
  - Beatmatching is required in v1 — both tracks time-stretched to a shared BPM with pitch preserved. A native-tempo-only version was rejected as only useful for same-BPM pairs.
- Song structure data (see the song-structure map) is a future enhancer for suggesting mix points; existing cues + drop markers are enough to start, so this map is not blocked on that effort.
- Existing player lives in `src/mainview/features/player`; audio is served from `src/bun/audioServer.ts`.
- Skills: /research (time-stretch engines), /grilling, /prototype.
- Tracker: local markdown (this directory).

## Decisions so far

<!-- one line per closed ticket -->

## Not yet specified

- Mix-point suggestion from structure segments + key compatibility — sharpen once song-structure lands.
- Whether auditioned pairings should be saveable/ratable (a "these two work" memory) — decide after first UX pass.
- EQ/filter controls during audition (bass-swap simulation) — depends on audio-engine findings.

## Out of scope

- Full DJ deck/performance features (looping, scratching, recording sets).
