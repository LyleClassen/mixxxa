# Column UI: emoji set and override interaction

Type: prototype
Status: resolved

## Question

What do the three tiers look like in the track table, and how does the manual override feel? Prototype the column: pick the emoji per tier (e.g. 🔇 bad / 🏠 ok for home / 🔊 big-sound ready), decide click-to-cycle vs small menu for overriding, how an overridden value is visually distinguished from a derived one (so you know your ears set it), sort/filter behavior, and column placement/width.

## Comments

**2026-07-11 — prototype built, awaiting verdict.** Three variants mounted in the real TrackTable, switchable via the floating bottom bar, `←`/`→` keys, or `?srproto=A|B|C`. Run with `bun run dev:hmr` (hidden in production builds). Overrides are in-memory only — storage is ticket 02.

- **A — Glyph, click-to-cycle**: bare emoji (`SR`, 44px) after the Key column. Click cycles auto → 🔇 → 🏠 → 🔊 → auto. Derived values dimmed; override is bright with a small primary dot.
- **B — Labeled pill + menu**: tinted pill with emoji + label (`System`, 130px) after Bitrate. Click opens a menu: "Auto — derived (N kbps)" + the three tiers. Derived pill dashed; override solid with a pencil mark.
- **C — Signal bars, direct-set**: three ascending bars (`Rdy`, 55px) right after Art, no emoji. Click a bar to set that tier directly; click the active bar to reset to auto. Override shown as a primary underline.

Code: `src/mainview/features/track-table/systemReadiness.prototype.tsx` plus three `PROTOTYPE (system-readiness)` blocks in `TrackTable.tsx`.

Note for the verdict: the table currently has no sorting or filtering at all (core row model only), so sort/filter can't be meaningfully prototyped — proposal is that when sorting lands, the column sorts by effective tier (override ?? derived) as 0/1/2.

## Answer

Verdict (2026-07-11), a hybrid of variants C and B:

- **Cell visual — variant C's signal bars, no emoji.** Three ascending bars; fill count = tier, colored red (1 bar / bad), amber (2 / ok for home), green (3 / big-sound ready). Unknown bitrate renders all bars muted with a "?".
- **Placement — variant B's spot**: immediately after the Bitrate column (next to the data it derives from), narrow (~55–60px), header "Rdy".
- **Override interaction — variant B's menu**, not click-to-cycle and not direct-set bars: clicking the cell opens a small menu with "Auto — <derived tier> (from N kbps)" plus the three tiers, checkmark on the current selection.
- **Override indicator**: a primary-colored underline beneath the bars (variant C's treatment) plus a tooltip saying the value was set by ear; derived values have no underline.
- **Sort/filter**: nothing to build now — the table has no sorting/filtering infrastructure (core row model only). When sorting lands, the column sorts by effective tier (override ?? derived) as 0/1/2.

Prototype (all three variants + switcher) captured on branch `prototype/system-readiness-column`; main keeps only this decision.
