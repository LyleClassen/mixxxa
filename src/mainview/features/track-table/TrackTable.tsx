import { useState, useRef, useEffect, type CSSProperties } from "react";
import { GripVertical } from "lucide-react";
import type { Track } from "../../../shared/types";
import { DEFAULT_COLUMNS, RIGHT_ALIGNED, CENTER_ALIGNED } from "./columns";
import { useColumnConfig } from "./useColumnConfig";
import { ColumnContextMenu } from "./ColumnContextMenu";
import { RowContextMenu } from "./RowContextMenu";
import { renderCell } from "./cells";

export interface TrackTableProps {
  tracks: Track[];
  onTrackDoubleClick: (track: Track) => void;
  onAnalyzeTrack?: (track: Track) => void;
  onAnalyzePlaylist?: (playlistId: string) => void;
  storageKey: string;
  currentPlaylistId: string | null;
  // Reorder support — enabled only for real playlists (not the Collection view).
  reorderable?: boolean;
  // Active search filter; reordering a filtered subset is ambiguous, so disable it.
  searchActive?: boolean;
  onReorder?: (orderedTrackIds: string[]) => void;
}

export function TrackTable({
  tracks,
  onTrackDoubleClick,
  onAnalyzeTrack,
  onAnalyzePlaylist,
  storageKey,
  currentPlaylistId,
  reorderable = false,
  searchActive = false,
  onReorder,
}: TrackTableProps) {
  const { order, widths, hidden, updateOrder, updateWidth, toggleHidden } = useColumnConfig(storageKey);

  const resizeRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);
  const reorderRef = useRef<{ colId: string; startX: number } | null>(null);
  const [reorderDrag, setReorderDrag] = useState<{ colId: string; dropIndex: number } | null>(null);

  // Row drag-to-reorder state (mirrors the column-reorder pointer pattern).
  const rowReorderRef = useRef<{ trackId: string; startY: number } | null>(null);
  const [rowDrag, setRowDrag] = useState<{ trackId: string; dropIndex: number } | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const [headerMenuPos, setHeaderMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ pos: { x: number; y: number }; track: Track } | null>(null);

  const headerRowRef = useRef<HTMLTableRowElement>(null);

  const canReorder = reorderable && !searchActive;

  // Escape-to-cancel an in-flight row drag.
  useEffect(() => {
    if (!rowDrag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        rowReorderRef.current = null;
        setRowDrag(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rowDrag]);

  const visibleCols = order.filter((id) => !hidden.has(id));
  const colMap = Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, c]));

  function computeDropIndex(clientX: number): number {
    if (!headerRowRef.current) return 0;
    const rect = headerRowRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    let cum = 0;
    for (let i = 0; i < visibleCols.length; i++) {
      const w = widths[visibleCols[i]] ?? colMap[visibleCols[i]]?.defaultWidth ?? 100;
      if (relX < cum + w / 2) return i;
      cum += w;
    }
    return visibleCols.length;
  }

  function commitReorder(dragColId: string, dropIndex: number) {
    const fromIndex = visibleCols.indexOf(dragColId);
    if (fromIndex === -1) return;
    const newVisible = [...visibleCols];
    newVisible.splice(fromIndex, 1);
    const adjustedDrop = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
    newVisible.splice(adjustedDrop, 0, dragColId);
    const hiddenInOrder = order.filter((id) => hidden.has(id));
    const newOrder = [...newVisible];
    for (const hiddenId of hiddenInOrder) {
      const origIdx = order.indexOf(hiddenId);
      let insertAt = newOrder.length;
      for (let i = origIdx - 1; i >= 0; i--) {
        const ref = order[i];
        const refNewIdx = newOrder.indexOf(ref);
        if (refNewIdx !== -1) { insertAt = refNewIdx + 1; break; }
      }
      newOrder.splice(insertAt, 0, hiddenId);
    }
    updateOrder(newOrder);
  }

  // Vertical insertion index (0..tracks.length) from a pointer Y position, using
  // each rendered row's bounding rect against its vertical midpoint.
  function computeRowDropIndex(clientY: number): number {
    const tbody = tbodyRef.current;
    if (!tbody) return 0;
    const rows = tbody.children;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return rows.length;
  }

  function commitRowReorder(trackId: string, dropIndex: number) {
    const fromIndex = tracks.findIndex((t) => t.id === trackId);
    if (fromIndex === -1) return;
    const adjustedDrop = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
    if (adjustedDrop === fromIndex) return; // no-op
    const newOrder = tracks.map((t) => t.id);
    newOrder.splice(fromIndex, 1);
    newOrder.splice(adjustedDrop, 0, trackId);
    onReorder?.(newOrder);
  }

  const dropIndicatorIndex = reorderDrag?.dropIndex ?? null;

  return (
    <div className="relative w-full h-full overflow-auto">
      {headerMenuPos && (
        <ColumnContextMenu
          pos={headerMenuPos}
          columns={DEFAULT_COLUMNS}
          hidden={hidden}
          onToggle={toggleHidden}
          onClose={() => setHeaderMenuPos(null)}
        />
      )}
      {rowMenu && (
        <RowContextMenu
          pos={rowMenu.pos}
          track={rowMenu.track}
          playlistId={currentPlaylistId}
          onAnalyzeTrack={onAnalyzeTrack ?? (() => {})}
          onAnalyzePlaylist={onAnalyzePlaylist ?? (() => {})}
          onClose={() => setRowMenu(null)}
        />
      )}

      <table
        className="w-full text-left text-sm whitespace-nowrap"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          {canReorder && <col style={{ width: 32 }} />}
          {visibleCols.map((id) => (
            <col key={id} style={{ width: widths[id] ?? colMap[id]?.defaultWidth ?? 100 }} />
          ))}
        </colgroup>

        <thead className="sticky top-0 bg-background z-10 shadow-sm border-b border-border">
          <tr
            ref={headerRowRef}
            className="text-muted-foreground text-xs font-bold uppercase tracking-wider select-none"
            onContextMenu={(e) => {
              e.preventDefault();
              setHeaderMenuPos({ x: e.clientX, y: e.clientY });
            }}
          >
            {canReorder && <th className="px-1" aria-hidden />}
            {visibleCols.map((id, colIdx) => {
              const col = colMap[id];
              const isDragging = reorderDrag?.colId === id;
              const showDropBefore = dropIndicatorIndex === colIdx;
              const showDropAfter = dropIndicatorIndex === visibleCols.length && colIdx === visibleCols.length - 1;

              return (
                <th
                  key={id}
                  className={`relative px-3 py-4 font-medium overflow-hidden ${isDragging ? "opacity-40 outline outline-1 outline-primary" : ""}`}
                  style={{ position: "relative" }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    reorderRef.current = { colId: id, startX: e.clientX };
                    setReorderDrag({ colId: id, dropIndex: colIdx });
                  }}
                  onPointerMove={(e) => {
                    if (!reorderRef.current || reorderRef.current.colId !== id) return;
                    const drop = computeDropIndex(e.clientX);
                    setReorderDrag({ colId: id, dropIndex: drop });
                  }}
                  onPointerUp={(e) => {
                    if (!reorderRef.current || reorderRef.current.colId !== id) return;
                    const drop = computeDropIndex(e.clientX);
                    commitReorder(id, drop);
                    reorderRef.current = null;
                    setReorderDrag(null);
                  }}
                  onPointerCancel={() => {
                    if (reorderRef.current?.colId !== id) return;
                    reorderRef.current = null;
                    setReorderDrag(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && reorderRef.current?.colId === id) {
                      reorderRef.current = null;
                      setReorderDrag(null);
                    }
                  }}
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

                  <span className="truncate block pr-2">{col?.label ?? id}</span>

                  <span
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize z-10"
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      resizeRef.current = {
                        colId: id,
                        startX: e.clientX,
                        startWidth: widths[id] ?? col?.defaultWidth ?? 100,
                      };
                    }}
                    onPointerMove={(e) => {
                      if (!resizeRef.current || resizeRef.current.colId !== id) return;
                      const delta = e.clientX - resizeRef.current.startX;
                      const minW = col?.minWidth ?? 40;
                      const newWidth = Math.max(minW, resizeRef.current.startWidth + delta);
                      updateWidth(id, newWidth);
                    }}
                    onPointerUp={() => { resizeRef.current = null; }}
                    onPointerCancel={() => { resizeRef.current = null; }}
                  />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody ref={tbodyRef} className="divide-y divide-border/50">
          {tracks.map((track, rowIdx) => {
            const isRowDragging = rowDrag?.trackId === track.id;
            const showDropBefore = rowDrag != null && rowDrag.dropIndex === rowIdx;
            const showDropAfter =
              rowDrag != null && rowDrag.dropIndex === tracks.length && rowIdx === tracks.length - 1;
            const dropStyle: CSSProperties | undefined = showDropBefore
              ? { boxShadow: "inset 0 2px 0 0 var(--color-primary)" }
              : showDropAfter
                ? { boxShadow: "inset 0 -2px 0 0 var(--color-primary)" }
                : undefined;

            return (
              <tr
                key={track.id}
                onDoubleClick={() => onTrackDoubleClick(track)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setRowMenu({ pos: { x: e.clientX, y: e.clientY }, track });
                }}
                className={`hover:bg-muted/30 transition-colors group cursor-pointer ${isRowDragging ? "opacity-40" : ""}`}
              >
                {canReorder && (
                  <td className="px-1 align-middle" style={dropStyle}>
                    <span
                      className="inline-flex items-center justify-center text-muted-foreground/50 hover:text-foreground cursor-grab"
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        rowReorderRef.current = { trackId: track.id, startY: e.clientY };
                        setRowDrag({ trackId: track.id, dropIndex: rowIdx });
                      }}
                      onPointerMove={(e) => {
                        if (!rowReorderRef.current || rowReorderRef.current.trackId !== track.id) return;
                        const drop = computeRowDropIndex(e.clientY);
                        setRowDrag({ trackId: track.id, dropIndex: drop });
                      }}
                      onPointerUp={(e) => {
                        if (!rowReorderRef.current || rowReorderRef.current.trackId !== track.id) return;
                        const drop = computeRowDropIndex(e.clientY);
                        commitRowReorder(track.id, drop);
                        rowReorderRef.current = null;
                        setRowDrag(null);
                      }}
                      onPointerCancel={() => {
                        if (rowReorderRef.current?.trackId !== track.id) return;
                        rowReorderRef.current = null;
                        setRowDrag(null);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onContextMenu={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={14} />
                    </span>
                  </td>
                )}
                {visibleCols.map((id) => {
                  const isRight = RIGHT_ALIGNED.has(id);
                  const isCenter = CENTER_ALIGNED.has(id);
                  return (
                    <td
                      key={id}
                      className={`px-3 py-2.5 overflow-hidden ${isCenter ? "text-center" : isRight ? "text-right" : ""}`}
                      style={dropStyle}
                    >
                      {renderCell(id, track, rowIdx)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
