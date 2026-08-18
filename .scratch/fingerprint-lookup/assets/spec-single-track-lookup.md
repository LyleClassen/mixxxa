# Spec: single-track fingerprint lookup — review-and-confirm + rekordbox write-back

Resolved 2026-07-13 via grilling (ticket [03](../issues/03-review-writeback-spec.md)). Implementation-ready.

## Entry point

A row action / context-menu item **"Identify track…"** on the track table opens a modal for that single track. Bulk mode is a separate, later effort.

## Prerequisites (computed on demand)

The modal is always available. On open it fills gaps itself, showing a progress state:

- **Fingerprint** missing → compute via the existing analysis path (`src/bun/analysis/fingerprint.ts`).
- **Duration** (AcoustID needs the whole file's duration in integer seconds): use `Math.round(waveform_duration)` from the local `content` table; if null, read the duration from the file's container metadata at lookup time (no full decode).

## Lookup

One POST to `https://api.acoustid.org/v2/lookup`:

- `client` = bundled app key `4pxMQKhebq` (constant in the lookup module; not a secret)
- `duration` = integer seconds (above), `fingerprint` = stored chromaprint string (already fpcalc-compatible)
- `meta=recordings+releasegroups+compress`, form-encoded body, gzipped with `Content-Encoding: gzip`
- ≤3 req/s (irrelevant for single-track, but the client should be built as a small serial queue for bulk reuse)
- No MusicBrainz round-trip in v1.

## Candidate presentation

- Flatten `results × recordings` into a **single deduped ranked pick-list**: sort by AcoustID score, tiebreak by |recording.duration − track duration|.
- **Floor 0.5**: candidates scoring below are discarded. If nothing clears the floor (or `recordings` is absent on all results) the modal shows a "no confident match" state.
- Confidence shown as a **% badge**: green ≥ 0.9, amber otherwise.
- Top candidate pre-selected; user can select another before applying.
- Side-by-side current vs candidate for **artist, title, album** (album from releasegroups; parser must be defensive — any field can be missing).
- Modal footer (persistent): *"Metadata from [AcoustID](https://acoustid.org) and [MusicBrainz](https://musicbrainz.org) (CC BY-SA 3.0)"*.

## Apply = stage, not write

Apply does **not** touch rekordbox. It writes to localDb:

1. **Pending metadata** for the track: approved artist / title / album.
2. A permanent **provenance row**: recording MBID, AcoustID track id, score, original artist/title/album (as rekordbox held them at apply time), applied-at timestamp.

The track table immediately displays the approved values with a subtle **"pending sync" badge**; the staged change can be discarded (row action / badge click) any time before sync.

## Write-back (extends the existing sync pipeline)

`rekordbox-writeback.ts` gains a **`metadata` aspect** alongside `ordering`/`bpm`/`key`:

- **Diff**: for each track with pending metadata, emit `TrackValueChange` rows (`field: "artist" | "title" | "album"`) with live rekordbox values as `oldValue` — so the confirm screen always shows current-vs-approved even if rekordbox changed since staging.
- **Write** (after the usual confirm → mandatory prewrite backup → `localUsn` staleness guard):
  - title → `content.title = …; rbDb.updateContent(content)`
  - artist → `rbDb.updateContentArtist(id, name)` (find-or-create in rbox-js)
  - album → `rbDb.updateContentAlbum(id, name)`
- On success, clear the track's pending metadata (provenance row stays).
- Failure modes inherit the existing typed errors: `locked` (rekordbox running), `stale-diff`, `write-failed` (partial write → restore prewrite backup from Settings).

## Undo

- **Pre-sync**: discard the staged change — nothing was written.
- **Post-sync**: restore the prewrite backup (existing mechanism). Provenance rows retain original values permanently, so a per-track "revert identification" can be added later without new data capture.

## Lookup failure states (modal)

- Network / AcoustID `status: "error"` → error state with Retry.
- No match ≥ 0.5 → "no confident match", no apply possible.
- Fingerprint/duration computation failure → surfaced in the modal's progress state with the underlying analysis error.
