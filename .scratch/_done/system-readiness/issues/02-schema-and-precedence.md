# Local DB schema and default/override precedence

Type: grilling
Status: resolved

## Question

Pin the storage and recompute rules: shape of the override in `localDb` (nullable tier enum keyed by track id?), whether the derived tier is stored or always computed from bitrate at read time, what happens when a file is replaced and its bitrate changes (does a stale override persist?), and how lossless formats are detected as top-tier.

## Answer

Resolved by grilling, 2026-07-11.

**Schema** — two new nullable TEXT columns on `content`, both appended to `CONTENT_ANALYSIS_COLUMNS` in `src/bun/db/localDb.ts` so the existing idempotent ALTER migration adds them and the `LOCAL_CONTENT_COLUMNS` snapshot/restore in `replaceLibrary` preserves them across rekordbox re-sync (they must NOT be added to `REKORDBOX_SOURCED_CONTENT_COLUMNS`):

- `analyzed_readiness TEXT` — the stored derived tier. Written whenever analysis produces `analyzed_bitrate` (extend the `writeAnalyzedBitrate` write path to compute and store the tier in the same UPDATE). Not recomputed on sync or lazily — it is an analysis product.
- `readiness_override TEXT` — the manual ear-judgment set from the column's click menu; the "Auto" menu item clears it to NULL.

**Effective tier precedence**, computed in `rowToTrack` and exposed on `Track`: `readiness_override` → `analyzed_readiness` → live fallback computed from rekordbox `bit_rate`. Every track therefore shows a rating immediately; analysis later replaces the metadata-derived provisional value with the measured one.

**Derivation rule** (shared pure function, used by both the analysis write and the live fallback):
1. Extension whitelist: `file_path` ending `.flac` / `.wav` / `.aiff` / `.aif` → `big` regardless of bitrate. `.m4a` is NOT whitelisted (may be lossy AAC) — it tiers by bitrate.
2. Otherwise by bitrate (kbps): `<192` → `bad`; `192–255` → `home`; `≥256` → `big`.
3. Input bitrate: `analyzed_bitrate` when present, else `bit_rate`.

**Stale-override policy**: the override persists unconditionally — through file replacement, re-analysis, and tier changes. Overrides are ear-judgments, cleared only manually via "Auto". The underline mark from the UI prototype signals that a value is manual.

**Encoding**: TEXT enum `'bad' | 'home' | 'big'`, NULL = unset — matching the codebase's TEXT-column habit (`analysis_status`, `cue.source`).
