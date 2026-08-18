// PROTOTYPE (throwaway) — wayfinder ticket #3 "Drag interaction feel"
// (https://github.com/LyleClassen/mixxxa/issues/3). Delete this file once a
// variant is picked and folded into TrackTable.tsx.
import { useEffect } from "react";

export type DragFeelVariant = "A" | "B" | "C";

export const DRAG_FEEL_VARIANTS: { key: DragFeelVariant; label: string }[] = [
  { key: "A", label: "A — Dim + line (current)" },
  { key: "B", label: "B — Floating ghost + slot" },
  { key: "C", label: "C — Elevated card + snap" },
];

export function getDragFeelVariantFromURL(): DragFeelVariant {
  const v = new URLSearchParams(window.location.search).get("variant");
  return v === "B" || v === "C" ? v : "A";
}

export function setDragFeelVariantInURL(v: DragFeelVariant) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", v);
  window.history.replaceState(null, "", url.toString());
}

export function DragFeelPrototypeSwitcher({
  variant,
  onChange,
}: {
  variant: DragFeelVariant;
  onChange: (v: DragFeelVariant) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const idx = DRAG_FEEL_VARIANTS.findIndex((v) => v.key === variant);
      if (e.key === "ArrowLeft") {
        onChange(DRAG_FEEL_VARIANTS[(idx - 1 + DRAG_FEEL_VARIANTS.length) % DRAG_FEEL_VARIANTS.length].key);
      } else if (e.key === "ArrowRight") {
        onChange(DRAG_FEEL_VARIANTS[(idx + 1) % DRAG_FEEL_VARIANTS.length].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, onChange]);

  if (import.meta.env.PROD) return null;

  const idx = DRAG_FEEL_VARIANTS.findIndex((v) => v.key === variant);
  const current = DRAG_FEEL_VARIANTS[idx];

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-primary/40 bg-background px-4 py-2 text-sm shadow-lg"
      style={{ pointerEvents: "auto" }}
    >
      <button
        className="px-2 py-1 rounded hover:bg-muted"
        onClick={() =>
          onChange(DRAG_FEEL_VARIANTS[(idx - 1 + DRAG_FEEL_VARIANTS.length) % DRAG_FEEL_VARIANTS.length].key)
        }
      >
        ←
      </button>
      <span className="font-medium whitespace-nowrap">{current.label}</span>
      <button
        className="px-2 py-1 rounded hover:bg-muted"
        onClick={() => onChange(DRAG_FEEL_VARIANTS[(idx + 1) % DRAG_FEEL_VARIANTS.length].key)}
      >
        →
      </button>
    </div>
  );
}
