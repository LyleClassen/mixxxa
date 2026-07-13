# Review UI and rekordbox write-back semantics

Type: grilling
Status: closed (2026-07-13)
Assignee: Lyle Classen

Blocked by: 01

## Question

Spec the review-and-confirm flow: where it lives (dialog per track vs a review queue view), how multiple candidate matches are presented (pick from list vs top match only), confidence display and a floor below which we don't suggest, which fields write back (artist/title only in v1?), exactly how the rekordbox write happens in this app and its failure modes, and whether original values are kept for undo.

Folded in from the API research ([resolution](01-acoustid-api-research.md)):

- Where the whole-file duration for the lookup request comes from — `waveform_duration` in the content table vs file-metadata fallback (AcoustID requires integer seconds of the full track, not the 120s fingerprint window).
- Where AcoustID/MusicBrainz attribution appears in the UI (metadata is CC-BY-SA 3.0).

## Resolution (2026-07-13)

Full spec: [assets/spec-single-track-lookup.md](../assets/spec-single-track-lookup.md). Decisions, grilled one-by-one:

- **UI surface**: modal from a track-row "Identify track…" action (bulk mode reuses it later as a queue-stepper).
- **Candidates**: flatten results×recordings into one deduped ranked pick-list (score, duration-proximity tiebreak); top pre-selected.
- **Confidence**: floor 0.5 (below → not shown; none → "no confident match"); % badge, green ≥0.9 / amber.
- **Fields v1**: artist + title + **album** — album is free in the AcoustID response and a one-call write via rbox-js `updateContentAlbum`.
- **Write timing**: Apply **stages** to localDb; rekordbox write rides the existing sync pipeline as a new `metadata` aspect (diff → confirm → prewrite backup → USN guard → `updateContent`/`updateContentArtist`/`updateContentAlbum`). Failure modes inherit existing typed errors.
- **Undo**: pre-sync discard; post-sync backup restore; permanent provenance row (MBID, score, original values, applied-at) enables future per-track revert.
- **Pending UX**: track table shows approved values immediately with a "pending sync" badge; discardable until synced.
- **Prerequisites**: computed on demand — fingerprint via existing analysis; duration from `Math.round(waveform_duration)`, file-container-metadata fallback.
- **Attribution**: modal footer line "Metadata from AcoustID and MusicBrainz (CC BY-SA 3.0)".
