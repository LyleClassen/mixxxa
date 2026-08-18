# Bulk "clean my library" mode

Type: grilling
Status: closed (2026-07-13)
Assignee: Lyle Classen

Blocked by: (none — graduated from fog when [03](03-review-writeback-spec.md) closed)

## Resolution (2026-07-13)

Implementation-ready [spec](../assets/spec-bulk-clean-library.md). Key decisions from grilling:

- **Scope**: track-table **multi-select is built as part of this effort** (Ctrl/Cmd+click, Shift+click, select-all — select-all covers whole-library). Entry points: selection context menu ("Identify N tracks…") and playlist context menu; both feed the same scan.
- **Skip rule**: tracks with a provenance row (previously applied) are silently excluded; rejected and no-match tracks are *not* remembered — future scans re-check them.
- **Score bands**: green (≥0.9) rows in a review table with a one-click confirming **Approve all**; ambers (0.5–0.9) via a queue-stepper reusing the single-track modal internals; no-match rows listed as unresolved. Approval = staging exactly per the single-track spec.
- **Execution**: background scan, fingerprinting pipelined ahead of the shared ≤3 req/s lookup queue; results stream into a persistent store and are reviewable while the scan runs; pause/cancel in the view.
- **Placement**: sidebar "Identification" node with pending-review count badge, opening the results view in the main content area; survives restarts.
- **Resume**: manual — "Interrupted — N of M scanned" + Resume button; no auto-resume on launch.
- **Lifecycle**: one results set; new scans merge (deduped) into it; rows age out after successful rekordbox sync.

## Question

Spec the bulk lookup mode on top of the single-track flow ([spec](../assets/spec-single-track-lookup.md)): how a scan is scoped (whole library vs selection vs playlist), how the 3 req/s AcoustID budget shapes progress/UI for hundreds of tracks, what auto-queues for review vs skips (score bands — does ≥0.9 pre-approve or still require confirmation, given auto-apply is out of scope?), where the review queue lives (the single-track modal as a queue-stepper was anticipated), how partial completion/resume works, and whether already-identified tracks (provenance row exists) are skipped or re-checked.
