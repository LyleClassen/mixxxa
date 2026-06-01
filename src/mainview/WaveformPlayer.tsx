import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Volume2 } from "lucide-react";
import type { Track } from "../shared/types";
import { electroview } from "./rpc";

const VOLUME_KEY = "mixxxa.volume";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WaveformPlayer({ track }: { track: Track | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(VOLUME_KEY);
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [error, setError] = useState(false);

  // Create and destroy wavesurfer instance
  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#52525b",
      progressColor: "#a3e635",
      cursorColor: "#ffffff",
      cursorWidth: 2,
      height: 72,
      normalize: true,
      interact: true,
    });
    wsRef.current = ws;

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("ready", (dur) => {
      setDuration(dur);
      setError(false);
      ws.play();
    });
    ws.on("error", () => setError(true));

    ws.setVolume(volume);

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // volume intentionally excluded — we sync it imperatively below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load track when it changes
  useEffect(() => {
    if (!wsRef.current) return;
    if (!track) {
      wsRef.current.empty();
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setError(false);
      return;
    }

    setError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    electroview.rpc!.request
      .getTrackAudioUrl({ trackId: track.id })
      .then((url) => {
        if (!url) {
          setError(true);
          return;
        }
        wsRef.current?.load(url);
      })
      .catch(() => setError(true));
  }, [track?.id]);

  // Sync volume to wavesurfer when it changes
  useEffect(() => {
    wsRef.current?.setVolume(volume);
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  function togglePlayPause() {
    wsRef.current?.playPause();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {/* Transport */}
        <button
          onClick={togglePlayPause}
          disabled={!track || error}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-primary/20 disabled:opacity-40 disabled:scale-100 shrink-0"
        >
          {isPlaying ? (
            <Pause size={22} />
          ) : (
            <Play size={22} className="ml-0.5" />
          )}
        </button>

        {/* Waveform + time */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div
            ref={containerRef}
            className="h-[72px] bg-muted/60 rounded-lg overflow-hidden border border-border relative"
          >
            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-destructive bg-muted/30">
                Audio file unavailable
              </div>
            )}
            {!track && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Double-click a track to load it
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : "—"}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="accent-primary cursor-pointer"
            style={{ writingMode: "vertical-lr", direction: "rtl", height: "72px" }}
          />
          <Volume2 size={16} className="text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
