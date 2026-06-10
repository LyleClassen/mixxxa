import { useRef } from "react";
import { useDismissable } from "../../hooks/useDismissable";
import type { ColumnDef } from "./columns";

// Header right-click menu: toggle column visibility for TrackTable.

interface ColumnContextMenuProps {
  pos: { x: number; y: number };
  columns: ColumnDef[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}

export function ColumnContextMenu({ pos, columns, hidden, onToggle, onClose }: ColumnContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, onClose);

  const hideableCols = columns.filter((c) => !c.alwaysVisible);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1000 }}
      className="bg-card border border-border rounded-md shadow-lg py-1 min-w-[160px]"
    >
      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Columns
      </div>
      {hideableCols.map((col) => (
        <button
          key={col.id}
          onClick={() => onToggle(col.id)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
        >
          <span
            className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center shrink-0 ${
              !hidden.has(col.id)
                ? "bg-primary border-primary"
                : "border-border"
            }`}
          >
            {!hidden.has(col.id) && (
              <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-primary-foreground">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span>{col.label}</span>
        </button>
      ))}
    </div>
  );
}
