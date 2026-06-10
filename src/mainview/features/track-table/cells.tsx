import type { ReactNode } from "react";
import type { Track } from "../../../shared/types";
import { Music2 } from "lucide-react";

// Cell renderers keyed by column id. TrackTable calls renderCell for each cell.

export function renderCell(colId: string, track: Track, rowIndex: number): ReactNode {
  switch (colId) {
    case "index":
      return <span className="font-mono text-muted-foreground">{rowIndex + 1}</span>;
    case "cover":
      return (
        <div className="w-12 h-8 rounded-sm bg-muted shadow-sm border border-border/50 flex items-center justify-center">
          <Music2 size={14} className="text-muted-foreground/50" />
        </div>
      );
    case "artist":
      return <span className="font-medium">{track.artist || "—"}</span>;
    case "title":
      return (
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          {track.title || "—"}
        </span>
      );
    case "album":
      return <span className="text-muted-foreground">{track.album || "—"}</span>;
    case "bpm": {
      const differs = track.bpmDiffers;
      return (
        <span className={`font-mono ${differs ? "text-yellow-400 font-bold" : "text-muted-foreground"}`}>
          {track.bpm != null ? track.bpm : "—"}
          {differs && track.analyzedBpm != null && (
            <span className="ml-1 text-xs opacity-70">({track.analyzedBpm.toFixed(1)})</span>
          )}
        </span>
      );
    }
    case "key": {
      const differs = track.keyDiffers;
      return track.key ? (
        <span className={`px-2 py-0.5 rounded text-xs font-bold inline-block min-w-[36px] text-center border ${
          differs
            ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-300"
            : "bg-muted border-border"
        }`}>
          {track.key}
          {differs && track.analyzedKey && (
            <span className="block text-[10px] opacity-70">{track.analyzedKey}</span>
          )}
        </span>
      ) : (
        <span>—</span>
      );
    }
    case "length": {
      if (track.length == null) return <span>—</span>;
      const totalSec = track.length;
      return (
        <span className="font-mono text-muted-foreground">
          {Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")}
        </span>
      );
    }
    case "bitrate":
      return (
        <span className="font-mono text-muted-foreground">
          {track.bitrate != null ? `${track.bitrate}` : "—"}
        </span>
      );
    case "analyzed_bitrate": {
      if (track.analyzedBitrate == null) return <span className="text-muted-foreground">—</span>;
      const mismatch =
        track.bitrate != null && Math.abs(track.analyzedBitrate - track.bitrate) > 10;
      return (
        <span className={`font-mono flex items-center gap-1 justify-end ${mismatch ? "text-yellow-400 font-bold" : "text-muted-foreground"}`}>
          {track.analyzedBitrate}
          {mismatch && (
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0 fill-yellow-400" aria-label="Mismatch">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5Zm0 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
            </svg>
          )}
        </span>
      );
    }
    case "analyzed_energy":
      return (
        <span className="font-mono text-muted-foreground">
          {track.analyzedEnergy != null ? Math.round(track.analyzedEnergy * 9 + 1) : "—"}
        </span>
      );
    case "analyzed_loudness_db":
      return (
        <span className="font-mono text-muted-foreground">
          {track.analyzedLoudnessDb != null ? `${track.analyzedLoudnessDb.toFixed(1)} dB` : "—"}
        </span>
      );
    case "analyzed_dynamic_range":
      return (
        <span className="font-mono text-muted-foreground">
          {track.analyzedDynamicRangeDb != null ? `${track.analyzedDynamicRangeDb.toFixed(1)} dB` : "—"}
        </span>
      );
    case "analyzed_danceability":
      return (
        <span className="font-mono text-muted-foreground">
          {track.analyzedDanceability != null ? `${Math.round(track.analyzedDanceability * 100)}%` : "—"}
        </span>
      );
    case "rating":
      return (
        <span className="font-mono text-muted-foreground">
          {track.rating != null ? track.rating : "—"}
        </span>
      );
    default:
      return null;
  }
}
