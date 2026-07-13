import { useRef } from "react";
import { useDismissable } from "../../hooks/useDismissable";
import type { Track } from "../../../shared/types";

// Track row right-click menu: Analyze track / Analyze playlist for TrackTable.

interface RowContextMenuProps {
  pos: { x: number; y: number };
  track: Track;
  playlistId: string | null;
  onAnalyzeTrack: (track: Track) => void;
  onAnalyzePlaylist: (playlistId: string) => void;
  onAutoCue?: (track: Track) => void;
  onIdentifyTrack?: (track: Track) => void;
  onClose: () => void;
}

export function RowContextMenu({ pos, track, playlistId, onAnalyzeTrack, onAnalyzePlaylist, onAutoCue, onIdentifyTrack, onClose }: RowContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, onClose);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1001 }}
      className="bg-card border border-border rounded-md shadow-lg py-1 min-w-[180px]"
    >
      <button
        onClick={() => { onAnalyzeTrack(track); onClose(); }}
        className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
      >
        Analyze track
      </button>
      {onAutoCue && (
        <button
          onClick={() => { onAutoCue(track); onClose(); }}
          disabled={!track.filePath}
          className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Auto cue points…
        </button>
      )}
      {onIdentifyTrack && (
        <button
          onClick={() => { onIdentifyTrack(track); onClose(); }}
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
    </div>
  );
}
