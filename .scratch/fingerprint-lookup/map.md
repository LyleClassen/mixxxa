# Map: Fingerprint metadata lookup

Label: wayfinder:map

## Destination

An implementation-ready spec for looking up true artist/title from existing Chromaprint fingerprints via AcoustID → MusicBrainz, with a review-and-confirm UI that writes approved values back to rekordbox track fields.

## Notes

- Settled during charting (2026-07-11):
  - Service: AcoustID for fingerprint matching, MusicBrainz for metadata (both open).
  - Apply policy: review-and-confirm — side-by-side current vs looked-up metadata with match confidence; per-track or bulk approve; approved values write to rekordbox fields (artist/title are rekordbox-owned data, unlike structure/systemReadiness).
- Fingerprinting already exists: [src/bun/analysis/fingerprint.ts](../../src/bun/analysis/fingerprint.ts) using patched @unimusic/chromaprint; rekordbox write path via `src/bun/rekordboxBackup.ts`.
- Skills: /research, /grilling, /prototype.
- Tracker: local markdown (this directory).

## Decisions so far

<!-- one line per closed ticket -->

- [Research: AcoustID + MusicBrainz APIs](issues/01-acoustid-api-research.md) — our chromaprint output is directly compatible (TEST2 algorithm, fpcalc-identical encoding, 120s window); one POST to AcoustID with `meta=recordings+releasegroups` covers artist/title/album, 3 req/s; key is a bundled app key (free for non-commercial, CC-BY-SA attribution); open gap: whole-file duration isn't stored alongside the fingerprint — folded into the review/write-back spec ticket.
- [Task: register AcoustID application key](issues/02-register-acoustid-key.md) — Mixxxa app registered; application key `4pxMQKhebq`, to be bundled as a constant in the lookup module (not a secret, no settings UI); non-commercial terms and 3 req/s ride with it.
- [Review UI and rekordbox write-back semantics](issues/03-review-writeback-spec.md) — implementation-ready [spec](assets/spec-single-track-lookup.md): "Identify track…" modal with ranked pick-list (floor 0.5, % badges), fields artist+title+album; Apply stages to localDb (pending badge, discardable) and rekordbox write rides the existing sync as a new `metadata` aspect; undo via prewrite backup + permanent provenance row (MBID/score/originals); prerequisites computed on demand; CC BY-SA attribution in the modal footer.
- [Bulk "clean my library" mode](issues/04-bulk-clean-library.md) — implementation-ready [spec](assets/spec-bulk-clean-library.md): multi-select built as part of this effort (select-all covers whole-library); entry via selection + playlist context menus; applied tracks silently skipped, rejects/no-matches re-checked; green (≥0.9) band bulk-approved from a review table, ambers stepped one-by-one; background scan with review-as-you-go into a persistent sidebar "Identification" view; manual resume; one merged results set.

## Not yet specified

- Extending lookup beyond artist/title/album (year, cover art — needs a MusicBrainz enrichment call; MBID storage is already decided via provenance rows).

## Out of scope

- Auto-applying matches without review (explicitly rejected during charting).
