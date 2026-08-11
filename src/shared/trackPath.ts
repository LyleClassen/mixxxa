/**
 * Classifies a raw Rekordbox `folderPath` value, independent of the host OS
 * or filesystem. Pure — no `fs` access — so it can run in the renderer to
 * label states without a round-trip to Bun.
 */

export type ClassifiedPath =
  | { kind: "file"; path: string }        // normalised absolute path
  | { kind: "streaming"; service: string } // "spotify" | "applemusic" | "tidal" | …
  | { kind: "none" };                      // null/empty/unrecognised

// scheme:rest — anything other than "file" is treated as a streaming service.
// Windows drive letters ("E:/...") match this shape too, so callers must rule
// those out first via DRIVE_LETTER_RE.
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/;

// A single-letter "scheme" followed by a separator is a drive letter, not a URI.
const DRIVE_LETTER_RE = /^[a-zA-Z]:[\\/]/;

// Apple Music's Rekordbox catalog paths look like "/v4/catalog/tracks/24341612/"
// — no scheme prefix, just a bare catalog path.
const APPLE_MUSIC_CATALOG_RE = /^\/v4\/catalog\/tracks\//;

export function normalizeSeparators(path: string): string {
  const unified = path.replace(/\\/g, "/");
  // Collapse duplicate separators but preserve a leading "//" (UNC root).
  const leadingUnc = unified.startsWith("//") ? "//" : "";
  return leadingUnc + unified.slice(leadingUnc.length).replace(/\/{2,}/g, "/");
}

export function classifyRekordboxPath(raw: string | null): ClassifiedPath {
  if (raw == null) return { kind: "none" };
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "none" };

  if (APPLE_MUSIC_CATALOG_RE.test(trimmed)) {
    return { kind: "streaming", service: "applemusic" };
  }

  if (DRIVE_LETTER_RE.test(trimmed)) {
    return { kind: "file", path: normalizeSeparators(trimmed) };
  }

  const schemeMatch = trimmed.match(SCHEME_RE);
  if (schemeMatch) {
    const [, scheme, rest] = schemeMatch;
    if (scheme.toLowerCase() !== "file") {
      return { kind: "streaming", service: scheme.toLowerCase() };
    }
    // file://localhost/... or file:///... — strip scheme + optional host, decode.
    const withoutHost = rest!.replace(/^\/\/[^/]*/, "");
    let decoded: string;
    try {
      decoded = decodeURIComponent(withoutHost);
    } catch {
      decoded = withoutHost;
    }
    return { kind: "file", path: normalizeSeparators(decoded) };
  }

  // UNC path: \\server\share\... → //server/share/...
  if (/^\\\\/.test(trimmed) || /^\/\/[^/]/.test(trimmed)) {
    return { kind: "file", path: normalizeSeparators(trimmed) };
  }

  return { kind: "file", path: normalizeSeparators(trimmed) };
}

// ── Missing-file reason messages ─────────────────────────────────────────────

export type TrackFileErrorReason = "streaming" | "volume-offline" | "missing" | "no-path";

/** One shared copy for every site that reports a track's file as unavailable. */
export function trackFileErrorMessage(reason: TrackFileErrorReason, detail?: string): string {
  switch (reason) {
    case "streaming":
      return detail ? `Streaming track (${detail}) — not a local file` : "Streaming track — not a local file";
    case "volume-offline":
      return detail ? `Drive not connected: ${detail}` : "Drive not connected";
    case "missing":
      return "Audio file not found — it may have moved or been deleted";
    case "no-path":
      return "Track has no file location";
  }
}

// ── Volume mapping ────────────────────────────────────────────────────────────

export interface VolumeMappingLike {
  from: string;
  to: string;
}

const DRIVE_PREFIX_RE = /^[a-zA-Z]:/;

// Windows drive letters are case-insensitive; the rest of the path is not.
function matchesMappingPrefix(path: string, from: string): boolean {
  if (path.length < from.length) return false;
  const prefix = path.slice(0, from.length);
  if (DRIVE_PREFIX_RE.test(from) && DRIVE_PREFIX_RE.test(prefix)) {
    return prefix[0].toLowerCase() === from[0].toLowerCase() && prefix.slice(1) === from.slice(1);
  }
  return prefix === from;
}

// A macOS external volume ("/Volumes/External/...") or Windows drive
// ("E:/...") / UNC share ("//nas/share/...") root — the part of the path
// whose absence means "drive not connected" rather than "file moved".
const MACOS_VOLUME_RE = /^\/Volumes\/[^/]+/;
const UNC_ROOT_RE = /^\/\/[^/]+\/[^/]+/;

export function getVolumeRoot(path: string): string {
  if (DRIVE_PREFIX_RE.test(path)) return path.slice(0, 2) + "/";
  const uncMatch = path.match(UNC_ROOT_RE);
  if (uncMatch) return uncMatch[0];
  const macMatch = path.match(MACOS_VOLUME_RE);
  if (macMatch) return macMatch[0];
  return "/";
}

/**
 * Rewrites a normalised file path using the longest-matching `from` prefix
 * among the given mappings. Returns the original path when nothing matches.
 */
export function applyVolumeMappings(path: string, mappings: VolumeMappingLike[]): string {
  const candidates = mappings
    .map((m) => ({ from: normalizeSeparators(m.from), to: normalizeSeparators(m.to) }))
    .filter((m) => matchesMappingPrefix(path, m.from))
    .sort((a, b) => b.from.length - a.from.length);
  const best = candidates[0];
  if (!best) return path;
  return best.to + path.slice(best.from.length);
}
