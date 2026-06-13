// Standard Rekordbox hot-cue palette, keyed by colorTableIndex (1-8).
// Shared between the Rekordbox import mapping and locally-created cues so
// auto/manual cues use the same colors slot-for-slot.
export const CUE_COLOR_TABLE: Record<number, string> = {
  1: "#F870F8", // pink
  2: "#F80000", // red
  3: "#F8A030", // orange
  4: "#C3AF04", // yellow
  5: "#28E214", // green
  6: "#25FDE9", // cyan
  7: "#0672F8", // blue
  8: "#B432F8", // purple
};

/** Default color for a hot-cue slot (1-8 = A-H). */
export function slotColor(slot: number): string | null {
  return CUE_COLOR_TABLE[slot] ?? null;
}
