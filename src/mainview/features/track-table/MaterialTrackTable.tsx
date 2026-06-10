import { useMemo, useState, useCallback, useEffect } from "react";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
  type MRT_VisibilityState,
  type MRT_ColumnOrderState,
  type MRT_ColumnSizingState,
} from "material-react-table";
import { ThemeProvider } from "@mui/material/styles";
import type { Track } from "../../../shared/types";
import { DEFAULT_COLUMNS, DEFAULT_HIDDEN, RIGHT_ALIGNED, CENTER_ALIGNED } from "./columns";
import { renderCell } from "./cells";
import { ColumnContextMenu } from "./ColumnContextMenu";
import { RowContextMenu } from "./RowContextMenu";
import { getMuiTheme } from "../../lib/muiTheme";

interface MaterialTrackTableProps {
  tracks: Track[];
  onTrackDoubleClick: (track: Track) => void;
  onAnalyzeTrack?: (track: Track) => void;
  onAnalyzePlaylist?: (playlistId: string) => void;
  storageKey: string;
  currentPlaylistId: string | null;
}

const MRT_KEY_SUFFIX = ".mrt";

type Align = "left" | "right" | "center";

function alignFor(id: string): Align {
  if (CENTER_ALIGNED.has(id)) return "center";
  if (RIGHT_ALIGNED.has(id)) return "right";
  return "left";
}

interface MrtPersistedState {
  visibility: MRT_VisibilityState;
  order: MRT_ColumnOrderState;
  sizing: MRT_ColumnSizingState;
}

function defaultVisibility(): MRT_VisibilityState {
  return Object.fromEntries(Array.from(DEFAULT_HIDDEN).map((id) => [id, false]));
}

function defaultOrder(): MRT_ColumnOrderState {
  return DEFAULT_COLUMNS.map((c) => c.id);
}

// Keep stored order entries that still exist, then append any columns added
// since the config was saved (mirrors the classic table's migration behaviour).
function mergeOrder(stored: MRT_ColumnOrderState | undefined): MRT_ColumnOrderState {
  const all = defaultOrder();
  if (!stored) return all;
  const known = stored.filter((id) => all.includes(id));
  const extra = all.filter((id) => !known.includes(id));
  return [...known, ...extra];
}

function loadMrtState(storageKey: string): MrtPersistedState {
  try {
    const raw = localStorage.getItem(storageKey + MRT_KEY_SUFFIX);
    if (raw) {
      const p = JSON.parse(raw) as Partial<MrtPersistedState>;
      return {
        visibility: p.visibility ?? defaultVisibility(),
        order: mergeOrder(p.order),
        sizing: p.sizing ?? {},
      };
    }
  } catch { }
  return { visibility: defaultVisibility(), order: defaultOrder(), sizing: {} };
}

// Outer wrapper provides the MUI theme. The table hook must run *inside* the
// ThemeProvider: material-react-table computes its `baseBackgroundColor` from
// `useTheme()` during `useMaterialReactTable`, so if that hook ran above the
// provider it would read MUI's default *light* theme and paint the whole table
// white. Splitting the body into an inner component fixes the context position.
export function MaterialTrackTable(props: MaterialTrackTableProps) {
  const theme = useMemo(() => getMuiTheme(), []);
  return (
    <ThemeProvider theme={theme}>
      <MaterialTrackTableInner {...props} />
    </ThemeProvider>
  );
}

function MaterialTrackTableInner({
  tracks,
  onTrackDoubleClick,
  onAnalyzeTrack,
  onAnalyzePlaylist,
  storageKey,
  currentPlaylistId,
}: MaterialTrackTableProps) {
  const [{ visibility: initVisibility, order: initOrder, sizing: initSizing }] = useState(() =>
    loadMrtState(storageKey),
  );
  const [columnVisibility, setColumnVisibility] = useState<MRT_VisibilityState>(initVisibility);
  const [columnOrder, setColumnOrder] = useState<MRT_ColumnOrderState>(initOrder);
  const [columnSizing, setColumnSizing] = useState<MRT_ColumnSizingState>(initSizing);

  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ pos: { x: number; y: number }; track: Track } | null>(null);

  // Persist the three pieces as a single blob, only when they actually change.
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey + MRT_KEY_SUFFIX,
        JSON.stringify({ visibility: columnVisibility, order: columnOrder, sizing: columnSizing }),
      );
    } catch { }
  }, [storageKey, columnVisibility, columnOrder, columnSizing]);

  const openHeaderMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setHeaderMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const columns = useMemo<MRT_ColumnDef<Track>[]>(
    () =>
      DEFAULT_COLUMNS.map((c) => ({
        id: c.id,
        header: c.label,
        accessorFn: () => "", // display handled entirely by the shared Cell renderer
        size: c.defaultWidth,
        minSize: c.minWidth,
        enableHiding: !c.alwaysVisible,
        enableColumnDragging: !c.alwaysVisible,
        Cell: ({ row }: { row: MRT_Row<Track> }) => renderCell(c.id, row.original),
        muiTableHeadCellProps: { align: alignFor(c.id), onContextMenu: openHeaderMenu },
        muiTableBodyCellProps: { align: alignFor(c.id) },
      })),
    [openHeaderMenu],
  );

  const rowProps = useCallback(
    ({ row }: { row: MRT_Row<Track> }) => ({
      onDoubleClick: () => onTrackDoubleClick(row.original),
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        setRowMenu({ pos: { x: e.clientX, y: e.clientY }, track: row.original });
      },
      sx: { cursor: "pointer" },
    }),
    [onTrackDoubleClick],
  );

  const toggleColumn = useCallback((id: string) => {
    setColumnVisibility((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  }, []);

  // Set of currently hidden ids, for the right-click ColumnContextMenu parity UI.
  const hiddenSet = useMemo(
    () => new Set(Object.entries(columnVisibility).filter(([, v]) => v === false).map(([id]) => id)),
    [columnVisibility],
  );

  const table = useMaterialReactTable({
    columns,
    data: tracks,
    getRowId: (row) => row.id,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enableColumnOrdering: true,
    enableColumnDragging: true,
    enableRowVirtualization: true,
    enablePagination: false,
    enableBottomToolbar: false,
    enableSorting: false,
    enableColumnFilters: false,
    enableGlobalFilter: false,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnActions: false,
    enableStickyHeader: true,
    initialState: { density: "compact" },
    state: { columnVisibility, columnOrder, columnSizing },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    // MRT defaults its surface color to lighten(background.default, 0.05) in dark
    // mode (~#23232a here). Pin it to the app's --background so rows read the same
    // #111115 as the classic table instead of a lighter grey.
    mrtTheme: (theme) => ({ baseBackgroundColor: theme.palette.background.paper }),
    muiTableBodyRowProps: rowProps,
    muiTablePaperProps: {
      sx: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxShadow: "none",
        backgroundColor: "transparent",
        borderRadius: 0,
      },
    },
    muiTableContainerProps: { sx: { flex: 1 } },
  });

  return (
    <div className="relative w-full h-full">
      {headerMenu && (
        <ColumnContextMenu
          pos={headerMenu}
          columns={DEFAULT_COLUMNS}
          hidden={hiddenSet}
          onToggle={toggleColumn}
          onClose={() => setHeaderMenu(null)}
        />
      )}
      {rowMenu && (
        <RowContextMenu
          pos={rowMenu.pos}
          track={rowMenu.track}
          playlistId={currentPlaylistId}
          onAnalyzeTrack={onAnalyzeTrack ?? (() => { })}
          onAnalyzePlaylist={onAnalyzePlaylist ?? (() => { })}
          onClose={() => setRowMenu(null)}
        />
      )}
      <MaterialReactTable table={table} />
    </div>
  );
}
