import { useState, useRef } from "react";
import type { Track } from "../../../shared/types";
import { DEFAULT_COLUMNS, RIGHT_ALIGNED, CENTER_ALIGNED } from "./columns";
import { useColumnConfig } from "./useColumnConfig";
import { ColumnContextMenu } from "./ColumnContextMenu";
import { RowContextMenu } from "./RowContextMenu";
import { renderCell } from "./cells";

interface TrackTableProps {
  tracks: Track[];
  onTrackDoubleClick: (track: Track) => void;
  onAnalyzeTrack?: (track: Track) => void;
  onAnalyzePlaylist?: (playlistId: string) => void;
  storageKey: string;
  currentPlaylistId: string | null;
}

export function TrackTable({
  tracks,
  onTrackDoubleClick,
  onAnalyzeTrack,
  onAnalyzePlaylist,
  storageKey,
  currentPlaylistId,
}: TrackTableProps) {
  const { order, widths, hidden, updateOrder, updateWidth, toggleHidden } = useColumnConfig(storageKey);

  const resizeRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);
  const reorderRef = useRef<{ colId: string; startX: number } | null>(null);
  const [reorderDrag, setReorderDrag] = useState<{ colId: string; dropIndex: number } | null>(null);

  const [headerMenuPos, setHeaderMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ pos: { x: number; y: number }; track: Track } | null>(null);

  const headerRowRef = useRef<HTMLTableRowElement>(null);

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

        <tbody className="divide-y divide-border/50">
          {tracks.map((track) => (
            <tr
              key={track.id}
              onDoubleClick={() => onTrackDoubleClick(track)}
              onContextMenu={(e) => {
                e.preventDefault();
                setRowMenu({ pos: { x: e.clientX, y: e.clientY }, track });
              }}
              className="hover:bg-muted/30 transition-colors group cursor-pointer"
            >
              {visibleCols.map((id) => {
                const isRight = RIGHT_ALIGNED.has(id);
                const isCenter = CENTER_ALIGNED.has(id);
                return (
                  <td
                    key={id}
                    className={`px-3 py-2.5 overflow-hidden ${isCenter ? "text-center" : isRight ? "text-right" : ""}`}
                  >
                    {renderCell(id, track)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
