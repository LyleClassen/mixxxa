import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import Minimap from "wavesurfer.js/plugins/minimap";
import { Play, Pause, Volume2, ZoomIn, ZoomOut } from "lucide-react";
import type { CueMarker, Track } from "../../../shared/types";
import { electroview } from "../../rpc";
import { BeatGridOverlay } from "./BeatGridOverlay";
import { CueMarkersOverlay, CueMinimapTicks } from "./CueMarkersOverlay";

const VOLUME_KEY = "mixxxa.volume";
const ZOOM_KEY = "mixxxa.zoom";
const DEFAULT_ZOOM = 50;
const MIN_ZOOM = 10;
const MAX_ZOOM = 500;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function loadSavedZoom(): number {
  const saved = parseFloat(localStorage.getItem(ZOOM_KEY) ?? "");
  return Number.isFinite(saved) ? clampZoom(saved) : DEFAULT_ZOOM;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface BeatGrid {
  bpm: number;
  firstBeatSec: number;
}

export interface WaveformPlayerHandle {
  getCurrentTime(): number;
  seekTo(sec: number): void;
  setCues(cues: CueMarker[]): void;
}

export const WaveformPlayer = forwardRef<
  WaveformPlayerHandle,
  { track: Track | null; onCuesChanged?: (cues: CueMarker[]) => void }
>(function WaveformPlayer({ track, onCuesChanged }, ref) {
  const overviewRef = useRef<HTMLDivElement>(null);
  const zoomedRef = useRef<HTMLDivElement>(null);
  // The trackId of the most recent load request — used to discard stale async
  // results (RPC responses, ready-event peak saves) after rapid track switches.
  const loadedTrackIdRef = useRef<string | null>(null);
  const hadCachedPeaksRef = useRef(false);
  const centerScrollRef = useRef<(() => void) | null>(null);
  const [ws, setWs] = useState<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(VOLUME_KEY);
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [zoom, setZoom] = useState(loadSavedZoom);
  const [grid, setGrid] = useState<BeatGrid | null>(null);
  const [cues, setCues] = useState<CueMarker[]>([]);
  const [error, setError] = useState(false);

  function updateCues(next: CueMarker[]) {
    setCues(next);
    onCuesChanged?.(next);
  }

  useImperativeHandle(ref, () => ({
    getCurrentTime() {
      return ws?.getCurrentTime() ?? 0;
    },
    seekTo(sec: number) {
      ws?.setTime(sec);
    },
    setCues(next: CueMarker[]) {
      // Driven by App after a hot-cue edit — feeds the existing overlay/minimap
      // update path without re-notifying App (which already has the new cues).
      setCues(next);
    },
  }), [ws]);

  // Create and destroy wavesurfer instance
  useEffect(() => {
    if (!zoomedRef.current || !overviewRef.current) return;
    const instance = WaveSurfer.create({
      container: zoomedRef.current,
      waveColor: "#52525b",
      progressColor: "#a3e635",
      cursorColor: "#ffffff",
      cursorWidth: 1,
      height: 96,
      normalize: true,
      interact: true,
      minPxPerSec: loadSavedZoom(),
      // Scrolling is driven manually below so the playhead stays pixel-locked
      // at the viewport center from 0:00 to the end (wavesurfer's autoCenter
      // clamps scrollLeft at 0, making the cursor travel left-to-center first).
      autoScroll: false,
      autoCenter: false,
      // fillParent would size the wrapper to the padded (zero-width) content
      // box at low zoom levels, collapsing the waveform.
      fillParent: false,
      hideScrollbar: true,
      dragToSeek: true,
      plugins: [
        Minimap.create({
          container: overviewRef.current,
          height: 36,
          waveColor: "#3f3f46",
          progressColor: "#a3e635",
          cursorColor: "#ffffff",
          cursorWidth: 1,
          normalize: true,
          overlayColor: "rgba(163,230,53,0.12)",
        }),
      ],
    });

    // Rekordbox-style fixed-center playhead: pad the scroll area by half the
    // viewport on each side so position 0 can sit at the center, then keep
    // scrollLeft = currentTime * pxPerSec (cursor centered for the whole track).
    const scrollEl = instance.getWrapper().parentElement as HTMLElement;
    const container = zoomedRef.current;
    // Wavesurfer's .scroll element is width:100% content-box, so the padding
    // would otherwise widen it past the container and clamp scrolling half a
    // viewport short of the track end (waveform end never reaches the playhead).
    scrollEl.style.boxSizing = "border-box";
    const updatePadding = () => {
      const half = Math.round(container.clientWidth / 2);
      scrollEl.style.paddingLeft = `${half}px`;
      scrollEl.style.paddingRight = `${half}px`;
    };
    updatePadding();

    const centerScroll = () => {
      const dur = instance.getDuration();
      if (!dur) return;
      const pxPerSec = instance.getWrapper().clientWidth / dur;
      instance.setScroll(instance.getCurrentTime() * pxPerSec);
    };
    centerScrollRef.current = centerScroll;

    const resizeObserver = new ResizeObserver(() => {
      updatePadding();
      centerScroll();
    });
    resizeObserver.observe(container);

    instance.on("redrawcomplete", centerScroll);
    instance.on("zoom", centerScroll);

    instance.on("play", () => setIsPlaying(true));
    instance.on("pause", () => setIsPlaying(false));
    instance.on("finish", () => setIsPlaying(false));
    instance.on("timeupdate", (t) => {
      setCurrentTime(t);
      centerScroll();
    });
    instance.on("ready", (dur) => {
      setDuration(dur);
      setError(false);
      centerScroll();
      // Persist freshly decoded peaks so the next load renders instantly.
      const trackId = loadedTrackIdRef.current;
      if (trackId && !hadCachedPeaksRef.current) {
        try {
          const peaks = instance.exportPeaks({ channels: 1, maxLength: 8000, precision: 1000 })[0];
          if (peaks && peaks.length > 0) {
            electroview.rpc!.request
              .saveWaveformPeaks({ trackId, peaks, duration: dur })
              .catch(() => {});
          }
        } catch {
          // exportPeaks throws without decoded audio — nothing to save
        }
      }
      instance.play()?.catch(() => {});
    });
    instance.on("error", () => setError(true));

    instance.setVolume(volume);
    setWs(instance);

    return () => {
      resizeObserver.disconnect();
      centerScrollRef.current = null;
      instance.destroy();
      setWs(null);
    };
    // volume/zoom intentionally excluded — synced imperatively below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load track when it changes
  useEffect(() => {
    if (!ws) return;
    if (!track) {
      loadedTrackIdRef.current = null;
      ws.empty();
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setError(false);
      setGrid(null);
      updateCues([]);
      return;
    }

    setError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setGrid(null);
    updateCues([]);

    const trackId = track.id;
    loadedTrackIdRef.current = trackId;

    Promise.all([
      electroview.rpc!.request.getWaveformData({ trackId }),
      electroview.rpc!.request.getTrackAudioUrl({ trackId }),
    ])
      .then(([wf, url]) => {
        if (loadedTrackIdRef.current !== trackId) return; // stale — track switched
        if (!url) {
          setError(true);
          return;
        }
        hadCachedPeaksRef.current = !!wf?.peaks && wf.peaks.length > 0;
        if (wf?.bpm && wf.bpm > 0) {
          setGrid({ bpm: wf.bpm, firstBeatSec: wf.firstBeatSec });
        }
        updateCues(wf?.cues ?? []);
        ws.load(
          url,
          wf?.peaks && wf.peaks.length > 0 ? [wf.peaks] : undefined,
          wf?.duration ?? undefined,
        ).catch(() => {
          if (loadedTrackIdRef.current === trackId) setError(true);
        });
      })
      .catch(() => {
        if (loadedTrackIdRef.current === trackId) setError(true);
      });
  }, [ws, track?.id]);

  // Sync volume to wavesurfer when it changes
  useEffect(() => {
    ws?.setVolume(volume);
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [ws, volume]);

  function applyZoom(next: number) {
    const clamped = clampZoom(next);
    setZoom(clamped);
    localStorage.setItem(ZOOM_KEY, String(clamped));
    try {
      ws?.zoom(clamped);
      centerScrollRef.current?.();
    } catch {
      // zoom() throws before audio is loaded — value still persists for next load
    }
  }

  function togglePlayPause() {
    ws?.playPause();
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

        {/* Waveforms + time */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          {/* Overview (minimap) — cue ticks are a sibling of the minimap
              container because wavesurfer manages that container's children */}
          <div className="relative">
            <div
              ref={overviewRef}
              className="h-[36px] bg-muted/60 rounded-md overflow-hidden border border-border relative"
            />
            <CueMinimapTicks cues={cues} duration={duration} />
          </div>

          {/* Zoomed waveform */}
          <div className="relative">
            <div
              ref={zoomedRef}
              className="h-[96px] bg-muted/60 rounded-lg overflow-hidden border border-border"
            />
            <BeatGridOverlay
              ws={ws}
              bpm={grid?.bpm ?? null}
              firstBeatSec={grid?.firstBeatSec ?? 0}
            />
            <CueMarkersOverlay
              ws={ws}
              cues={cues}
              onCueClick={(sec) => ws?.setTime(sec)}
            />
            {/* Fixed center playhead — the waveform scrolls beneath it */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-primary/70 pointer-events-none z-10" />

            {/* Zoom controls */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
              <button
                onClick={() => applyZoom(zoom * 1.5)}
                disabled={zoom >= MAX_ZOOM}
                className="w-6 h-6 rounded bg-background/70 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                title="Zoom in"
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => applyZoom(zoom / 1.5)}
                disabled={zoom <= MIN_ZOOM}
                className="w-6 h-6 rounded bg-background/70 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                title="Zoom out"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={() => applyZoom(DEFAULT_ZOOM)}
                className="w-6 h-6 rounded bg-background/70 border border-border flex items-center justify-center text-[9px] font-mono text-muted-foreground hover:text-foreground"
                title="Reset zoom"
              >
                RST
              </button>
            </div>

            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-destructive bg-muted/30 rounded-lg">
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
            style={{ writingMode: "vertical-lr", direction: "rtl", height: "140px" }}
          />
          <Volume2 size={16} className="text-muted-foreground" />
        </div>
      </div>
    </div>
  );
});
