import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { roomFaceShape } from "../geometry/room-face-shape";
import { assessRegionConstraint, shapePoints, unionRegionShapes } from "../geometry/region-constraints";
import type { KernelPoint } from "../geometry/geometry-types";
import type { EditorProject, PlaceNode, RegionShape } from "../model/project-model";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import { geometryFitsBoundary } from "./geometry-containment";

export function activeSelectionConstruction(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = active?.kind === "room" && active.parentId ? project.places.find(({ id }) => id === active.parentId) : active;
  return project.constructions.find(({ id }) => id === owner?.constructionId);
}

export function constructionOwnerIds(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = active?.kind === "room" && active.parentId ? project.places.find(({ id }) => id === active.parentId) : active;
  return new Set(project.places.filter((place) => place.id === owner?.id || place.parentId === owner?.id).map(({ id }) => id));
}

export function translatedPolygon(shape: RegionShape, transform: PlaceNode["transform"]): RegionShape {
  const radians = transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const map = ({ x, y }: KernelPoint) => ({ x: x * cosine - y * sine + transform.x, y: x * sine + y * cosine + transform.y });
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) };
  return { kind: "polygon", points: shapePoints(shape).map(map) };
}

export function replaceConstruction(project: EditorProject, id: string, document: EditorProject["constructions"][number]) {
  return syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === id ? document : candidate) }, document);
}

export function synchronizedBoundary(project: EditorProject, activePlaceId: string, document: EditorProject["constructions"][number]) {
  const face = buildWallNetwork(document.walls.filter(({ role }) => role === "boundary")).faces.toSorted((first, second) => second.area - first.area)[0];
  if (!face) return { state: "blocked" as const, reason: "collision" as const };
  const boundary: RegionShape = roomFaceShape(face); const level = project.places.find(({ id }) => id === activePlaceId);
  if (!level) return { state: "blocked" as const, reason: "not-found" as const };
  const building = level.kind === "level" ? project.places.find(({ id }) => id === level.parentId) : level.kind === "building" ? level : undefined;
  const siblingLevels = building ? project.places.filter(({ parentId, kind }) => parentId === building.id && kind === "level") : [];
  const buildingBoundary = building ? unionRegionShapes(siblingLevels.flatMap((candidate) => {
    const candidateBoundary = candidate.id === level.id ? boundary : candidate.boundary;
    return candidateBoundary ? [translatedPolygon(candidateBoundary, candidate.transform)] : [];
  })) : boundary;
  if (building && !buildingBoundary) return { state: "blocked" as const, reason: "collision" as const };
  if (building?.parentId) {
    const containing = project.places.find(({ id }) => id === building.parentId); const footprint = translatedPolygon(buildingBoundary!, building.transform);
    if (containing?.boundary && assessRegionConstraint(footprint, containing.boundary).state !== "inside") return { state: "blocked" as const, reason: "outside-outline" as const };
  }
  const contentsFit = project.elements
    .filter(({ belongsToId, layerId }) => belongsToId === level.id && layerId === "equipment")
    .every((element) => geometryFitsBoundary(element.geometry, boundary));
  if (!contentsFit) return { state: "blocked" as const, reason: "collision" as const };
  return { state: "ready" as const, project: { ...project, places: project.places.map((place) => place.id === level.id ? { ...place, boundary } : place.id === building?.id ? { ...place, boundary: buildingBoundary } : place) } };
}
