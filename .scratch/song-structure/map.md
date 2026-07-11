# Map: Song structure segmentation (all-in-one-fix)

Label: wayfinder:map

## Destination

An implementation-ready spec for integrating [all-in-one-fix](https://pypi.org/project/all-in-one-fix/) song-structure analysis: segments (intro/verse/chorus/etc.) stored in the local DB (never rekordbox), rendered as thin colored lines on the track minimap, working alongside the existing drop detector.

## Notes

- Settled during charting (2026-07-11):
  - Trigger policy: on-demand + background queue — context-menu action per track, plus auto-queue for tracks added to playlists. No blanket library sweep in v1.
  - Storage: local DB only; structure data is a reusable asset for future features (mix audition mix-point suggestions in particular).
  - UI: thin colored lines on the minimap segment-typed.
- Delivery vehicle: the app already ships a bundled Python ONNX sidecar for genre/valence (see memory: project-track-analysis) — but all-in-one-fix needs PyTorch + NATTEN + demucs, a far heavier footprint. Feasibility research is the gating ticket.
- Existing drop detector lives in `src/bun/analysis`; drops already produce cues.
- Skills: /research, /grilling, /domain-modeling, /prototype.
- Tracker: local markdown (this directory).

## Decisions so far

<!-- one line per closed ticket -->

## Not yet specified

- How structure feeds the mix-audition effort (mix-point suggestions) — sharpen once both specs exist.
- Optional library-wide sweep / GPU acceleration — revisit after real per-track timings from the feasibility research.
- Reconciling structure segments with drop-detector output (do drops snap to segment boundaries?).

## Out of scope

- Writing structure data to rekordbox.
