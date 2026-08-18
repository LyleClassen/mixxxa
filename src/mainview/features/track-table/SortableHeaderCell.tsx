import { flexRender, type Header } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Track } from "../../../shared/types";

// dnd-kit shift transition — matches the spring feel decided in wayfinder
// ticket "Drag interaction feel" (issue #3): 140ms, spring overshoot.
const SHIFT_TRANSITION = { duration: 140, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" };

export function SortableHeaderCell({
  header,
  showDropBefore,
  showDropAfter,
}: {
  header: Header<Track, unknown>;
  showDropBefore: boolean;
  showDropAfter: boolean;
}) {
  const colId = header.column.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colId,
    transition: SHIFT_TRANSITION,
  });

  return (
    <th
      ref={setNodeRef}
      className={`relative px-3 py-4 font-medium overflow-hidden ${isDragging ? "opacity-40 outline outline-1 outline-primary" : ""}`}
      style={{
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      {showDropBefore && (
        <span
          className="absolute left-0 top-0 h-full w-0.5 bg-primary z-20"
          style={{ pointerEvents: "none" }}
        />
      )}
      {showDropAfter && (
        <span
          className="absolute right-0 top-0 h-full w-0.5 bg-primary z-20"
          style={{ pointerEvents: "none" }}
        />
      )}

      <span className="truncate block pr-2">
        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
      </span>

      <span
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize z-10"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
      />
    </th>
  );
}
