import { useEffect, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

// Click/shift-click/ctrl-click + keyboard row selection, tracked by row id
// (not array index/DOM position). `rowIds` is the currently-visible
// (post-filter) row order; `clearKey` is a value that changes whenever
// selection should reset (e.g. the active playlist/view).
export function useRowSelection(rowIds: string[], clearKey: string | null) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setFocusedId(null);
    setAnchorId(null);
  }, [clearKey]);

  function selectRange(fromId: string, toId: string) {
    const fromIdx = rowIds.indexOf(fromId);
    const toIdx = rowIds.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    setSelectedIds(new Set(rowIds.slice(start, end + 1)));
  }

  function handleRowClick(id: string, e: MouseEvent) {
    if (e.shiftKey && anchorId) {
      selectRange(anchorId, id);
      setFocusedId(id);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorId(id);
      setFocusedId(id);
      return;
    }
    setSelectedIds(new Set([id]));
    setAnchorId(id);
    setFocusedId(id);
  }

  // Right-click on a row outside the current selection replaces the
  // selection with just that row (Explorer/Finder convention).
  function selectOnly(id: string) {
    setSelectedIds(new Set([id]));
    setAnchorId(id);
    setFocusedId(id);
  }

  function handleRowMouseDown(e: MouseEvent) {
    // Shift-click for range-select shouldn't trigger native text selection.
    if (e.shiftKey) e.preventDefault();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      setSelectedIds(new Set());
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSelectedIds(new Set(rowIds));
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rowIds.length === 0) return;
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const baseIdx = focusedId ? rowIds.indexOf(focusedId) : -1;
      const nextIdx = Math.min(Math.max(baseIdx + dir, 0), rowIds.length - 1);
      const nextId = rowIds[nextIdx];

      if (e.shiftKey) {
        const anchor = anchorId ?? focusedId ?? nextId;
        setAnchorId(anchor);
        selectRange(anchor, nextId);
      } else {
        setSelectedIds(new Set([nextId]));
        setAnchorId(nextId);
      }
      setFocusedId(nextId);
    }
  }

  return {
    selectedIds,
    focusedId,
    handleRowClick,
    handleRowMouseDown,
    handleKeyDown,
    selectOnly,
  };
}
