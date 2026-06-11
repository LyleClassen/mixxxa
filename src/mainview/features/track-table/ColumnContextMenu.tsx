import { useRef } from "react";
import type { Column } from "@tanstack/react-table";
import { useDismissable } from "../../hooks/useDismissable";
import type { Track } from "../../../shared/types";

// Header right-click menu: toggle column visibility for TrackTable.

interface ColumnContextMenuProps {
  pos: { x: number; y: number };
  columns: Column<Track, unknown>[];
  onClose: () => void;
}

export function ColumnContextMenu({ pos, columns, onClose }: ColumnContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, onClose);

  const hideableCols = columns.filter((c) => c.getCanHide());

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
          // Pass the value explicitly: the no-arg toggleVisibility() computes
          // !getIsVisible() inside the state updater, reading the live table
          // instance — non-idempotent, so StrictMode's dev replay un-toggles it.
          onClick={() => col.toggleVisibility(!col.getIsVisible())}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
        >
          <span
            className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center shrink-0 ${
              col.getIsVisible()
                ? "bg-primary border-primary"
                : "border-border"
            }`}
          >
            {col.getIsVisible() && (
              <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-primary-foreground">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span>{String(col.columnDef.header)}</span>
        </button>
      ))}
    </div>
  );
}
