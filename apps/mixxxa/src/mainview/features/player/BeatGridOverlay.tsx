import { useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";

/**
 * Constant-BPM beat grid drawn over the zoomed waveform viewport.
 *
 * The canvas only ever covers the visible viewport (never the full scroll
 * width — a 5-min track at 500 px/s is ~150k px, past canvas size limits), so
 * every redraw recomputes which beats fall inside the current scroll window.
 */
export function BeatGridOverlay({
  ws,
  bpm,
  firstBeatSec,
}: {
  ws: WaveSurfer | null;
  bpm: number | null;
  firstBeatSec: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!ws || !bpm || bpm <= 0) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let rafId = 0;

    const draw = () => {
      rafId = 0;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const duration = ws.getDuration();
      if (!duration || w === 0) return;
      // Wrapper width is the full rendered waveform width, so this stays
      // correct when fillParent stretches the waveform at low zoom levels.
      const wrapper = ws.getWrapper();
      const wrapperWidth = wrapper.clientWidth;
      if (!wrapperWidth) return;
      const pxPerSec = wrapperWidth / duration;
      // The scroll container is padded by half a viewport on each side (for the
      // fixed-center playhead), shifting the waveform right within the scroll
      // content — offset beat positions by the same amount.
      const scrollEl = wrapper.parentElement;
      const padLeft = scrollEl ? parseFloat(getComputedStyle(scrollEl).paddingLeft) || 0 : 0;
      const scrollPx = ws.getScroll() - padLeft;

      const secPerBeat = 60 / bpm;
      const startSec = scrollPx / pxPerSec;
      const endSec = (scrollPx + w) / pxPerSec;
      // Negative k extends the grid before the first detected beat
      const kStart = Math.ceil((startSec - firstBeatSec) / secPerBeat);
      const kEnd = Math.floor((endSec - firstBeatSec) / secPerBeat);

      for (let k = kStart; k <= kEnd; k++) {
        const t = firstBeatSec + k * secPerBeat;
        const x = Math.round(t * pxPerSec - scrollPx);
        const isBar = ((k % 4) + 4) % 4 === 0;
        if (isBar) {
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.fillRect(x - 1, 0, 2, h);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(x, 0, 1, h);
        }
      }
    };

    const schedule = () => {
      if (!rafId) rafId = requestAnimationFrame(draw);
    };

    const unsubs = [
      ws.on("scroll", schedule),
      ws.on("zoom", schedule),
      ws.on("redrawcomplete", schedule),
      ws.on("timeupdate", schedule),
      ws.on("ready", schedule),
    ];
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(canvas);
    schedule();

    return () => {
      unsubs.forEach((unsub) => unsub());
      resizeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ws, bpm, firstBeatSec]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
