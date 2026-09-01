import { ribbonEdges, setRibbonWidthAt } from "./ribbon-geometry";
import type { KernelPoint } from "./geometry-types";
import type { DrawingElement } from "../model/project-model";
import { movePathAnchor } from "./path-anchor-edit";

/** Shared centerline and bank-handle editing for roads and flowing water. */
export function reshapeRibbon(element: DrawingElement, channel: number, index: number, point: KernelPoint): DrawingElement | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  if (channel === 1 || channel === 2) {
    const edge = ribbonEdges(element)[index]; if (!edge) return;
    const dot = ((point.x - edge.point.x) * edge.normal.x + (point.y - edge.point.y) * edge.normal.y) / (edge.normal.x ** 2 + edge.normal.y ** 2);
    return { ...element, widthProfile: setRibbonWidthAt(element, edge.t, channel === 1 ? "left" : "right", channel === 1 ? dot : -dot) };
  }
  if (channel !== 0 || (element.geometry.kind !== "path" && element.geometry.kind !== "bezier")) return;
  const geometry = movePathAnchor(element.geometry, index, point);
  return geometry ? { ...element, geometry } : undefined;
}
