# Research: AcoustID + MusicBrainz APIs

Type: research
Status: closed
Assignee: Lyle Classen (claimed 2026-07-13)

## Question

Confirm the integration surface: AcoustID lookup request format and whether our @unimusic/chromaprint output (algorithm, fingerprint encoding, duration requirement) is directly compatible; API key model (per-application registration) and rate limits; MusicBrainz recording lookup + rate limits/user-agent rules; result shape (score, multiple candidate recordings) to inform the review UI. Output: markdown summary.

## Resolution (2026-07-13)

Full findings: [research-acoustid-musicbrainz.md](../assets/research-acoustid-musicbrainz.md)

- **Our fingerprint is directly compatible.** The patched @unimusic/chromaprint uses CHROMAPRINT_ALGORITHM_TEST2 (AcoustID's default), emits the compressed URL-safe base64 string identical to fpcalc output, and fingerprints 120s (fpcalc's default). No changes needed in `src/bun/analysis/fingerprint.ts`.
- **Lookup**: POST `https://api.acoustid.org/v2/lookup` with `client`, `duration`, `fingerprint`; gzip POST bodies supported. `meta=recordings+releasegroups+compress` returns title/artists/album in one call — MusicBrainz follow-up only needed for extras (ISRCs, full credits). Rate limit 3 req/s.
- **Gap**: `duration` must be the *whole file's* length in integer seconds; `computeFingerprint` doesn't capture it and localDb stores only the fingerprint. `waveform_duration` in the content table can supply it, with file-metadata fallback — decision folded into the review/write-back spec ticket.
- **Key/terms**: register an application key at acoustid.org/new-application; bundling in a desktop app is the normal model. Free for non-commercial use only; metadata is CC-BY-SA 3.0 → show attribution.
- **MusicBrainz** (if used): hard 1 req/s per IP; mandatory `Mixxxa/<version> ( contact )` User-Agent.
- **Result shape**: `results[] → {id, score 0..1, recordings[]}`; score semantics undocumented (heuristic: ≥0.9 confident, 0.5–0.9 review); `recordings` may be absent — parse defensively, use duration proximity to disambiguate edits/remixes.
