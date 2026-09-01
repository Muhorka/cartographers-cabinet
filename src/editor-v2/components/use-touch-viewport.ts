import { useRef, type PointerEvent } from "react";
import type { KernelPoint } from "../geometry/geometry-types";
import type { SheetViewport } from "./map-sheet-geometry";
import { viewportFromTouchGesture, type TouchPair } from "./map-sheet-touch";

type TouchStart = { viewport: SheetViewport; points: TouchPair; bounds: DOMRect };

export function useTouchViewport({ viewport, sheetSize, onChange, onGestureStart }: { viewport: SheetViewport; sheetSize: { width: number; height: number }; onChange?(viewport: SheetViewport): void; onGestureStart(): void }) {
  const pointers = useRef(new Map<number, KernelPoint>()); const start = useRef<TouchStart | undefined>(undefined); const blocked = useRef(false);
  function pair(): TouchPair | undefined { const points = [...pointers.current.values()]; return points.length >= 2 ? [points[0], points[1]] : undefined; }
  function begin(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "touch") return false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); const points = pair();
    if (!points) return false;
    if (!start.current) { start.current = { viewport, points, bounds: event.currentTarget.getBoundingClientRect() }; blocked.current = true; onGestureStart(); }
    event.currentTarget.setPointerCapture(event.pointerId); return true;
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "touch" || !pointers.current.has(event.pointerId)) return false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); const points = pair();
    if (blocked.current && start.current && points) onChange?.(viewportFromTouchGesture(start.current.viewport, start.current.points, points, start.current.bounds, sheetSize));
    return blocked.current;
  }
  function end(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "touch") return false;
    const wasBlocked = blocked.current; pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) start.current = undefined;
    if (!pointers.current.size) blocked.current = false;
    return wasBlocked;
  }
  return { begin, move, end };
}
