import { useState, useMemo, useRef, type CSSProperties } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Track, KeyNotation } from "../../../shared/types";
import type { ReadinessTier } from "../../../shared/systemReadiness";
import { buildTrackColumns } from "./columns";
import { useColumnConfig } from "./useColumnConfig";
import { useRowSelection } from "./useRowSelection";
import { ColumnContextMenu } from "./ColumnContextMenu";
import { RowContextMenu } from "./RowContextMenu";
import { SortableHeaderCell } from "./SortableHeaderCell";
import { SortableTrackRow } from "./SortableTrackRow";

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

  // Column drag-to-reorder state, driven by dnd-kit.
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const columnSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Row drag-to-reorder state, driven by dnd-kit.
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [overRowId, setOverRowId] = useState<string | null>(null);
  const rowSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [headerMenuPos, setHeaderMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ pos: { x: number; y: number }; track: Track } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const rowSelection = useRowSelection(rows.map((r) => r.id), currentPlaylistId);

  const canReorder = reorderable && !searchActive;

  const visibleColumns = table.getVisibleLeafColumns();

  // Re-insert hidden columns (including force-hidden ones like "index" on the
  // Collection view) after their nearest preceding neighbor so they keep
  // their relative position in the full order.
  function reinsertHiddenColumns(newVisible: string[]): string[] {
    const order = columnConfig.columnOrder;
    const visibleIds = visibleColumns.map((c) => c.id);
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
    return newOrder;
  }

  function handleColumnDragStart(event: DragStartEvent) {
    setActiveColId(String(event.active.id));
  }

  function handleColumnDragOver(event: DragOverEvent) {
    setOverColId(event.over ? String(event.over.id) : null);
  }

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveColId(null);
    setOverColId(null);
    if (!over || active.id === over.id) return;
    const visibleIds = visibleColumns.map((c) => c.id);
    const oldIndex = visibleIds.indexOf(String(active.id));
    const newIndex = visibleIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newVisible = arrayMove(visibleIds, oldIndex, newIndex);
    table.setColumnOrder(reinsertHiddenColumns(newVisible));
  }

  function handleColumnDragCancel() {
    setActiveColId(null);
    setOverColId(null);
  }

  function handleRowDragStart(event: DragStartEvent) {
    setActiveRowId(String(event.active.id));
  }

  function handleRowDragOver(event: DragOverEvent) {
    setOverRowId(event.over ? String(event.over.id) : null);
  }

  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveRowId(null);
    setOverRowId(null);
    if (!over || active.id === over.id) return;
    const trackIds = tracks.map((t) => t.id);
    const oldIndex = trackIds.indexOf(String(active.id));
    const newIndex = trackIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder?.(arrayMove(trackIds, oldIndex, newIndex));
  }

  function handleRowDragCancel() {
    setActiveRowId(null);
    setOverRowId(null);
  }

  const activeColIndex = activeColId ? visibleColumns.findIndex((c) => c.id === activeColId) : -1;
  const overColIndex = overColId ? visibleColumns.findIndex((c) => c.id === overColId) : -1;
  const activeRowIndex = activeRowId ? rows.findIndex((r) => r.id === activeRowId) : -1;
  const overRowIndex = overRowId ? rows.findIndex((r) => r.id === overRowId) : -1;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={rowSelection.handleKeyDown}
      className="relative w-full h-full overflow-auto outline-none"
    >
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
          <DndContext
            sensors={columnSensors}
            onDragStart={handleColumnDragStart}
            onDragOver={handleColumnDragOver}
            onDragEnd={handleColumnDragEnd}
            onDragCancel={handleColumnDragCancel}
          >
            <SortableContext items={visibleColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="text-muted-foreground text-xs font-bold uppercase tracking-wider select-none"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setHeaderMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                >
                  {canReorder && <th className="px-1" aria-hidden />}
                  {headerGroup.headers.map((header) => {
                    const colId = header.column.id;
                    const showDropBefore = overColId === colId && overColIndex < activeColIndex;
                    const showDropAfter = overColId === colId && overColIndex > activeColIndex;

                    return (
                      <SortableHeaderCell
                        key={header.id}
                        header={header}
                        showDropBefore={showDropBefore}
                        showDropAfter={showDropAfter}
                      />
                    );
                  })}
                </tr>
              ))}
            </SortableContext>
          </DndContext>
        </thead>

        <DndContext
          sensors={rowSensors}
          onDragStart={handleRowDragStart}
          onDragOver={handleRowDragOver}
          onDragEnd={handleRowDragEnd}
          onDragCancel={handleRowDragCancel}
        >
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <tbody className="divide-y divide-border/50">
              {rows.map((row) => {
                const track = row.original;
                const showDropBefore = overRowId === row.id && overRowIndex < activeRowIndex;
                const showDropAfter = overRowId === row.id && overRowIndex > activeRowIndex;
                const dropStyle: CSSProperties | undefined = showDropBefore
                  ? { boxShadow: "inset 0 2px 0 0 var(--color-primary)" }
                  : showDropAfter
                    ? { boxShadow: "inset 0 -2px 0 0 var(--color-primary)" }
                    : undefined;

                return (
                  <SortableTrackRow
                    key={row.id}
                    row={row}
                    canReorder={canReorder}
                    showDropBefore={showDropBefore}
                    showDropAfter={showDropAfter}
                    selected={rowSelection.selectedIds.has(row.id)}
                    focused={rowSelection.focusedId === row.id}
                    onClick={(e) => {
                      rowSelection.handleRowClick(row.id, e);
                      containerRef.current?.focus();
                    }}
                    onMouseDown={rowSelection.handleRowMouseDown}
                    onDoubleClick={() => onTrackDoubleClick(track)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setRowMenu({ pos: { x: e.clientX, y: e.clientY }, track });
                    }}
                  >
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
                  </SortableTrackRow>
                );
              })}
            </tbody>
          </SortableContext>
        </DndContext>
      </table>
    </div>
  );
}
