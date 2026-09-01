import type { MouseEvent, PointerEvent } from "react";
import type { KernelPoint } from "../geometry/geometry-types";
import { clientPointToMap } from "./map-sheet-gesture";
import type { SheetViewport } from "./map-sheet-geometry";

export type MapPointPicker = { onPick(point: KernelPoint): void; cancel(): void };

/** A read-only point request takes precedence over drawing/selection, not map controls. */
export function captureMapPoint(event: MouseEvent<SVGSVGElement>, picker: MapPointPicker | undefined, viewport: SheetViewport, size: { width: number; height: number }) {
  if (!picker || event.button !== 0 || (event.target as Element).closest("[data-viewport-dial]")) return false;
  event.preventDefault(); event.stopPropagation();
  picker.onPick(clientPointToMap({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), size, viewport));
  return true;
}

export function capturePointPointer(event: PointerEvent<SVGSVGElement>, picker?: MapPointPicker) {
  if (picker && event.button === 0 && !(event.target as Element).closest("[data-viewport-dial]")) { event.preventDefault(); event.stopPropagation(); return true; }
  return false;
}
