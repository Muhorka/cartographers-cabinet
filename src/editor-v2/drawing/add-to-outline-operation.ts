import { commitConstructionTransaction, previewEnclosureReplacement } from "../construction/construction-document";
import { boundaryWallsForRegion } from "../construction/enclosure-walls";
import { relativePlaceMatrix, transformRegion } from "../geometry/affine-transform";
import { assessRegionConstraint, shapePolygons, unionRegionShapes } from "../geometry/region-constraints";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import type { EditorProject, RegionShape } from "../model/project-model";
import { editableOutlineTarget, type OutlineTarget } from "./outline-target";

type Identity = { createId(): string; createRoomName(index: number): string };
export type AddToOutlineResult = { state: "applied"; project: EditorProject; selection: OutlineTarget } | { state: "blocked"; project: EditorProject; reason: "not-found" | "unsupported" | "disconnected" | "geometry-conflict" };

/** An outline extension must touch the existing outline. A plain geometric union
 * also accepts disjoint polygons, which would silently turn an extension into a
 * multi-part object and make the operation mean something else. */
function pointTouchesRing(point: { x: number; y: number }, ring: readonly { x: number; y: number }[]) {
  return ring.some((start, index) => {
    const end = ring[(index + 1) % ring.length]; const dx = end.x - start.x; const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy; const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy)) <= 1e-6;
  });
}

function unionConnected(base: RegionShape, addition: RegionShape) {
  const overlaps = assessRegionConstraint(addition, base).state !== "outside"
    || assessRegionConstraint(base, addition).state !== "outside";
  const rings = (shape: RegionShape) => shapePolygons(shape).flatMap(({ outer, holes }) => [outer, ...holes]);
  const touches = rings(base).some((baseRing) => rings(addition).some((additionRing) =>
    baseRing.some((point) => pointTouchesRing(point, additionRing)) || additionRing.some((point) => pointTouchesRing(point, baseRing))));
  if (!overlaps && !touches) return undefined;
  const shape = unionRegionShapes([base, addition]);
  if (!shape || shapePolygons(shape).length > shapePolygons(base).length) return undefined;
  return shape;
}

export function addRegionToOutline(project: EditorProject, activePlaceId: string, target: OutlineTarget, addition: RegionShape, identity: Identity): AddToOutlineResult {
  if (!editableOutlineTarget(project, target)) return { state: "blocked", project, reason: "unsupported" };
  if (target.kind === "element") {
    const element = project.elements.find(({ id }) => id === target.id); if (!element || element.geometry.kind !== "region") return { state: "blocked", project, reason: "not-found" };
    const local = transformRegion(relativePlaceMatrix(project, element.belongsToId, activePlaceId), addition); const shape = unionConnected(element.geometry.shape, local);
    return shape ? { state: "applied", project: { ...project, elements: project.elements.map((candidate) => candidate.id === target.id ? { ...candidate, geometry: { kind: "region", shape } } : candidate) }, selection: target } : { state: "blocked", project, reason: "disconnected" };
  }
  if (target.kind === "surface") {
    const surface = project.surfaces.find(({ id }) => id === target.id); if (!surface) return { state: "blocked", project, reason: "not-found" };
    const local = transformRegion(relativePlaceMatrix(project, surface.belongsToId, activePlaceId), addition); const shape = unionConnected(surface.shape, local);
    return shape ? { state: "applied", project: { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === target.id ? { ...candidate, shape } : candidate) }, selection: target } : { state: "blocked", project, reason: "disconnected" };
  }
  const place = project.places.find(({ id }) => id === target.id); if (!place?.boundary) return { state: "blocked", project, reason: "not-found" };
  const local = transformRegion(relativePlaceMatrix(project, place.id, activePlaceId), addition); const boundary = unionConnected(place.boundary, local);
  if (!boundary) return { state: "blocked", project, reason: "disconnected" };
  let next: EditorProject = { ...project, places: project.places.map((candidate) => candidate.id === place.id ? { ...candidate, boundary } : candidate) };
  const levels = place.kind === "level" ? [place] : place.kind === "building"
    ? project.places.filter(({ parentId, kind, boundary: outline }) => parentId === place.id && kind === "level" && outline) : [];
  for (const level of levels) {
    // Editing the whole building updates touched floors; editing one floor
    // leaves its neighbours alone. Both use the same enclosure transaction.
    const levelAddition = transformRegion(relativePlaceMatrix(project, level.id, activePlaceId), addition);
    const levelBoundary = level.id === place.id ? boundary : level.boundary && unionConnected(level.boundary, levelAddition);
    if (!levelBoundary) continue;
    next = { ...next, places: next.places.map((candidate) => candidate.id === level.id ? { ...candidate, boundary: levelBoundary } : candidate) };
    if (level.constructionId) {
      const document = next.constructions.find(({ id }) => id === level.constructionId); if (!document) return { state: "blocked", project, reason: "not-found" };
      const interior = document.walls.filter(({ role }) => role !== "boundary"); const walls = [...boundaryWallsForRegion(levelBoundary, document.walls, identity.createId), ...interior];
      const committed = commitConstructionTransaction(document, previewEnclosureReplacement(document, walls, levelBoundary, { createId: identity.createId, createName: identity.createRoomName }));
      if (committed.state !== "committed") return { state: "blocked", project, reason: "geometry-conflict" };
      next = syncConstructionRooms({ ...next, constructions: next.constructions.map((candidate) => candidate.id === document.id ? committed.document : candidate) }, committed.document);
    }
  }
  const building = place.kind === "building" ? place : place.kind === "level" ? next.places.find(({ id, kind }) => id === place.parentId && kind === "building") : undefined;
  if (building) {
    const footprint = unionRegionShapes(next.places.filter(({ parentId, kind, boundary: candidateBoundary }) => parentId === building.id && kind === "level" && candidateBoundary).map((candidate) => transformRegion(relativePlaceMatrix(next, building.id, candidate.id), candidate.boundary!)));
    if (footprint) next = { ...next, places: next.places.map((candidate) => candidate.id === building.id ? { ...candidate, boundary: footprint } : candidate) };
  }
  return { state: "applied", project: next, selection: target };
}
