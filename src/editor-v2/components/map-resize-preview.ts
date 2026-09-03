import { reshapeRoad } from "../roads/road-editing";
import { reshapeRibbon } from "../geometry/ribbon-editing";
import { commitRibbonEdit } from "../geometry/ribbon-commit";
import { isFlowingWater, isRibbonElement } from "../geometry/ribbon-geometry";
import { resizeConstructionSurface } from "../drawing/construction-surface-operations";
import { resizePlaceBoundary } from "../drawing/place-boundary-operations";
import { resizeElementRegion, resizeTransitionFootprint } from "../drawing/selection-operations";
import { applyAffinePoint, relativePlaceMatrix } from "../geometry/affine-transform";
import type { KernelPoint } from "../geometry/geometry-types";
import type { ResizeCorner } from "../geometry/region-resize";
import type { EditorProject } from "../model/project-model";
import { moveRegionVertex } from "../geometry/region-vertex-edit";
import { movePathAnchor } from "../geometry/path-anchor-edit";

export type RegionResizeTarget = { kind: "element" | "surface" | "place" | "transition"; id: string; scopeId?: string; corner: ResizeCorner };

export function previewPlaceMatrix(project: EditorProject, activePlaceId: string, placeId: string, delta?: KernelPoint) {
  const matrix = relativePlaceMatrix(project, activePlaceId, placeId);
  if (delta) { matrix[4] += delta.x; matrix[5] += delta.y; }
  return matrix;
}

export function previewRegionResize(project: EditorProject, activePlaceId: string, target: RegionResizeTarget, point: KernelPoint) {
  if (target.kind === "element") {
    const element = project.elements.find(({ id }) => id === target.id); if (!element) return project;
    return resizeElementRegion(project, target.id, target.corner, applyAffinePoint(relativePlaceMatrix(project, element.belongsToId, activePlaceId), point)).project;
  }
  if (target.kind === "transition") return resizeTransitionFootprint(project, target.id, target.corner, point, target.scopeId).project;
  if (target.kind === "place") return resizePlaceBoundary(project, target.id, target.corner, applyAffinePoint(relativePlaceMatrix(project, target.id, activePlaceId), point)).project;
  const surface = project.surfaces.find(({ id }) => id === target.id); if (!surface) return project;
  return resizeConstructionSurface(project, target.id, target.corner, applyAffinePoint(relativePlaceMatrix(project, surface.belongsToId, activePlaceId), point)).project;
}

export type RegionVertexTarget = { kind: "element" | "surface" | "place"; id: string; polygonIndex: number; vertexIndex: number };
/** Visual feedback is transient. The shared editing operation validates on release. */
export function previewRegionVertex(project: EditorProject, activePlaceId: string, target: RegionVertexTarget, point: KernelPoint): EditorProject {
  const place = target.kind === "place" ? project.places.find(({ id }) => id === target.id) : undefined;
  const element = target.kind === "element" ? project.elements.find(({ id }) => id === target.id) : undefined;
  if (element && isRibbonElement(element)) { const local = applyAffinePoint(relativePlaceMatrix(project, element.belongsToId, activePlaceId), point); const changed = isFlowingWater(element) ? reshapeRibbon(element, target.polygonIndex, target.vertexIndex, local) : reshapeRoad(element, target.polygonIndex, target.vertexIndex, local); return changed ? commitRibbonEdit(project, changed) ?? project : project; }
  if (element && target.polygonIndex === 0 && (element.geometry.kind === "path" || element.geometry.kind === "bezier")) {
    const local = applyAffinePoint(relativePlaceMatrix(project, element.belongsToId, activePlaceId), point);
    const geometry = movePathAnchor(element.geometry, target.vertexIndex, local);
    return geometry ? { ...project, elements: project.elements.map((item) => item.id === element.id ? { ...item, geometry } : item) } : project;
  }
  const surface = target.kind === "surface" ? project.surfaces.find(({ id }) => id === target.id) : undefined;
  const shape = place?.boundary ?? (element?.geometry.kind === "region" ? element.geometry.shape : surface?.shape);
  const ownerId = place?.id ?? element?.belongsToId ?? surface?.belongsToId;
  if (!shape || !ownerId) return project;
  const local = applyAffinePoint(relativePlaceMatrix(project, ownerId, activePlaceId), point);
  const changed = moveRegionVertex(shape, target.polygonIndex, target.vertexIndex, local); if (!changed) return project;
  if (place) return { ...project, places: project.places.map((item) => item.id === place.id ? { ...item, boundary: changed } : item) };
  if (surface) return { ...project, surfaces: project.surfaces.map((item) => item.id === surface.id ? { ...item, shape: changed } : item) };
  return { ...project, elements: project.elements.map((item) => item.id === element?.id ? { ...item, geometry: { kind: "region", shape: changed } } : item) };
}

export function previewWallEndpoint(project: EditorProject, wallId: string, endpoint: "start" | "end", point: KernelPoint, scopeId?: string): EditorProject {
  const candidates = project.constructions.filter(({ walls }) => walls.some(({ id }) => id === wallId));
  const owner = scopeId ? candidates.find(({ id }) => id === scopeId) : candidates.length === 1 ? candidates[0] : undefined;
  const before = owner?.walls.find(({ id }) => id === wallId)?.[endpoint]; if (!owner || !before) return project;
  const move = (candidate: KernelPoint) => Math.hypot(candidate.x - before.x, candidate.y - before.y) < 1e-6 ? point : candidate;
  return { ...project, constructions: project.constructions.map((doc) => doc.id === owner.id ? { ...doc, walls: doc.walls.map((wall) => ({ ...wall, start: move(wall.start), end: move(wall.end) })) } : doc) };
}
