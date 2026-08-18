import type { Row } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Track } from "../../../shared/types";

// Same spring feel as column drag-reorder, decided in wayfinder ticket
// "Drag interaction feel" (issue #3): 140ms, spring overshoot.
const SHIFT_TRANSITION = { duration: 140, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" };

export function SortableTrackRow({
  row,
  canReorder,
  showDropBefore,
  showDropAfter,
  onDoubleClick,
  onContextMenu,
  children,
}: {
  row: Row<Track>;
  canReorder: boolean;
  showDropBefore: boolean;
  showDropAfter: boolean;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    transition: SHIFT_TRANSITION,
    disabled: !canReorder,
  });

  const dropStyle: CSSProperties | undefined = showDropBefore
    ? { boxShadow: "inset 0 2px 0 0 var(--color-primary)" }
    : showDropAfter
      ? { boxShadow: "inset 0 -2px 0 0 var(--color-primary)" }
      : undefined;

  return (
    <tr
      ref={setNodeRef}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`hover:bg-muted/30 transition-colors group cursor-pointer ${isDragging ? "opacity-40" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: isDragging ? "relative" : undefined,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      {canReorder && (
        <td className="px-1 align-middle" style={dropStyle}>
          <span
            className="inline-flex items-center justify-center text-muted-foreground/50 hover:text-foreground cursor-grab"
            style={{ touchAction: "none" }}
            onDoubleClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </span>
        </td>
      )}
      {children}
    </tr>
  );
}
