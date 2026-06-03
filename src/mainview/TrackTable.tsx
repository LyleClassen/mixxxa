import { useState, useRef, useEffect, useCallback } from "react";
import type { Track } from "../shared/types";
import { Music2 } from "lucide-react";

// ── Column definitions ────────────────────────────────────────────────────────

export interface ColumnDef {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  alwaysVisible: boolean;
}

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "cover",   label: "Cover Art", defaultWidth: 80,  minWidth: 40, alwaysVisible: false },
  { id: "artist",  label: "Artist",    defaultWidth: 160, minWidth: 40, alwaysVisible: false },
  { id: "title",   label: "Title",     defaultWidth: 200, minWidth: 40, alwaysVisible: true  },
  { id: "album",   label: "Album",     defaultWidth: 160, minWidth: 40, alwaysVisible: false },
  { id: "bpm",     label: "BPM",       defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
  { id: "key",     label: "Key",       defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
  { id: "length",  label: "Time",      defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
  { id: "bitrate", label: "Bitrate",   defaultWidth: 80,  minWidth: 40, alwaysVisible: false },
  { id: "rating",  label: "Rating",    defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
];

const DEFAULT_HIDDEN = new Set<string>([]);

// ── useColumnConfig hook ──────────────────────────────────────────────────────

interface StoredConfig {
  order: string[];
  widths: Record<string, number>;
  hidden: string[];
}

function loadConfig(storageKey: string): StoredConfig {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as StoredConfig;
  } catch {}
  return {
    order: DEFAULT_COLUMNS.map((c) => c.id),
    widths: Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, c.defaultWidth])),
    hidden: Array.from(DEFAULT_HIDDEN),
  };
}

function useColumnConfig(storageKey: string) {
  const [order, setOrder] = useState<string[]>(() => {
    const stored = loadConfig(storageKey);
    const extra = DEFAULT_COLUMNS.map((c) => c.id).filter((id) => !stored.order.includes(id));
    return [...stored.order.filter((id) => DEFAULT_COLUMNS.some((c) => c.id === id)), ...extra];
  });

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const stored = loadConfig(storageKey);
    const defaults = Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, c.defaultWidth]));
    return { ...defaults, ...stored.widths };
  });

  const [hidden, setHidden] = useState<Set<string>>(() => {
    const stored = loadConfig(storageKey);
    const base = new Set(stored.hidden);
    // Ensure new analysis columns start hidden if not in stored config
    for (const id of DEFAULT_HIDDEN) {
      if (!stored.order.includes(id)) base.add(id);
    }
    return base;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        order,
        widths,
        hidden: Array.from(hidden),
      }));
    } catch {}
  }, [storageKey, order, widths, hidden]);

  const updateOrder = useCallback((newOrder: string[]) => setOrder(newOrder), []);

  const updateWidth = useCallback((id: string, width: number) => {
    setWidths((prev) => ({ ...prev, [id]: width }));
  }, []);

  const toggleHidden = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { order, widths, hidden, updateOrder, updateWidth, toggleHidden };
}

// ── ColumnContextMenu (header right-click) ────────────────────────────────────

interface ColumnContextMenuProps {
  pos: { x: number; y: number };
  columns: ColumnDef[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}

function ColumnContextMenu({ pos, columns, hidden, onToggle, onClose }: ColumnContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const hideableCols = columns.filter((c) => !c.alwaysVisible);

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
          onClick={() => onToggle(col.id)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
        >
          <span
            className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center shrink-0 ${
              !hidden.has(col.id)
                ? "bg-primary border-primary"
                : "border-border"
            }`}
          >
            {!hidden.has(col.id) && (
              <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-primary-foreground">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span>{col.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── RowContextMenu (track right-click) ───────────────────────────────────────

interface RowContextMenuProps {
  pos: { x: number; y: number };
  track: Track;
  playlistId: string | null;
  onAnalyzeTrack: (track: Track) => void;
  onAnalyzePlaylist: (playlistId: string) => void;
  onClose: () => void;
}

function RowContextMenu({ pos, track, playlistId, onAnalyzeTrack, onAnalyzePlaylist, onClose }: RowContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1001 }}
      className="bg-card border border-border rounded-md shadow-lg py-1 min-w-[180px]"
    >
      <button
        onClick={() => { onAnalyzeTrack(track); onClose(); }}
        className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
      >
        Analyze track
      </button>
      {playlistId && (
        <button
          onClick={() => { onAnalyzePlaylist(playlistId); onClose(); }}
          className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
        >
          Analyze playlist
        </button>
      )}
    </div>
  );
}

// ── TrackTable ────────────────────────────────────────────────────────────────

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

  function renderCell(colId: string, track: Track) {
    switch (colId) {
      case "cover":
        return (
          <div className="w-12 h-8 rounded-sm bg-muted shadow-sm border border-border/50 flex items-center justify-center">
            <Music2 size={14} className="text-muted-foreground/50" />
          </div>
        );
      case "artist":
        return <span className="font-medium">{track.artist || "—"}</span>;
      case "title":
        return (
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            {track.title || "—"}
          </span>
        );
      case "album":
        return <span className="text-muted-foreground">{track.album || "—"}</span>;
      case "bpm": {
        const differs = track.bpmDiffers;
        return (
          <span className={`font-mono ${differs ? "text-yellow-400 font-bold" : "text-muted-foreground"}`}>
            {track.bpm != null ? track.bpm : "—"}
            {differs && track.analyzedBpm != null && (
              <span className="ml-1 text-xs opacity-70">({track.analyzedBpm.toFixed(1)})</span>
            )}
          </span>
        );
      }
      case "key": {
        const differs = track.keyDiffers;
        return track.key ? (
          <span className={`px-2 py-0.5 rounded text-xs font-bold inline-block min-w-[36px] text-center border ${
            differs
              ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-300"
              : "bg-muted border-border"
          }`}>
            {track.key}
            {differs && track.analyzedKey && (
              <span className="block text-[10px] opacity-70">{track.analyzedKey}</span>
            )}
          </span>
        ) : (
          <span>—</span>
        );
      }
      case "length": {
        if (track.length == null) return <span>—</span>;
        const totalSec = Math.round(track.length / 1000);
        return (
          <span className="font-mono text-muted-foreground">
            {Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")}
          </span>
        );
      }
      case "bitrate":
        return (
          <span className="font-mono text-muted-foreground">
            {track.bitrate != null ? `${Math.round(track.bitrate / 1000)}` : "—"}
          </span>
        );
      case "rating":
        return (
          <span className="font-mono text-muted-foreground">
            {track.rating != null ? track.rating : "—"}
          </span>
        );
      default:
        return null;
    }
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
                const isRight = id === "bpm" || id === "length" || id === "bitrate" || id === "rating";
                const isCenter = id === "rating";
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
