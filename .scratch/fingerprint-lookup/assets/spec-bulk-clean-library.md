# Spec: bulk fingerprint lookup — "clean my library"

Resolved 2026-07-13 via grilling (ticket [04](../issues/04-bulk-clean-library.md)). Implementation-ready. Builds on the [single-track spec](spec-single-track-lookup.md); everything not restated here (lookup request shape, candidate ranking, 0.5 floor, staging semantics, write-back aspect, undo, attribution) is inherited unchanged.

## Prerequisite feature: track-table multi-select

The track table gains multi-row selection, built as part of this effort:

- Click = select single row; Ctrl/Cmd+click = toggle row; Shift+click = range; Ctrl/Cmd+A = select all rows in the current view.
- Select-all makes a whole-library scan possible without a dedicated entry point.
- The row context menu becomes selection-aware: right-clicking within a selection acts on the whole selection.

## Entry points

- **Selection context menu**: "Identify N tracks…" on the track-table selection.
- **Playlist context menu**: "Identify tracks…" on a playlist node in the sidebar tree — scans that playlist's tracks.

Both feed the same scan.

## Skip rule

Tracks that already have a **provenance row** (a previous identification was applied) are silently excluded from the scan — no count shown, no UI mention. That is the only skip test: tracks previously rejected or that returned no confident match are **re-checked** by any future scan that includes them.

## Scan execution

- Runs in the **background**; the app stays fully usable.
- Two-stage pipeline: tracks missing a fingerprint go through the existing analysis path first, **pipelined ahead** of the lookup stage so fingerprinting and lookups overlap.
- Lookups go through the serial ≤3 req/s AcoustID queue from the single-track spec (one shared queue — single-track lookups and the bulk scan share the budget).
- Results stream into the persistent results store as each lookup completes; review is available **while the scan is still running**.
- Progress bar (`scanned / total`), plus **Pause** and **Cancel** controls, live in the results view.

## Persistent results view

- **Placement**: an "Identification" node in the sidebar (rendered like a special playlist). It appears whenever scan results exist and carries a badge with the pending-review count. Selecting it opens the results view in the main content area.
- **Persistence**: scan results (per track: candidate list, scores, band, review state) are written to localDb as they arrive. The view can be closed and reopened freely; results survive app restarts.

### Bands

Each scanned track lands in one band by its best candidate's score:

- **Green** (≥ 0.9): shown together in a review table — one row per track, current vs candidate artist/title/album side by side, % badge. A single **"Approve all"** button stages every green row in one confirming click (this is the review-and-confirm act; auto-apply without a click remains out of scope). Individual green rows can be expanded/edited (pick a different candidate) or rejected before the bulk approve.
- **Amber** (0.5 – 0.9): stepped through **one-by-one** in a queue-stepper that reuses the single-track modal's internals (ranked pick-list, side-by-side compare, apply/skip), with prev/next navigation and position indicator ("14 of 62").
- **No match** (nothing ≥ 0.5, or lookup/fingerprint error): listed as unresolved with the failure reason. No action available beyond dismissing; these tracks are re-checked by future scans.

### Approval = staging (inherited)

Approving (bulk or stepper) does exactly what the single-track Apply does: writes pending metadata + a provenance row per track to localDb; the track table shows the pending-sync badge; the rekordbox write rides the existing sync pipeline's `metadata` aspect. Nothing new here.

## Resume

- Completed lookups are never lost — they're already persisted.
- On cancel or app quit mid-scan, the results view shows **"Interrupted — N of M scanned"** with a **Resume** button that continues the remaining tracks. No auto-resume on launch (no network activity the user didn't just ask for).

## Lifecycle: one results set, merge on new scan

- There is exactly **one** results set — no scan history, no scan management UI.
- Starting a new scan while results exist **merges**: the new scope's tracks are appended, deduped against tracks already present (an existing un-reviewed row is kept, not re-looked-up within the same results set; the skip rule above already removes applied tracks).
- Rows **age out** once their staged change has been synced to rekordbox (the pending metadata is cleared on successful write; the row leaves the results set then). Rejected and dismissed no-match rows can be removed individually or via a "clear resolved" action.
- The sidebar node disappears when the results set is empty.

## Failure modes

- Per-track lookup/fingerprint errors land the track in the no-match band with the error surfaced; they do not stop the scan.
- Network loss mid-scan pauses the scan (same state as user-pause) with a note; Resume retries from the failed track.
- AcoustID `status: "error"` responses are treated as per-track failures unless systematic (3 consecutive) — then the scan auto-pauses.
