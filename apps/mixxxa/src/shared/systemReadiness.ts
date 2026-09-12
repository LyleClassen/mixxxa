// System Readiness: a 3-tier sound-quality rating derived from bitrate (or
// lossless container), shared by the analysis write path and the live
// bitrate-fallback path so both agree on the same tiering rule.

export type ReadinessTier = "bad" | "home" | "big";

export const READINESS_TIER_LABELS: Record<ReadinessTier, string> = {
  bad: "Bad",
  home: "Ok for home",
  big: "Big-sound ready",
};

// Ordinal for future sort support (effective tier as 0/1/2).
export const READINESS_TIER_ORDER: Record<ReadinessTier, number> = {
  bad: 0,
  home: 1,
  big: 2,
};

const LOSSLESS_EXTENSIONS = [".flac", ".wav", ".aiff", ".aif"];

/**
 * Derive a readiness tier from bitrate (kbps) and file path. Lossless
 * containers (flac/wav/aiff/aif) are always `big` regardless of bitrate;
 * `.m4a` is excluded since it may hold lossy AAC. Returns null when there's
 * no bitrate to go on.
 */
export function deriveReadinessTier(bitrate: number | null, filePath: string | null): ReadinessTier | null {
  if (filePath) {
    const lower = filePath.toLowerCase();
    if (LOSSLESS_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "big";
  }
  if (bitrate == null) return null;
  if (bitrate < 192) return "bad";
  if (bitrate < 256) return "home";
  return "big";
}
