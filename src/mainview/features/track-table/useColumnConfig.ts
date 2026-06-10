import { useState, useEffect, useCallback } from "react";
import { DEFAULT_COLUMNS, DEFAULT_HIDDEN, PREVIOUSLY_DEFAULT_HIDDEN } from "./columns";

// localStorage-backed column order / widths / visibility for TrackTable.

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

export function useColumnConfig(storageKey: string) {
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
    // Columns removed from DEFAULT_HIDDEN should be auto-shown on next load
    // (treated as a migration rather than a user preference reset)
    for (const id of PREVIOUSLY_DEFAULT_HIDDEN) {
      if (!DEFAULT_HIDDEN.has(id)) base.delete(id);
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
