# Assemble the implementation-ready spec

Type: task
Status: resolved

## Question

Assemble `.scratch/system-readiness/spec.md` — the map's destination — from the two resolutions: [Column UI](01-column-ui-prototype.md) (signal-bars cell, click-menu override, underline for manual values, prototype on branch `prototype/system-readiness-column`) and [Schema and precedence](02-schema-and-precedence.md) (columns, precedence chain, derivation rule, stale-override policy, encoding). The spec should be self-contained enough to hand to an implementation session without reading the tickets.

## Answer

Assembled 2026-07-11: [spec.md](../spec.md) now holds the full implementation-ready spec — domain model (TEXT tier enum, effective-tier precedence), shared derivation rule (lossless whitelist + bitrate bands), storage (two nullable columns on `content` via `CONTENT_ANALYSIS_COLUMNS`, unconditional override persistence), `rowToTrack`/`Track` exposure, and the column UI verdict (signal bars after Bitrate, click menu, override underline). Symbols referenced were verified present in `src/bun/db/localDb.ts` and `src/bun/analysis/index.ts`. This was the map's destination; no tickets remain.
