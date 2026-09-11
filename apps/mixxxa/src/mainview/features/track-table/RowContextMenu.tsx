import { useRef } from "react";
import { useDismissable } from "../../hooks/useDismissable";
import type { Track } from "../../../shared/types";

// Track row right-click menu: Analyze track(s) / Analyze playlist / Remove
// from playlist for TrackTable. Operates on `tracks` — the effective
// selection at the moment the menu was opened (see TrackTable's
// onContextMenu, which folds in the Explorer/Finder "right-click outside
// selection replaces it" convention before building this list).

interface RowContextMenuProps {
  pos: { x: number; y: number };
  tracks: Track[];
  playlistId: string | null;
  onAnalyzeTrack: (track: Track) => void;
  onAnalyzePlaylist: (playlistId: string) => void;
  onAutoCue?: (track: Track) => void;
  onIdentifyTrack?: (track: Track) => void;
  onRemoveFromPlaylist?: (playlistId: string, trackIds: string[]) => void;
  onClose: () => void;
}

export function RowContextMenu({
  pos,
  tracks,
  playlistId,
  onAnalyzeTrack,
  onAnalyzePlaylist,
  onAutoCue,
  onIdentifyTrack,
  onRemoveFromPlaylist,
  onClose,
}: RowContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, onClose);

  const single = tracks.length === 1 ? tracks[0] : null;

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1001 }}
      className="bg-card border border-border rounded-md shadow-lg py-1 min-w-[180px]"
    >
      <button
        onClick={() => { tracks.forEach(onAnalyzeTrack); onClose(); }}
        className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
      >
        {tracks.length > 1 ? `Analyze ${tracks.length} tracks` : "Analyze track"}
      </button>
      {onAutoCue && single && (
        <button
          onClick={() => { onAutoCue(single); onClose(); }}
          disabled={!single.filePath}
          className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Auto cue points…
        </button>
      )}
      {onIdentifyTrack && single && (
        <button
          onClick={() => { onIdentifyTrack(single); onClose(); }}
          className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
        >
          Identify track…
        </button>
      )}
      {playlistId && (
        <button
          onClick={() => { onAnalyzePlaylist(playlistId); onClose(); }}
          className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
        >
          Analyze playlist
        </button>
      )}
      {playlistId && onRemoveFromPlaylist && (
        <button
          onClick={() => { onRemoveFromPlaylist(playlistId, tracks.map((t) => t.id)); onClose(); }}
          className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
        >
          {tracks.length > 1 ? `Remove ${tracks.length} tracks from playlist` : "Remove from playlist"}
        </button>
      )}
    </div>
  );
}
