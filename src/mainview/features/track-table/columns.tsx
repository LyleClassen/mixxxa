import { createColumnHelper, type RowData } from "@tanstack/react-table";
import { Music2 } from "lucide-react";
import type { Track, KeyNotation } from "../../../shared/types";
import type { ReadinessTier } from "../../../shared/systemReadiness";
import { displayKey } from "../../../shared/camelot";
import { SystemReadinessCell } from "./SystemReadinessCell";

// TanStack column definitions for TrackTable. Single source of truth for column
// order, sizing, labels, default visibility, alignment, and cell rendering.
// Column ids must stay stable: they are the keys persisted in localStorage.

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "center" | "right";
  }
  interface TableMeta<TData extends RowData> {
    onSetReadinessOverride?: (trackId: string, tier: ReadinessTier | null) => void;
  }
}

const col = createColumnHelper<Track>();

// Columns are built per-render so the Key column can render in the user's chosen
// notation. Column ids/order/sizing are notation-independent.
export function buildTrackColumns(keyNotation: KeyNotation) {
  return [
  col.display({
    id: "index",
    header: "#",
    size: 25,
    minSize: 25,
    meta: { align: "center" },
    cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.index + 1}</span>,
  }),
  col.display({
    id: "cover",
    header: "Art",
    size: 65,
    minSize: 40,
    cell: () => (
      <div className="w-12 h-8 rounded-sm bg-muted shadow-sm border border-border/50 flex items-center justify-center">
        <Music2 size={14} className="text-muted-foreground/50" />
      </div>
    ),
  }),
  col.accessor("artist", {
    header: "Artist",
    size: 160,
    minSize: 40,
    cell: (info) => <span className="font-medium">{info.getValue() || "—"}</span>,
  }),
  col.accessor("title", {
    header: "Title",
    size: 200,
    minSize: 40,
    enableHiding: false,
    cell: (info) => (
      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
        {info.getValue() || "—"}
      </span>
    ),
  }),
  col.accessor("album", {
    header: "Album",
    size: 160,
    minSize: 40,
    cell: (info) => <span className="text-muted-foreground">{info.getValue() || "—"}</span>,
  }),
  col.accessor("bpm", {
    header: "BPM",
    size: 70,
    minSize: 40,
    meta: { align: "right" },
    cell: ({ row }) => {
      const track = row.original;
      const differs = track.bpmDiffers;
      return (
        <span className={`font-mono ${differs ? "text-yellow-400 font-bold" : "text-muted-foreground"}`}>
          {track.bpm != null ? track.bpm : "—"}
          {differs && track.analyzedBpm != null && (
            <span className="ml-1 text-xs opacity-70">({track.analyzedBpm.toFixed(1)})</span>
          )}
        </span>
      );
    },
  }),
  col.accessor("key", {
    header: "Key",
    size: 70,
    minSize: 40,
    cell: ({ row }) => {
      const track = row.original;
      const differs = track.keyDiffers;
      return track.key ? (
        <span className={`px-2 py-0.5 rounded text-xs font-bold inline-block min-w-[36px] text-center border ${
          differs
            ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-300"
            : "bg-muted border-border"
        }`}>
          {displayKey(track.key, keyNotation)}
          {differs && track.analyzedKey && (
            <span className="block text-[10px] opacity-70">{displayKey(track.analyzedKey, keyNotation)}</span>
          )}
        </span>
      ) : (
        <span>—</span>
      );
    },
  }),
  col.accessor("length", {
    header: "Time",
    size: 70,
    minSize: 40,
    meta: { align: "right" },
    cell: (info) => {
      const totalSec = info.getValue();
      if (totalSec == null) return <span>—</span>;
      return (
        <span className="font-mono text-muted-foreground">
          {Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")}
        </span>
      );
    },
  }),
  col.accessor("bitrate", {
    header: "Bitrate",
    size: 80,
    minSize: 40,
    meta: { align: "right" },
    cell: (info) => (
      <span className="font-mono text-muted-foreground">
        {info.getValue() != null ? `${info.getValue()}` : "—"}
      </span>
    ),
  }),
  col.accessor("systemReadiness", {
    id: "system_readiness",
    header: "Rdy",
    size: 58,
    minSize: 50,
    cell: ({ row, table }) => (
      <SystemReadinessCell track={row.original} onSetOverride={table.options.meta?.onSetReadinessOverride} />
    ),
  }),
  col.accessor("analyzedBitrate", {
    id: "analyzed_bitrate",
    header: "Analyzed Bitrate",
    size: 100,
    minSize: 50,
    meta: { align: "right" },
    cell: ({ row }) => {
      const track = row.original;
      if (track.analyzedBitrate == null) return <span className="text-muted-foreground">—</span>;
      const mismatch =
        track.bitrate != null && Math.abs(track.analyzedBitrate - track.bitrate) > 10;
      return (
        <span className={`font-mono flex items-center gap-1 justify-end ${mismatch ? "text-yellow-400 font-bold" : "text-muted-foreground"}`}>
          {track.analyzedBitrate}
          {mismatch && (
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0 fill-yellow-400" aria-label="Mismatch">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5Zm0 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
            </svg>
          )}
        </span>
      );
    },
  }),
  col.accessor("analyzedEnergy", {
    id: "analyzed_energy",
    header: "Energy",
    size: 80,
    minSize: 50,
    meta: { align: "right" },
    cell: (info) => (
      <span className="font-mono text-muted-foreground">
        {info.getValue() != null ? Math.round(info.getValue()! * 9 + 1) : "—"}
      </span>
    ),
  }),
  col.accessor("analyzedLoudnessDb", {
    id: "analyzed_loudness_db",
    header: "Loudness",
    size: 85,
    minSize: 50,
    meta: { align: "right" },
    cell: (info) => (
      <span className="font-mono text-muted-foreground">
        {info.getValue() != null ? `${info.getValue()!.toFixed(1)} dB` : "—"}
      </span>
    ),
  }),
  col.accessor("analyzedDynamicRangeDb", {
    id: "analyzed_dynamic_range",
    header: "Dyn. Range",
    size: 85,
    minSize: 50,
    meta: { align: "right" },
    cell: (info) => (
      <span className="font-mono text-muted-foreground">
        {info.getValue() != null ? `${info.getValue()!.toFixed(1)} dB` : "—"}
      </span>
    ),
  }),
  col.accessor("analyzedDanceability", {
    id: "analyzed_danceability",
    header: "Danceability",
    size: 90,
    minSize: 50,
    meta: { align: "right" },
    cell: (info) => (
      <span className="font-mono text-muted-foreground">
        {info.getValue() != null ? `${Math.round(info.getValue()! * 100)}%` : "—"}
      </span>
    ),
  }),
  col.accessor("fingerprint", {
    id: "fingerprint",
    header: "Fingerprint",
    size: 120,
    minSize: 50,
    cell: (info) => {
      const fp = info.getValue();
      if (fp == null) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="font-mono text-muted-foreground truncate block" title={fp}>
          {fp.slice(0, 16)}…
        </span>
      );
    },
  }),
  col.accessor("rating", {
    header: "Rating",
    size: 70,
    minSize: 40,
    meta: { align: "center" },
    cell: (info) => (
      <span className="font-mono text-muted-foreground">
        {info.getValue() != null ? info.getValue() : "—"}
      </span>
    ),
  }),
  ];
}

// Notation-independent column metadata, derived once from a reference build.
const REFERENCE_COLUMNS = buildTrackColumns("camelot");

// Accessor columns without an explicit `id` only carry `accessorKey` until the
// table instance derives the id, so fall back to it here.
export const COLUMN_IDS = REFERENCE_COLUMNS.map(
  (c) => (c.id ?? (c as { accessorKey?: string }).accessorKey) as string,
);

export const DEFAULT_HIDDEN = new Set<string>([
  "analyzed_bitrate",
  "analyzed_loudness_db",
  "analyzed_dynamic_range",
  "analyzed_danceability",
  "fingerprint",
]);

// Columns that were removed from DEFAULT_HIDDEN in a past release. On load they
// are treated as a migration (auto-shown) rather than a stored user preference.
export const PREVIOUSLY_DEFAULT_HIDDEN = ["analyzed_energy"];
