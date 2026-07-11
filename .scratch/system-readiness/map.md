# Map: System Readiness rating

Label: wayfinder:map

## Destination

An implementation-ready spec for a `systemReadiness` track attribute — a 3-tier sound-quality rating (bad / ok for home / big-sound ready) shown as an emoji column in the playlist table. Local-DB only, never written to rekordbox.

## Notes

- Settled during charting (2026-07-11):
  - Default derivation from bitrate: `<192 kbps` = bad, `192–255` = ok for home, `≥256 kbps or lossless` = big-sound ready.
  - Per-track manual override, stored in the local DB ([src/bun/db/localDb.ts](../../src/bun/db/localDb.ts)); override always wins over the derived default.
  - Column lives in the track table ([src/mainview/features/track-table/columns.tsx](../../src/mainview/features/track-table/columns.tsx)); bitrate already exists on tracks (`src/shared/types.ts`).
- Skills: /grilling, /domain-modeling for decisions; /prototype for UI questions.
- Tracker: local markdown (this directory).

## Decisions so far

<!-- one line per closed ticket -->

- [Column UI: emoji set and override interaction](issues/01-column-ui-prototype.md) — signal-bars cell (no emoji; red/amber/green fill) placed after Bitrate, ~55–60px, header "Rdy"; override via a small click menu (Auto + three tiers); overridden values marked with an underline; prototype preserved on branch `prototype/system-readiness-column`.
- [Local DB schema and default/override precedence](issues/02-schema-and-precedence.md) — two nullable TEXT columns on `content` (`analyzed_readiness` written at analysis time, `readiness_override` set manually), preserved across sync via CONTENT_ANALYSIS_COLUMNS; effective tier = override → analyzed → live fallback from rekordbox bit_rate; lossless via extension whitelist (.flac/.wav/.aiff/.aif → big, m4a by bitrate); overrides persist unconditionally; values 'bad'|'home'|'big'.
- [Assemble the implementation-ready spec](issues/03-assemble-spec.md) — destination reached: [spec.md](spec.md) assembled from the UI and schema resolutions, self-contained for an implementation session; no tickets remain.

## Not yet specified

- Whether a future audio-analysis pass (spectral cutoff detection to catch fake-bitrate transcodes) should auto-adjust the rating — depends on sidecar capacity decisions in the song-structure effort.

## Out of scope

- Writing systemReadiness to rekordbox in any form.
