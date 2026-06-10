import { useState, useCallback } from "react";
import type { Track } from "../../../shared/types";
import { TrackTable } from "./TrackTable";
import { MaterialTrackTable } from "./MaterialTrackTable";

const MODE_KEY = "mixxxa.trackTableMode";

export type TrackTableMode = "classic" | "material";

interface TrackTableProps {
  tracks: Track[];
  onTrackDoubleClick: (track: Track) => void;
  onAnalyzeTrack?: (track: Track) => void;
  onAnalyzePlaylist?: (playlistId: string) => void;
  storageKey: string;
  currentPlaylistId: string | null;
}

// Persisted classic/material selection. Lifted to a hook so App can render the
// toggle in the track-list header while the table lives below it.
export function useTrackTableMode(): [TrackTableMode, (m: TrackTableMode) => void] {
  const [mode, setMode] = useState<TrackTableMode>(() =>
    localStorage.getItem(MODE_KEY) === "material" ? "material" : "classic",
  );
  const update = useCallback((m: TrackTableMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  }, []);
  return [mode, update];
}

// Compact segmented control matching the existing muted/lime chrome.
export function TrackTableModeToggle({
  mode,
  onChange,
}: {
  mode: TrackTableMode;
  onChange: (m: TrackTableMode) => void;
}) {
  const opt = (value: TrackTableMode, label: string) => (
    <button
      onClick={() => onChange(value)}
      className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
        mode === value
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-md p-0.5">
      {opt("classic", "Classic")}
      {opt("material", "Material")}
    </div>
  );
}

// Renders the table matching the current mode with identical props.
export function TrackTableSwitch({ mode, ...props }: { mode: TrackTableMode } & TrackTableProps) {
  return mode === "material" ? <MaterialTrackTable {...props} /> : <TrackTable {...props} />;
}
