import type { EditorProject } from "../model/project-model";
import { roadFitsBuildings, routeRoad } from "./road-routing";
import { reconcileRoadJunctions } from "./road-joining";

/** Enforces the same road/building rule for all transaction producers, including
 * moving a building after drawing a road, imports and agent-authored changes. */
export function reconcileRoadRoutes(before: EditorProject, next: EditorProject): EditorProject | undefined {
  if (!next.elements.some((element) => element.layerId === "roads")) return reconcileRoadJunctions(next);
  if (before.elements === next.elements && before.places === next.places) return reconcileRoadJunctions(next);
  const context = (project: EditorProject) => JSON.stringify(project.places.map(({ id, parentId, kind, transform, boundary, properties }) => ({ id, parentId, kind, transform, boundary, subjectId: properties.subjectId, semanticType: properties.semanticType })));
  const roadGeometry = (element: EditorProject["elements"][number]) => ({ belongsToId: element.belongsToId, layerId: element.layerId, geometry: element.geometry, widthMeters: element.widthMeters, widthProfile: element.widthProfile, ribbonCutouts: element.ribbonCutouts });
  const obstaclesChanged = before.places !== next.places && context(before) !== context(next);
  const old = new Map(before.elements.map((element) => [element.id, element]));
  let changed = false; const elements = [];
  for (const element of next.elements) {
    const previous = old.get(element.id);
    if (element.layerId !== "roads" || !obstaclesChanged && previous && JSON.stringify(roadGeometry(previous)) === JSON.stringify(roadGeometry(element))) { elements.push(element); continue; }
    if (roadFitsBuildings(next, element)) { elements.push(element); continue; }
    if (element.locked) return;
    const routed = routeRoad(next, element); if (!routed) return;
    changed = true; elements.push(routed);
  }
  return reconcileRoadJunctions(changed ? { ...next, elements } : next);
}
