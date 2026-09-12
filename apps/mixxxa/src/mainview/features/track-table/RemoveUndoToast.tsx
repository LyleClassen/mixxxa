import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Brief undo affordance shown after a "Remove from playlist" action. The
// local removal is otherwise unrecoverable until the next Rekordbox pull
// sync silently overwrites it (see write-back removal support), so this is
// the only real chance the user has to reverse it.
const UNDO_TIMEOUT_MS = 8000;

interface RemoveUndoToastProps {
  count: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export function RemoveUndoToast({ count, onUndo, onDismiss }: RemoveUndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 1002 }}
      className="flex items-center gap-3 bg-card border border-border rounded-md shadow-lg px-4 py-2.5 text-sm"
    >
      <span>{count > 1 ? `Removed ${count} tracks from playlist` : "Removed from playlist"}</span>
      <Button variant="outline" size="sm" onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}
