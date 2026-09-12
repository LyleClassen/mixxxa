import { useRef, useState } from "react";
import type { CueMarker } from "../../../shared/types";
import { slotColor } from "../../../shared/cueColors";
import { useDismissable } from "../../hooks/useDismissable";

// 2×4 A–H hot-cue pad grid. Slots 1-4 = A-D (top row), 5-8 = E-H (bottom row).
// Lit pad (cue set): click = jump, right-click = delete menu.
// Unlit pad: click = set cue at the current playhead.

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

function slotLetter(slot: number): string {
  return String.fromCharCode(64 + slot); // 1 → A
}

interface HotCueGridProps {
  cues: CueMarker[];
  onJump: (slot: number, positionSec: number) => void;
  onSet: (slot: number) => void;
  onDelete: (slot: number) => void;
  disabled?: boolean;
}

export function HotCueGrid({ cues, onJump, onSet, onDelete, disabled }: HotCueGridProps) {
  const [menu, setMenu] = useState<{ slot: number; x: number; y: number } | null>(null);

  const cueBySlot = new Map<number, CueMarker>();
  for (const c of cues) {
    if (c.kind >= 1 && c.kind <= 8) cueBySlot.set(c.kind, c);
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      {SLOTS.map((slot) => {
        const cue = cueBySlot.get(slot);
        const lit = cue != null;
        const color = cue?.color ?? slotColor(slot) ?? "#28E214";
        return (
          <button
            key={slot}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              if (cue) onJump(slot, cue.positionSec);
              else onSet(slot);
            }}
            onContextMenu={(e) => {
              if (!cue) return; // right-click on unlit pad is a no-op
              e.preventDefault();
              setMenu({ slot, x: e.clientX, y: e.clientY });
            }}
            title={cue?.comment ?? `Hot cue ${slotLetter(slot)}`}
            className={`h-9 rounded text-xs font-bold transition-colors disabled:opacity-40 ${
              lit
                ? "text-black"
                : "border border-border text-muted-foreground hover:bg-muted/50"
            }`}
            style={lit ? { backgroundColor: color } : undefined}
          >
            {slotLetter(slot)}
          </button>
        );
      })}

      {menu && (
        <HotCueContextMenu
          x={menu.x}
          y={menu.y}
          onDelete={() => { onDelete(menu.slot); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function HotCueContextMenu({
  x, y, onDelete, onClose,
}: { x: number; y: number; onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, onClose);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 1001 }}
      className="bg-card border border-border rounded-md shadow-lg py-1 min-w-[140px]"
    >
      <button
        onClick={onDelete}
        className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left text-destructive"
      >
        Delete cue
      </button>
    </div>
  );
}
