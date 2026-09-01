import type { KernelPoint } from "../geometry/geometry-types";
import { clientPointToMap } from "./map-sheet-gesture";
import { clientPointToSheet } from "./map-sheet-marquee";
import type { SheetViewport } from "./map-sheet-geometry";

type Bounds = { left: number; top: number; width: number; height: number };
export type TouchPair = readonly [KernelPoint, KernelPoint];

function midpoint([first, second]: TouchPair) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance([first, second]: TouchPair) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function angle([first, second]: TouchPair) {
  return Math.atan2(second.y - first.y, second.x - first.x) * 180 / Math.PI;
}

function normalizedDegrees(degrees: number) {
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

export function viewportFromTouchGesture(startViewport: SheetViewport, start: TouchPair, current: TouchPair, bounds: Bounds, sheetSize: { width: number; height: number }): SheetViewport {
  const startDistance = Math.max(distance(start), 1);
  const zoom = Math.min(10_000, Math.max(.0001, startViewport.zoom * distance(current) / startDistance));
  const rotation = normalizedDegrees(startViewport.rotation + normalizedDegrees(angle(current) - angle(start)));
  const anchor = clientPointToMap(midpoint(start), bounds, sheetSize, startViewport);
  const sheetPoint = clientPointToSheet(midpoint(current), bounds, sheetSize);
  const local = { x: sheetPoint.x - sheetSize.width / 2, y: sheetPoint.y - sheetSize.height / 2 };
  const radians = -rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const mapOffset = { x: (local.x * cosine - local.y * sine) / zoom, y: (local.x * sine + local.y * cosine) / zoom };
  return { zoom, rotation, center: { x: anchor.x - mapOffset.x, y: anchor.y - mapOffset.y } };
}
