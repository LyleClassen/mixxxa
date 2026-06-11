import { useState, useEffect, useMemo } from "react";
import type {
  ColumnOrderState,
  ColumnSizingState,
  OnChangeFn,
  VisibilityState,
} from "@tanstack/react-table";
import { COLUMN_IDS, DEFAULT_HIDDEN, PREVIOUSLY_DEFAULT_HIDDEN } from "./columns";

// localStorage-backed column order / widths / visibility for TrackTable,
// exposed in TanStack Table state shapes. The stored format predates the
// TanStack migration ({ order, widths, hidden[] }) and is kept for back-compat.

interface StoredConfig {
  order: string[];
  widths: Record<string, number>;
  hidden: string[];
}

// In-memory fallback so config survives remounts (the table unmounts while a
// playlist switch loads) even when localStorage is unavailable in the WebView.
const sessionCache = new Map<string, StoredConfig>();

function loadConfig(storageKey: string): StoredConfig {
  const cached = sessionCache.get(storageKey);
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as StoredConfig;
  } catch {}
  return {
    order: [...COLUMN_IDS],
    widths: {},
    hidden: Array.from(DEFAULT_HIDDEN),
  };
}

export function useColumnConfig(storageKey: string) {
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    const stored = loadConfig(storageKey);
    const extra = COLUMN_IDS.filter((id) => !stored.order.includes(id));
    return [...stored.order.filter((id) => COLUMN_IDS.includes(id)), ...extra];
  });

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const stored = loadConfig(storageKey);
    return { ...stored.widths };
  });

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const stored = loadConfig(storageKey);
    const hidden = new Set(stored.hidden);
    // Ensure new analysis columns start hidden if not in stored config
    for (const id of DEFAULT_HIDDEN) {
      if (!stored.order.includes(id)) hidden.add(id);
    }
    // Columns removed from DEFAULT_HIDDEN should be auto-shown on next load
    // (treated as a migration rather than a user preference reset)
    for (const id of PREVIOUSLY_DEFAULT_HIDDEN) {
      if (!DEFAULT_HIDDEN.has(id)) hidden.delete(id);
    }
    return Object.fromEntries(Array.from(hidden, (id) => [id, false]));
  });

  useEffect(() => {
    const config: StoredConfig = {
      order: columnOrder,
      widths: columnSizing,
      hidden: Object.keys(columnVisibility).filter((id) => columnVisibility[id] === false),
    };
    sessionCache.set(storageKey, config);
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch {}
  }, [storageKey, columnOrder, columnSizing, columnVisibility]);

  return useMemo(
    () => ({
      columnOrder,
      columnSizing,
      columnVisibility,
      onColumnOrderChange: setColumnOrder as OnChangeFn<ColumnOrderState>,
      onColumnSizingChange: setColumnSizing as OnChangeFn<ColumnSizingState>,
      onColumnVisibilityChange: setColumnVisibility as OnChangeFn<VisibilityState>,
    }),
    [columnOrder, columnSizing, columnVisibility],
  );
}
