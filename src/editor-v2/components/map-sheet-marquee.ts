import type { KernelPoint } from "../geometry/geometry-types";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import type { MapSelection } from "./map-sheet";

export type MarqueeDraft = {
  pointerId: number;
  clientStart: KernelPoint;
  clientEnd: KernelPoint;
  sheetStart: KernelPoint;
  sheetEnd: KernelPoint;
};

type Bounds = { left: number; top: number; width: number; height: number };

export function clientPointToSheet(point: KernelPoint, bounds: Bounds, sheetSize: { width: number; height: number }) {
  const scale = Math.min(bounds.width / sheetSize.width, bounds.height / sheetSize.height) || 1;
  const offsetX = bounds.left + (bounds.width - sheetSize.width * scale) / 2;
  const offsetY = bounds.top + (bounds.height - sheetSize.height * scale) / 2;
  return { x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale };
}

export function marqueeRect(start: KernelPoint, end: KernelPoint) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

export function selectionsInMarquee(svg: SVGSVGElement, start: KernelPoint, end: KernelPoint, layerId?: WorkLayerId) {
  const box = { left: Math.min(start.x, end.x), right: Math.max(start.x, end.x), top: Math.min(start.y, end.y), bottom: Math.max(start.y, end.y) };
  const selections = new Map<string, MapSelection>();
  for (const candidate of svg.querySelectorAll<SVGGraphicsElement>("[data-selectable='true']")) {
    if (layerId && candidate.dataset.selectionLayer !== layerId) continue;
    const bounds = candidate.getBoundingClientRect();
    const intersects = bounds.right >= box.left && bounds.left <= box.right && bounds.bottom >= box.top && bounds.top <= box.bottom;
    const kind = candidate.dataset.selectionKind as MapSelection["kind"] | undefined; const id = candidate.dataset.selectionId;
    if (intersects && kind && id) selections.set(`${kind}:${id}`, { kind, id });
  }
  return [...selections.values()];
}
