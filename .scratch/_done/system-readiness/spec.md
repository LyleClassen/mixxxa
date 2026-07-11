# Spec: System Readiness rating

Status: IMPLEMENTED (2026-07-11, commit aa8d23d) — do not reopen; see map.md
Source: wayfinder map `.scratch/system-readiness/map.md` (decisions 2026-07-11)

## Summary

A `systemReadiness` track attribute: a 3-tier sound-quality rating — **bad** / **ok for home** / **big-sound ready** — derived from bitrate, manually overridable by ear, and shown as a signal-bars column in the playlist track table. Local-DB only; it is **never written to rekordbox** in any form.

## Domain model

- Tier enum, encoded as TEXT: `'bad' | 'home' | 'big'`; `NULL` = unset. (Matches the codebase's TEXT-enum habit, e.g. `analysis_status`, `cue.source`.)
- **Effective tier** per track = first non-null of:
  1. `readiness_override` (manual ear-judgment)
  2. `analyzed_readiness` (stored at analysis time from measured bitrate)
  3. live fallback computed from rekordbox `bit_rate` (provisional, so every track shows a rating immediately)

## Derivation rule

One shared pure function, used by both the analysis write path and the live fallback:

1. **Lossless extension whitelist**: `file_path` ending `.flac`, `.wav`, `.aiff`, `.aif` → `big` regardless of bitrate. `.m4a` is **not** whitelisted (may be lossy AAC) — it tiers by bitrate.
2. Otherwise by bitrate (kbps): `<192` → `bad`; `192–255` → `home`; `≥256` → `big`.
3. Input bitrate: `analyzed_bitrate` when present, else rekordbox `bit_rate`. No bitrate at all → unknown (no tier).

## Storage (`src/bun/db/localDb.ts`)

Two new nullable TEXT columns on `content`:

- `analyzed_readiness TEXT` — written whenever analysis produces `analyzed_bitrate`: extend the `writeAnalyzedBitrate` write path to compute the tier and store it **in the same UPDATE**. Not recomputed on sync or lazily — it is an analysis product.
- `readiness_override TEXT` — set from the column's click menu; the "Auto" menu item clears it to NULL.

Both columns must be appended to `CONTENT_ANALYSIS_COLUMNS` so the idempotent ALTER migration adds them and the `LOCAL_CONTENT_COLUMNS` snapshot/restore in `replaceLibrary` preserves them across rekordbox re-sync. They must **not** be added to `REKORDBOX_SOURCED_CONTENT_COLUMNS`.

**Stale-override policy**: an override persists unconditionally — through file replacement, re-analysis, and derived-tier changes. It is cleared only manually via "Auto".

## Track shape

Compute the effective tier in `rowToTrack` and expose it on `Track` (`src/shared/types.ts`), along with enough to render the UI: the effective tier, whether it comes from an override, and the derived tier + source bitrate for the menu's "Auto" line.

## Column UI (`src/mainview/features/track-table/columns.tsx`, `TrackTable.tsx`)

- **Cell**: three ascending signal bars, no emoji. Fill count = tier — 1 bar red (`bad`), 2 bars amber (`home`), 3 bars green (`big`). Unknown bitrate → all bars muted plus a "?".
- **Placement**: immediately after the Bitrate column; narrow (~55–60px); header **"Rdy"**.
- **Override interaction**: clicking the cell opens a small menu — "Auto — <derived tier> (from N kbps)" plus the three tiers, checkmark on the current selection. Choosing a tier sets `readiness_override`; "Auto" clears it.
- **Override indicator**: a primary-colored underline beneath the bars when the value is an override, with a tooltip noting it was set by ear. Derived values have no underline.
- **Sort/filter**: nothing now — the table has no sorting/filtering infrastructure (core row model only). When sorting lands, sort by effective tier as 0/1/2.
- A working visual reference (three prototype variants + switcher; the verdict is a hybrid of C's bars/underline and B's placement/menu) is preserved on branch `prototype/system-readiness-column`.

## Out of scope

- Writing systemReadiness to rekordbox.
- Spectral-cutoff analysis to catch fake-bitrate transcodes (may later auto-adjust the rating; parked pending sidecar capacity decisions in the song-structure effort).
