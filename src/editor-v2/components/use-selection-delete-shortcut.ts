import { useEffect } from "react";

/** Delete follows the selection even when focus stayed on a tool, never a layer. */
export function useSelectionDeleteShortcut(onDelete: (() => void) | undefined) {
  useEffect(() => {
    if (!onDelete) return;
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Delete" || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"], dialog')) return;
      event.preventDefault(); onDelete();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onDelete]);
}
