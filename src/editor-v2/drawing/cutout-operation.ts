import { commitConstructionTransaction, previewEnclosureReplacement } from "../construction/construction-document";
import { relativePlaceMatrix, transformRegion } from "../geometry/affine-transform";
import type { CanonicalWall } from "../geometry/geometry-types";
import { assessPathConstraint } from "../geometry/path-constraints";
import { assessRegionConstraint, regionArea, subtractRegionShape, unionRegionShapes } from "../geometry/region-constraints";
import { boundaryWallsForRegion } from "../construction/enclosure-walls";
import { geometryFitsBoundary } from "./geometry-containment";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import type { EditorProject, PlaceNode, RegionShape } from "../model/project-model";
import { editableOutlineTarget, type OutlineTarget } from "./outline-target";
import { isRibbonElement, ribbonShape } from "../geometry/ribbon-geometry";

type Identity = { createId(): string; createRoomName(index: number): string };
export type CutoutResult =
  | { state: "applied"; project: EditorProject; selection: OutlineTarget }
  | { state: "blocked"; project: EditorProject; reason: "not-found" | "unsupported" | "outside-target" | "contents-conflict" | "geometry-conflict" };

function cutShape(target: RegionShape, cut: RegionShape) {
  const shape = subtractRegionShape(target, cut);
  return shape && regionArea(shape) < regionArea(target) - 1e-7 ? shape : undefined;
}

function clippedInteriorWalls(walls: CanonicalWall[], enclosure: RegionShape, identity: Identity) {
  return walls.filter(({ role }) => role !== "boundary").flatMap((wall) => {
    const result = assessPathConstraint([wall.start, wall.end], enclosure);
    if (result.state === "outside") return [];
    return result.paths.map((points) => ({ ...wall, id: result.state === "inside" ? wall.id : `${wall.id}:cut:${identity.createId()}`, start: points[0], end: points.at(-1)! }));
  });
}

function constructionWithCut(project: EditorProject, level: PlaceNode, boundary: RegionShape, identity: Identity) {
  const document = project.constructions.find(({ id }) => id === level.constructionId);
  if (!document) return { state: "ready" as const, project };
  const walls = [...boundaryWallsForRegion(boundary, document.walls, identity.createId), ...clippedInteriorWalls(document.walls, boundary, identity)];
  const committed = commitConstructionTransaction(document, previewEnclosureReplacement(document, walls, boundary, { createId: identity.createId, createName: identity.createRoomName }));
  if (committed.state !== "committed") return { state: "blocked" as const, project };
  const next = { ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? committed.document : candidate) };
  return { state: "ready" as const, project: syncConstructionRooms(next, committed.document) };
}

function contentsFit(project: EditorProject, ownerId: string, boundary: RegionShape) {
  const childrenFit = project.places.filter(({ parentId, boundary: child }) => parentId === ownerId && child).every((child) => {
    const mapped = transformRegion(relativePlaceMatrix(project, ownerId, child.id), child.boundary!);
    return assessRegionConstraint(mapped, boundary).state === "inside";
  });
  const equipmentFit = project.elements.filter(({ belongsToId, layerId }) => belongsToId === ownerId && layerId === "equipment").every((element) => geometryFitsBoundary(element.geometry, boundary));
  return childrenFit && equipmentFit;
}

function cutBuilding(project: EditorProject, building: PlaceNode, activePlaceId: string, cut: RegionShape, identity: Identity): CutoutResult {
  const localCut = transformRegion(relativePlaceMatrix(project, building.id, activePlaceId), cut);
  const directBoundary = building.boundary && cutShape(building.boundary, localCut);
  if (!directBoundary) return { state: "blocked", project, reason: "outside-target" };
  const levels = project.places.filter(({ parentId, kind, boundary }) => parentId === building.id && kind === "level" && boundary);
  let next = project; const boundaries = new Map<string, RegionShape>();
  for (const level of levels) {
    const levelCut = transformRegion(relativePlaceMatrix(next, level.id, activePlaceId), cut);
    const relation = assessRegionConstraint(levelCut, level.boundary!);
    if (relation.state === "outside") continue;
    const boundary = cutShape(level.boundary!, levelCut);
    if (!boundary) return { state: "blocked", project, reason: "geometry-conflict" };
    boundaries.set(level.id, boundary);
    next = { ...next, places: next.places.map((place) => place.id === level.id ? { ...place, boundary } : place) };
    const construction = constructionWithCut(next, level, boundary, identity);
    if (construction.state === "blocked") return { state: "blocked", project, reason: "geometry-conflict" };
    next = construction.project;
  }
  const footprint = levels.length ? unionRegionShapes(levels.flatMap((level) => {
    const boundary = boundaries.get(level.id) ?? level.boundary;
    return boundary ? [transformRegion(relativePlaceMatrix(next, building.id, level.id), boundary)] : [];
  })) : directBoundary;
  if (!footprint) return { state: "blocked", project, reason: "geometry-conflict" };
  next = { ...next, places: next.places.map((place) => place.id === building.id ? { ...place, boundary: footprint } : place) };
  const affectedIds = new Set([building.id, ...levels.map(({ id }) => id), ...next.places.filter(({ parentId }) => levels.some((level) => level.id === parentId)).map(({ id }) => id)]);
  const equipmentFits = next.elements.filter(({ belongsToId, layerId }) => affectedIds.has(belongsToId) && layerId === "equipment").every((element) => {
    const owner = next.places.find(({ id }) => id === element.belongsToId); return !owner?.boundary || geometryFitsBoundary(element.geometry, owner.boundary);
  });
  return equipmentFits ? { state: "applied", project: next, selection: { kind: "place", id: building.id } } : { state: "blocked", project, reason: "contents-conflict" };
}

function cutLevel(project: EditorProject, level: PlaceNode, activePlaceId: string, cut: RegionShape, identity: Identity): CutoutResult {
  if (!level.boundary) return { state: "blocked", project, reason: "not-found" };
  const localCut = transformRegion(relativePlaceMatrix(project, level.id, activePlaceId), cut); const boundary = cutShape(level.boundary, localCut);
  if (!boundary) return { state: "blocked", project, reason: "outside-target" };
  let next = { ...project, places: project.places.map((candidate) => candidate.id === level.id ? { ...candidate, boundary } : candidate) };
  const construction = constructionWithCut(next, level, boundary, identity);
  if (construction.state === "blocked") return { state: "blocked", project, reason: "geometry-conflict" };
  next = construction.project;
  const equipmentFits = next.elements.filter(({ belongsToId, layerId }) => belongsToId === level.id && layerId === "equipment").every((element) => geometryFitsBoundary(element.geometry, boundary));
  if (!equipmentFits) return { state: "blocked", project, reason: "contents-conflict" };
  const building = next.places.find(({ id }) => id === level.parentId && next.places.some((candidate) => candidate.id === id && candidate.kind === "building"));
  if (building) {
    const footprint = unionRegionShapes(next.places.filter(({ parentId, kind, boundary: candidateBoundary }) => parentId === building.id && kind === "level" && candidateBoundary).map((candidate) => transformRegion(relativePlaceMatrix(next, building.id, candidate.id), candidate.boundary!)));
    if (footprint) next = { ...next, places: next.places.map((candidate) => candidate.id === building.id ? { ...candidate, boundary: footprint } : candidate) };
  }
  return { state: "applied", project: next, selection: { kind: "place", id: level.id } };
}

export function cutRegionFromSelection(project: EditorProject, activePlaceId: string, target: OutlineTarget, cut: RegionShape, identity: Identity): CutoutResult {
  if (!editableOutlineTarget(project, target, "cut")) return { state: "blocked", project, reason: "unsupported" };
  if (target.kind === "element") {
    const ribbon = project.elements.find(({ id }) => id === target.id);
    if (ribbon && isRibbonElement(ribbon)) {
      const localCut = transformRegion(relativePlaceMatrix(project, ribbon.belongsToId, activePlaceId), cut);
      const original = ribbonShape(ribbon);
      if (!original || !cutShape(original, localCut)) return { state: "blocked", project, reason: "outside-target" };
      return { state: "applied", project: { ...project, elements: project.elements.map((element) => element.id === ribbon.id ? { ...element, ribbonCutouts: [...(element.ribbonCutouts ?? []), localCut] } : element) }, selection: target };
    }
    const element = project.elements.find(({ id }) => id === target.id); if (!element || element.geometry.kind !== "region") return { state: "blocked", project, reason: "not-found" };
    const localCut = transformRegion(relativePlaceMatrix(project, element.belongsToId, activePlaceId), cut); const shape = cutShape(element.geometry.shape, localCut);
    return shape ? { state: "applied", project: { ...project, elements: project.elements.map((candidate) => candidate.id === element.id ? { ...candidate, geometry: { kind: "region", shape } } : candidate) }, selection: target } : { state: "blocked", project, reason: "outside-target" };
  }
  if (target.kind === "surface") {
    const surface = project.surfaces.find(({ id }) => id === target.id); if (!surface) return { state: "blocked", project, reason: "not-found" };
    const localCut = transformRegion(relativePlaceMatrix(project, surface.belongsToId, activePlaceId), cut); const shape = cutShape(surface.shape, localCut);
    return shape ? { state: "applied", project: { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === surface.id ? { ...candidate, shape } : candidate) }, selection: target } : { state: "blocked", project, reason: "outside-target" };
  }
  const place = project.places.find(({ id }) => id === target.id); if (!place?.boundary) return { state: "blocked", project, reason: "not-found" };
  if (place.kind === "building") return cutBuilding(project, place, activePlaceId, cut, identity);
  if (place.kind === "level") return cutLevel(project, place, activePlaceId, cut, identity);
  const localCut = transformRegion(relativePlaceMatrix(project, place.id, activePlaceId), cut); const boundary = cutShape(place.boundary, localCut);
  if (!boundary) return { state: "blocked", project, reason: "outside-target" };
  if (!contentsFit(project, place.id, boundary)) return { state: "blocked", project, reason: "contents-conflict" };
  return { state: "applied", project: { ...project, places: project.places.map((candidate) => candidate.id === place.id ? { ...candidate, boundary } : candidate) }, selection: target };
}
