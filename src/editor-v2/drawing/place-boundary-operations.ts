import { assessRegionConstraint, repairRegionShape, shapePoints, shapePolygons, unionRegionShapes } from "../geometry/region-constraints";
import { commitConstructionTransaction, previewEnclosureReplacement } from "../construction/construction-document";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import { resizeRegionFromCorner, type ResizeCorner } from "../geometry/region-resize";
import type { KernelPoint } from "../geometry/geometry-types";
import type { EditorProject, PlaceNode, RegionShape } from "../model/project-model";
import type { SelectionOperationResult } from "./selection-operations";
import { equipmentFitsBoundaries } from "./geometry-containment";
import { moveRegionVertex } from "../geometry/region-vertex-edit";
import { selectionIsLocked } from "./selection-locks";

function translatedPolygon(shape: RegionShape, transform: PlaceNode["transform"]): RegionShape {
  const radians = transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const map = ({ x, y }: KernelPoint) => ({ x: x * cosine - y * sine + transform.x, y: x * sine + y * cosine + transform.y });
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) };
  return { kind: "polygon", points: shapePoints(shape).map(map) };
}

function boundaryWalls(shape: RegionShape, documentId: string, existingIds: Set<string>) {
  return shapePolygons(shape).flatMap(({ outer, holes }, polygonIndex) => {
    return [outer, ...holes].flatMap((ring, ringIndex) => ring.map((start, index) => {
      const preferred = `${documentId}:boundary:${polygonIndex}:${ringIndex}:${index}`;
      let id = preferred; let suffix = 1;
      while (existingIds.has(id)) id = `${preferred}:${suffix++}`;
      existingIds.add(id);
      return { id, start, end: ring[(index + 1) % ring.length], thickness: 0.3, role: "boundary" as const };
    }));
  });
}

function derivedBoundaryChild(parent: PlaceNode, child: PlaceNode) {
  return (parent.kind === "level" && child.kind === "room") || (parent.kind === "building" && child.kind === "level");
}

function descendantIds(project: EditorProject, rootId: string) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) { changed = false; for (const place of project.places) if (place.parentId && ids.has(place.parentId) && !ids.has(place.id)) { ids.add(place.id); changed = true; } }
  return ids;
}

function sameShape(left: RegionShape | undefined, right: RegionShape | undefined) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rebuildLevel(project: EditorProject, level: PlaceNode, boundary: RegionShape, reservedIds: Set<string>) {
  if (!level.constructionId) return project;
  const document = project.constructions.find(({ id }) => id === level.constructionId);
  if (!document) return undefined;
  const ids = new Set(document.walls.map(({ id }) => id));
  const walls = [...boundaryWalls(boundary, document.id, ids), ...document.walls.filter(({ role }) => role !== "boundary")];
  let roomIndex = 0;
  const candidate = previewEnclosureReplacement(document, walls, boundary, { createId: () => {
    let id = `${document.id}:room:${++roomIndex}`;
    while (reservedIds.has(id)) id = `${document.id}:room:${++roomIndex}`;
    reservedIds.add(id); return id;
  }, createName: (index) => `Room ${index + 1}` });
  const committed = commitConstructionTransaction(document, candidate);
  if (committed.state !== "committed") return undefined;
  return syncConstructionRooms({ ...project, constructions: project.constructions.map((item) => item.id === document.id ? committed.document : item) }, committed.document);
}

function synchronizeBuilding(project: EditorProject, level: PlaceNode, levelBoundary: RegionShape) {
  const building = level.parentId ? project.places.find(({ id }) => id === level.parentId && kindIsBuilding(project, id)) : undefined;
  if (!building?.boundary) return project;
  const footprint = unionRegionShapes(project.places
    .filter(({ parentId, kind, boundary }) => parentId === building.id && kind === "level" && boundary)
    .map((candidate) => translatedPolygon(candidate.id === level.id ? levelBoundary : candidate.boundary!, candidate.transform)));
  return footprint ? { ...project, places: project.places.map((place) => place.id === building.id ? { ...place, boundary: footprint } : place) } : project;
}

function buildingFitsParent(project: EditorProject, level: PlaceNode) {
  const building = level.parentId ? project.places.find(({ id }) => id === level.parentId) : undefined;
  const containing = building?.parentId ? project.places.find(({ id }) => id === building.parentId) : undefined;
  return !building?.boundary || !containing?.boundary || assessRegionConstraint(translatedPolygon(building.boundary, building.transform), containing.boundary).state === "inside";
}

function kindIsBuilding(project: EditorProject, id: string) {
  return project.places.some((place) => place.id === id && place.kind === "building");
}

function replaceBoundary(project: EditorProject, selected: PlaceNode, boundary: RegionShape): SelectionOperationResult {
  const parent = selected.parentId ? project.places.find(({ id: candidateId }) => candidateId === selected.parentId) : undefined;
  const levelMayExpandBuilding = selected.kind === "level" && parent?.kind === "building";
  if (parent?.boundary && !levelMayExpandBuilding && selected.kind !== "location" && selected.kind !== "custom" && assessRegionConstraint(translatedPolygon(boundary, selected.transform), parent.boundary).state !== "inside") return { state: "blocked", project, reason: "outside-outline" };
  const childOutside = project.places.some((child) => child.parentId === selected.id && !derivedBoundaryChild(selected, child) && child.kind !== "location" && child.kind !== "custom" && child.boundary && assessRegionConstraint(translatedPolygon(child.boundary, child.transform), boundary).state !== "inside");
  if (childOutside) return { state: "blocked", project, reason: "collision" };
  let next: EditorProject = { ...project, places: project.places.map((place) => place.id === selected.id ? { ...place, boundary } : place) };
  const affectedOwners = new Set([selected.id]);
  if (selected.kind === "level" && selected.constructionId) {
    const rebuilt = rebuildLevel(next, selected, boundary, new Set([...project.places.map(({ id }) => id), ...project.constructions.flatMap(({ rooms }) => rooms.map(({ id }) => id))]));
    if (!rebuilt) return { state: "blocked", project, reason: "not-found" };
    next = rebuilt;
    for (const id of descendantIds(next, selected.id)) affectedOwners.add(id);
    next = synchronizeBuilding(next, selected, boundary);
    if (!buildingFitsParent(next, selected)) return { state: "blocked", project, reason: "outside-outline" };
  }
  if (selected.kind === "building") {
    const inherited = project.places.filter((place) => place.parentId === selected.id && place.kind === "level" && sameShape(place.boundary, selected.boundary));
    const reserved = new Set([...project.places.map(({ id }) => id), ...project.constructions.flatMap(({ rooms }) => rooms.map(({ id }) => id))]);
    for (const level of inherited) {
      const rebuilt = rebuildLevel(next, level, boundary, reserved);
      if (!rebuilt) return { state: "blocked", project, reason: "collision" };
      next = { ...rebuilt, places: rebuilt.places.map((place) => place.id === level.id ? { ...place, boundary: structuredClone(boundary) } : place) };
      for (const id of descendantIds(next, level.id)) affectedOwners.add(id);
    }
  }
  if (!equipmentFitsBoundaries(next, affectedOwners)) return { state: "blocked", project, reason: "collision" };
  return { state: "applied", project: next };
}

export function resizePlaceBoundary(project: EditorProject, id: string, corner: ResizeCorner, point: KernelPoint): SelectionOperationResult {
  const selected = project.places.find((place) => place.id === id); if (!selected?.boundary) return { state: "blocked", project, reason: "not-found" };
  if (selectionIsLocked(project, { kind: "place", id })) return { state: "blocked", project, reason: "locked-outline" };
  const boundary = resizeRegionFromCorner(selected.boundary, corner, point); return boundary ? replaceBoundary(project, selected, boundary) : { state: "blocked", project, reason: "collision" };
}

export function movePlaceBoundaryVertex(project: EditorProject, id: string, polygonIndex: number, vertexIndex: number, point: KernelPoint): SelectionOperationResult {
  const selected = project.places.find((place) => place.id === id); if (!selected?.boundary) return { state: "blocked", project, reason: "not-found" };
  if (selectionIsLocked(project, { kind: "place", id })) return { state: "blocked", project, reason: "locked-outline" };
  const changed = moveRegionVertex(selected.boundary, polygonIndex, vertexIndex, point); const boundary = changed && repairRegionShape(changed);
  return boundary ? replaceBoundary(project, selected, boundary) : { state: "blocked", project, reason: "collision" };
}
