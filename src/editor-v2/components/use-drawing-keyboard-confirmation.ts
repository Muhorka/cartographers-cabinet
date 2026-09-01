"use client";

import { useEffect } from "react";
import { isPolygonGesture, type MapGestureInstrument } from "./map-sheet-gesture";

export function useDrawingKeyboardConfirmation(activeGesture: MapGestureInstrument | undefined, confirmPen: () => void, confirmMultiClick: () => void) {
  useEffect(() => {
    function confirmDrawing(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== "Enter" || !activeGesture || !isPolygonGesture(activeGesture)) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (activeGesture === "pen") confirmPen(); else confirmMultiClick();
    }
    window.addEventListener("keydown", confirmDrawing);
    return () => window.removeEventListener("keydown", confirmDrawing);
  });
}
