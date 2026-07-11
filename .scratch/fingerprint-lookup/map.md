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

## Not yet specified

- Bulk "clean my library" mode (scan everything, queue low-confidence for review) — after single-track flow is specced.
- Extending lookup beyond artist/title (album, year, cover art, MusicBrainz ids stored locally).

## Out of scope

- Auto-applying matches without review (explicitly rejected during charting).
