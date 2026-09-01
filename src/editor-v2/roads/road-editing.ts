import type { KernelPoint } from "../geometry/geometry-types";
import { isRoad } from "../geometry/ribbon-geometry";
import { reshapeRibbon } from "../geometry/ribbon-editing";
import type { DrawingElement, EditorProject } from "../model/project-model";
import { routeRoad } from "./road-routing";

/** Reuses the sheet's vector-vertex drag transaction. Channel 0 moves a route
 * anchor, channels 1/2 edit the left/right width at a sampled distance station. */
export function reshapeRoad(element: DrawingElement, channel: number, index: number, point: KernelPoint): DrawingElement | undefined {
  return isRoad(element) ? reshapeRibbon(element, channel, index, point) : undefined;
}
export function commitRoadEdit(project: EditorProject, candidate: DrawingElement) {
  const routed = routeRoad(project, candidate); if (!routed) return;
  return { ...project, elements: project.elements.map((element) => element.id === candidate.id ? routed : element) };
}
