import { useEffect, type RefObject } from "react";

/**
 * Calls `onDismiss` when the user clicks outside `ref` or presses Escape.
 * Shared by the context menus (column / row) and the playlist tree menu, which
 * previously each duplicated this mousedown + keydown effect.
 *
 * Pass `escape: false` to only dismiss on outside-click (e.g. menus that don't
 * need keyboard dismissal).
 */
export function useDismissable(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  { escape = true }: { escape?: boolean } = {},
) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", handleClick);
    if (escape) document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      if (escape) document.removeEventListener("keydown", handleKey);
    };
  }, [ref, onDismiss, escape]);
}
