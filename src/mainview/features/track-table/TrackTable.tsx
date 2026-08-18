import { useState, useRef, useEffect, useMemo, type CSSProperties } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { GripVertical } from "lucide-react";
import type { Track, KeyNotation } from "../../../shared/types";
import type { ReadinessTier } from "../../../shared/systemReadiness";
import { buildTrackColumns } from "./columns";
import { useColumnConfig } from "./useColumnConfig";
import { ColumnContextMenu } from "./ColumnContextMenu";
import { RowContextMenu } from "./RowContextMenu";
import {
  DragFeelPrototypeSwitcher,
  getDragFeelVariantFromURL,
  setDragFeelVariantInURL,
  type DragFeelVariant,
} from "./DragFeelPrototypeSwitcher";

// PROTOTYPE (throwaway) — wayfinder ticket #3 "Drag interaction feel"
// (https://github.com/LyleClassen/mixxxa/issues/3). VARIANT_META and every
// `variant === "..."` branch below exist only to compare drag feels; once one
// wins, delete the losers, this comment, and DragFeelPrototypeSwitcher.tsx.
const VARIANT_META: Record<
  DragFeelVariant,
  {
    overlay: "none" | "ghost" | "card";
    indicator: "line" | "slot" | "growLine";
    shiftMs: number;
    shiftEasing: string;
  }
> = {
  A: { overlay: "none", indicator: "line", shiftMs: 0, shiftEasing: "linear" },
  B: { overlay: "ghost", indicator: "slot", shiftMs: 220, shiftEasing: "ease-in-out" },
  C: { overlay: "card", indicator: "growLine", shiftMs: 140, shiftEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
};

function GrowBar({ className, style }: { className: string; style?: CSSProperties }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span
      className={className}
      style={{
        ...style,
        transform: shown ? "scaleY(1)" : "scaleY(0)",
        transition: "transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    />
  );
}

export interface TrackTableProps {
  tracks: Track[];
  onTrackDoubleClick: (track: Track) => void;
  onAnalyzeTrack?: (track: Track) => void;
  onAnalyzePlaylist?: (playlistId: string) => void;
  onAutoCue?: (track: Track) => void;
  onIdentifyTrack?: (track: Track) => void;
  onDiscardPendingMetadata?: (trackId: string) => void;
  storageKey: string;
  currentPlaylistId: string | null;
  keyNotation: KeyNotation;
  // Reorder support — enabled only for real playlists (not the Collection view).
  reorderable?: boolean;
  // The "#" position column is meaningless on the Collection view; hiding it
  // here is forced and does not touch the user's stored visibility preference.
  showIndexColumn?: boolean;
  // Active search filter; reordering a filtered subset is ambiguous, so disable it.
  searchActive?: boolean;
  onReorder?: (orderedTrackIds: string[]) => void;
  onSetReadinessOverride?: (trackId: string, tier: ReadinessTier | null) => void;
}

export function TrackTable({
  tracks,
  onTrackDoubleClick,
  onAnalyzeTrack,
  onAnalyzePlaylist,
  onAutoCue,
  onIdentifyTrack,
  onDiscardPendingMetadata,
  storageKey,
  currentPlaylistId,
  keyNotation,
  reorderable = false,
  searchActive = false,
  showIndexColumn = true,
  onReorder,
  onSetReadinessOverride,
}: TrackTableProps) {
  const columnConfig = useColumnConfig(storageKey);
  const columns = useMemo(() => buildTrackColumns(keyNotation), [keyNotation]);

  // Forced override on top of stored visibility. Safe to layer here: visibility
  // updaters are applied against the hook's own state, so the override never
  // leaks into localStorage.
  const columnVisibility = showIndexColumn
    ? columnConfig.columnVisibility
    : { ...columnConfig.columnVisibility, index: false };

  const table = useReactTable({
    data: tracks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (track) => track.id,
    state: {
      columnOrder: columnConfig.columnOrder,
      columnSizing: columnConfig.columnSizing,
      columnVisibility,
    },
    onColumnOrderChange: columnConfig.onColumnOrderChange,
    onColumnSizingChange: columnConfig.onColumnSizingChange,
    onColumnVisibilityChange: columnConfig.onColumnVisibilityChange,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    meta: { onSetReadinessOverride, onDiscardPendingMetadata },
  });

  const reorderRef = useRef<{ colId: string; startX: number } | null>(null);
  const [reorderDrag, setReorderDrag] = useState<{ colId: string; dropIndex: number } | null>(null);

  // Row drag-to-reorder state (mirrors the column-reorder pointer pattern).
  const rowReorderRef = useRef<{ trackId: string; startY: number; rowHeight: number } | null>(null);
  const [rowDrag, setRowDrag] = useState<{ trackId: string; dropIndex: number } | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // PROTOTYPE — see VARIANT_META comment above.
  const [dragFeelVariant, setDragFeelVariant] = useState<DragFeelVariant>(getDragFeelVariantFromURL);
  const variantMeta = VARIANT_META[dragFeelVariant];
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  function changeDragFeelVariant(v: DragFeelVariant) {
    setDragFeelVariant(v);
    setDragFeelVariantInURL(v);
  }

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
        setPointerPos(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rowDrag]);

  const visibleColumns = table.getVisibleLeafColumns();

  function computeDropIndex(clientX: number): number {
    if (!headerRowRef.current) return 0;
    const rect = headerRowRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    let cum = 0;
    for (let i = 0; i < visibleColumns.length; i++) {
      const w = visibleColumns[i].getSize();
      if (relX < cum + w / 2) return i;
      cum += w;
    }
    return visibleColumns.length;
  }

  function commitReorder(dragColId: string, dropIndex: number) {
    const visibleIds = visibleColumns.map((c) => c.id);
    const fromIndex = visibleIds.indexOf(dragColId);
    if (fromIndex === -1) return;
    const newVisible = [...visibleIds];
    newVisible.splice(fromIndex, 1);
    const adjustedDrop = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
    newVisible.splice(adjustedDrop, 0, dragColId);
    // Re-insert hidden columns (including force-hidden ones like "index" on the
    // Collection view) after their nearest preceding neighbor so they keep
    // their relative position in the full order.
    const order = columnConfig.columnOrder;
    const hiddenInOrder = order.filter((id) => !visibleIds.includes(id));
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
    table.setColumnOrder(newOrder);
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

  // PROTOTYPE — px offset to preview a column/row sliding out of the way of an
  // in-flight drag. Zero for variant A (no shift preview, matches current prod behavior).
  function computeColumnShiftPx(colIdx: number): number {
    if (!reorderDrag || variantMeta.shiftMs === 0) return 0;
    const fromIndex = visibleColumns.findIndex((c) => c.id === reorderDrag.colId);
    if (fromIndex === -1 || colIdx === fromIndex) return 0;
    const draggedWidth = visibleColumns[fromIndex].getSize();
    const dropIdx = reorderDrag.dropIndex;
    if (fromIndex < dropIdx && colIdx > fromIndex && colIdx < dropIdx) return -draggedWidth;
    if (fromIndex > dropIdx && colIdx >= dropIdx && colIdx < fromIndex) return draggedWidth;
    return 0;
  }

  function computeRowShiftPx(rowIdx: number): number {
    if (!rowDrag || variantMeta.shiftMs === 0) return 0;
    const fromIndex = tracks.findIndex((t) => t.id === rowDrag.trackId);
    if (fromIndex === -1 || rowIdx === fromIndex) return 0;
    const rowHeight = rowReorderRef.current?.rowHeight ?? 37;
    const dropIdx = rowDrag.dropIndex;
    if (fromIndex < dropIdx && rowIdx > fromIndex && rowIdx < dropIdx) return -rowHeight;
    if (fromIndex > dropIdx && rowIdx >= dropIdx && rowIdx < fromIndex) return rowHeight;
    return 0;
  }

  const dropIndicatorIndex = reorderDrag?.dropIndex ?? null;
  const rows = table.getRowModel().rows;

  // PROTOTYPE — floating overlay content for the "ghost"/"card" variants.
  const overlayLabel = reorderDrag
    ? (visibleColumns.find((c) => c.id === reorderDrag.colId)?.columnDef.header as string) ?? reorderDrag.colId
    : rowDrag
      ? (() => {
          const t = tracks.find((tr) => tr.id === rowDrag.trackId);
          return t ? `${t.title ?? "Untitled"} — ${t.artist ?? "Unknown"}` : "";
        })()
      : null;
  const showOverlay = variantMeta.overlay !== "none" && (reorderDrag || rowDrag) && pointerPos;

  return (
    <div className="relative w-full h-full overflow-auto">
      {headerMenuPos && (
        <ColumnContextMenu
          pos={headerMenuPos}
          columns={table.getAllLeafColumns().filter((c) => showIndexColumn || c.id !== "index")}
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
          onAutoCue={onAutoCue}
          onIdentifyTrack={onIdentifyTrack}
          onClose={() => setRowMenu(null)}
        />
      )}

      <table
        className="w-full text-left text-sm whitespace-nowrap"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          {canReorder && <col style={{ width: 32 }} />}
          {visibleColumns.map((column) => (
            <col key={column.id} style={{ width: column.getSize() }} />
          ))}
        </colgroup>

        <thead className="sticky top-0 bg-background z-10 shadow-sm border-b border-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              ref={headerRowRef}
              className="text-muted-foreground text-xs font-bold uppercase tracking-wider select-none"
              onContextMenu={(e) => {
                e.preventDefault();
                setHeaderMenuPos({ x: e.clientX, y: e.clientY });
              }}
            >
              {canReorder && <th className="px-1" aria-hidden />}
              {headerGroup.headers.map((header, colIdx) => {
                const colId = header.column.id;
                const isDragging = reorderDrag?.colId === colId;
                const showDropBefore = dropIndicatorIndex === colIdx;
                const showDropAfter = dropIndicatorIndex === visibleColumns.length && colIdx === visibleColumns.length - 1;
                // PROTOTYPE
                const shiftPx = computeColumnShiftPx(colIdx);
                const draggedOpacity = isDragging ? (variantMeta.overlay === "none" ? 0.4 : 0) : 1;
                const indicatorClass =
                  variantMeta.indicator === "slot"
                    ? "absolute top-0 h-full w-2 rounded-sm bg-primary/30 border-x border-primary/50 z-20"
                    : variantMeta.indicator === "growLine"
                      ? "absolute top-0 h-full w-1 bg-primary shadow-[0_0_6px_var(--color-primary)] z-20"
                      : "absolute top-0 h-full w-0.5 bg-primary z-20";

                return (
                  <th
                    key={header.id}
                    className={`relative px-3 py-4 font-medium overflow-hidden ${isDragging && variantMeta.overlay === "none" ? "outline outline-1 outline-primary" : ""}`}
                    style={{
                      position: "relative",
                      opacity: draggedOpacity,
                      transform: shiftPx ? `translateX(${shiftPx}px)` : undefined,
                      transition: isDragging
                        ? "opacity 100ms ease-out"
                        : `transform ${variantMeta.shiftMs}ms ${variantMeta.shiftEasing}`,
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      reorderRef.current = { colId, startX: e.clientX };
                      setReorderDrag({ colId, dropIndex: colIdx });
                      setPointerPos({ x: e.clientX, y: e.clientY });
                    }}
                    onPointerMove={(e) => {
                      if (!reorderRef.current || reorderRef.current.colId !== colId) return;
                      const drop = computeDropIndex(e.clientX);
                      setReorderDrag({ colId, dropIndex: drop });
                      setPointerPos({ x: e.clientX, y: e.clientY });
                    }}
                    onPointerUp={(e) => {
                      if (!reorderRef.current || reorderRef.current.colId !== colId) return;
                      const drop = computeDropIndex(e.clientX);
                      commitReorder(colId, drop);
                      reorderRef.current = null;
                      setReorderDrag(null);
                      setPointerPos(null);
                    }}
                    onPointerCancel={() => {
                      if (reorderRef.current?.colId !== colId) return;
                      reorderRef.current = null;
                      setReorderDrag(null);
                      setPointerPos(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && reorderRef.current?.colId === colId) {
                        reorderRef.current = null;
                        setReorderDrag(null);
                        setPointerPos(null);
                      }
                    }}
                  >
                    {showDropBefore &&
                      (variantMeta.indicator === "growLine" ? (
                        <GrowBar key={`before-${colIdx}`} className={`${indicatorClass} left-0`} style={{ pointerEvents: "none" }} />
                      ) : (
                        <span className={`${indicatorClass} left-0`} style={{ pointerEvents: "none" }} />
                      ))}
                    {showDropAfter &&
                      (variantMeta.indicator === "growLine" ? (
                        <GrowBar key={`after-${colIdx}`} className={`${indicatorClass} right-0`} style={{ pointerEvents: "none" }} />
                      ) : (
                        <span className={`${indicatorClass} right-0`} style={{ pointerEvents: "none" }} />
                      ))}

                    <span className="truncate block pr-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
              })}
            </tr>
          ))}
        </thead>

        <tbody ref={tbodyRef} className="divide-y divide-border/50">
          {rows.map((row, rowIdx) => {
            const track = row.original;
            const isRowDragging = rowDrag?.trackId === track.id;
            const showDropBefore = rowDrag != null && rowDrag.dropIndex === rowIdx;
            const showDropAfter =
              rowDrag != null && rowDrag.dropIndex === rows.length && rowIdx === rows.length - 1;
            // PROTOTYPE — variant-dependent indicator + shift preview.
            const shiftPx = computeRowShiftPx(rowIdx);
            const rowDraggedOpacity = isRowDragging ? (variantMeta.overlay === "none" ? 0.4 : 0) : 1;
            const indicatorShadow =
              variantMeta.indicator === "slot"
                ? "inset 0 0 0 9999px transparent, inset 0 3px 0 0 var(--color-primary), inset 0 -3px 0 0 var(--color-primary)"
                : variantMeta.indicator === "growLine"
                  ? "0 0 6px var(--color-primary)"
                  : undefined;
            const dropStyle: CSSProperties | undefined = showDropBefore
              ? {
                  boxShadow:
                    variantMeta.indicator === "slot"
                      ? "inset 0 3px 0 0 var(--color-primary), inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent)"
                      : `inset 0 2px 0 0 var(--color-primary)${indicatorShadow ? `, ${indicatorShadow}` : ""}`,
                }
              : showDropAfter
                ? {
                    boxShadow:
                      variantMeta.indicator === "slot"
                        ? "inset 0 -3px 0 0 var(--color-primary), inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent)"
                        : `inset 0 -2px 0 0 var(--color-primary)${indicatorShadow ? `, ${indicatorShadow}` : ""}`,
                  }
                : undefined;

            return (
              <tr
                key={row.id}
                onDoubleClick={() => onTrackDoubleClick(track)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setRowMenu({ pos: { x: e.clientX, y: e.clientY }, track });
                }}
                className="hover:bg-muted/30 transition-colors group cursor-pointer"
                style={{
                  opacity: rowDraggedOpacity,
                  transform: shiftPx ? `translateY(${shiftPx}px)` : undefined,
                  transition: isRowDragging
                    ? "opacity 100ms ease-out"
                    : `transform ${variantMeta.shiftMs}ms ${variantMeta.shiftEasing}`,
                  position: shiftPx ? "relative" : undefined,
                  zIndex: isRowDragging || shiftPx ? 5 : undefined,
                }}
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
                        const rowHeight = e.currentTarget.closest("tr")?.getBoundingClientRect().height ?? 37;
                        rowReorderRef.current = { trackId: track.id, startY: e.clientY, rowHeight };
                        setRowDrag({ trackId: track.id, dropIndex: rowIdx });
                        setPointerPos({ x: e.clientX, y: e.clientY });
                      }}
                      onPointerMove={(e) => {
                        if (!rowReorderRef.current || rowReorderRef.current.trackId !== track.id) return;
                        const drop = computeRowDropIndex(e.clientY);
                        setRowDrag({ trackId: track.id, dropIndex: drop });
                        setPointerPos({ x: e.clientX, y: e.clientY });
                      }}
                      onPointerUp={(e) => {
                        if (!rowReorderRef.current || rowReorderRef.current.trackId !== track.id) return;
                        const drop = computeRowDropIndex(e.clientY);
                        commitRowReorder(track.id, drop);
                        rowReorderRef.current = null;
                        setRowDrag(null);
                        setPointerPos(null);
                      }}
                      onPointerCancel={() => {
                        if (rowReorderRef.current?.trackId !== track.id) return;
                        rowReorderRef.current = null;
                        setRowDrag(null);
                        setPointerPos(null);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onContextMenu={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={14} />
                    </span>
                  </td>
                )}
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align;
                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-2.5 overflow-hidden ${align === "center" ? "text-center" : align === "right" ? "text-right" : ""}`}
                      style={dropStyle}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* PROTOTYPE — floating drag overlay for the "ghost"/"card" variants. */}
      {showOverlay && pointerPos && (
        <div
          className={
            variantMeta.overlay === "card"
              ? "fixed z-50 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-xl scale-105"
              : "fixed z-50 rounded border border-primary/30 bg-background/70 px-2 py-1 text-xs text-muted-foreground shadow-md backdrop-blur-sm"
          }
          style={{
            left: pointerPos.x + 12,
            top: pointerPos.y + 12,
            pointerEvents: "none",
            maxWidth: 260,
          }}
        >
          <span className="truncate block">{overlayLabel}</span>
        </div>
      )}

      <DragFeelPrototypeSwitcher variant={dragFeelVariant} onChange={changeDragFeelVariant} />
    </div>
  );
}
