import { useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { CueMarker } from "../../../shared/types";

const HOT_CUE_DEFAULT_COLOR = "#28E214";
const MEMORY_CUE_COLOR = "#a1a1aa"; // zinc-400

function cueColor(cue: CueMarker): string {
  if (cue.color) return cue.color;
  return cue.kind > 0 ? HOT_CUE_DEFAULT_COLOR : MEMORY_CUE_COLOR;
}

function cueLabel(cue: CueMarker): string | null {
  if (cue.kind === 0) return null;
  if (cue.kind <= 8) return String.fromCharCode(64 + cue.kind); // A-H
  return "•";
}

function cueTitle(cue: CueMarker): string {
  const name = cue.kind > 0 ? `Hot Cue ${cueLabel(cue)}` : "Memory Cue";
  return cue.comment ? `${name} — ${cue.comment}` : name;
}

/**
 * Cue markers drawn over the zoomed waveform viewport.
 *
 * Markers are DOM elements (clickable, only ever a handful per track) whose x
 * positions are updated imperatively in a rAF — same event-driven pattern as
 * BeatGridOverlay — so React never re-renders during per-frame scrolling.
 */
export function CueMarkersOverlay({
  ws,
  cues,
  onCueClick,
}: {
  ws: WaveSurfer | null;
  cues: CueMarker[];
  onCueClick: (positionSec: number) => void;
}) {
  const markerRefs = useRef(new Map<string, HTMLDivElement>());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!ws || cues.length === 0 || !container) return;

    let rafId = 0;

    const update = () => {
      rafId = 0;
      const duration = ws.getDuration();
      const wrapper = ws.getWrapper();
      if (!duration) return;
      const w = container.clientWidth;
      const wrapperWidth = wrapper.clientWidth;
      if (!w || !wrapperWidth) return;
      const pxPerSec = wrapperWidth / duration;
      // The scroll container is padded by half a viewport on each side (for
      // the fixed-center playhead) — offset cue positions by the same amount.
      const padLeft = parseFloat(getComputedStyle(wrapper.parentElement!).paddingLeft) || 0;
      const scrollPx = ws.getScroll() - padLeft;

      for (const cue of cues) {
        const el = markerRefs.current.get(cue.id);
        if (!el) continue;
        const x = cue.positionSec * pxPerSec - scrollPx;
        if (x < -24 || x > w + 24) {
          el.style.display = "none";
        } else {
          el.style.display = "";
          el.style.transform = `translateX(${x}px)`;
        }
      }
    };

    const schedule = () => {
      if (!rafId) rafId = requestAnimationFrame(update);
    };

    const unsubs = [
      ws.on("scroll", schedule),
      ws.on("zoom", schedule),
      ws.on("redrawcomplete", schedule),
      ws.on("timeupdate", schedule),
      ws.on("ready", schedule),
    ];
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(container);
    schedule();

    return () => {
      unsubs.forEach((unsub) => unsub());
      resizeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ws, cues]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
      {cues.map((cue) => {
        const color = cueColor(cue);
        const label = cueLabel(cue);
        return (
          <div
            key={cue.id}
            ref={(el) => {
              if (el) markerRefs.current.set(cue.id, el);
              else markerRefs.current.delete(cue.id);
            }}
            onClick={() => onCueClick(cue.positionSec)}
            title={cueTitle(cue)}
            // Hidden until the first rAF positions it — avoids a flash at x=0
            style={{ display: "none" }}
            className="absolute top-0 bottom-0 pointer-events-auto cursor-pointer"
          >
            <div
              className="absolute top-0 bottom-0 left-0 w-0.5"
              style={{ backgroundColor: color }}
            />
            {label !== null ? (
              <div
                className="absolute top-0 left-0 px-1 rounded-br text-[9px] font-bold leading-3 text-black"
                style={{ backgroundColor: color }}
              >
                {label}
              </div>
            ) : (
              <div
                className="absolute top-0 left-0 w-1.5 h-1.5"
                style={{ backgroundColor: color }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Non-interactive cue ticks over the minimap. The minimap never scrolls, so
 * positions are plain percentages — no imperative updates needed.
 */
export function CueMinimapTicks({ cues, duration }: { cues: CueMarker[]; duration: number }) {
  if (duration <= 0) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {cues.map((cue) => {
        if (cue.positionSec > duration) return null;
        return (
          <div
            key={cue.id}
            className="absolute top-0 bottom-0 w-0.5 opacity-70"
            style={{
              left: `${(cue.positionSec / duration) * 100}%`,
              backgroundColor: cueColor(cue),
            }}
          />
        );
      })}
    </div>
  );
}
