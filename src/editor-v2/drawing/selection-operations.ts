import { routeRoad } from "../roads/road-routing";
import { roomFaceShape } from "../geometry/room-face-shape";
import { constructionNetwork } from "../construction/construction-network";
import { commitConstructionTransaction, previewJunctionMove, previewRoomRemoval, previewRoomTranslation, previewWallGroupTranslation, previewWallOffset, previewWallRemoval } from "../construction/construction-document";
import { deleteVerticalTransition, deleteWallOpening, moveWallOpening, placeVerticalTransition } from "../construction/wall-features";
import { wallNormal } from "../geometry/line-geometry";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { assessRegionConstraint, pointInRegion, shapePoints, unionRegionShapes } from "../geometry/region-constraints";
import { translateRegion } from "../geometry/region-transform";
import type { KernelPoint } from "../geometry/geometry-types";
import type { DrawingElement, EditorProject, PlaceNode, RegionShape } from "../model/project-model";
import { translateBezier } from "../geometry/bezier-geometry";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import { equipmentFitsBoundaries, geometryFitsBoundary } from "./geometry-containment";
import { moveConstructionSurface } from "./construction-surface-operations";
import { selectionIsLocked } from "./selection-locks";

export { mergeSelectedRooms } from "./room-merge-operation";
export { moveElementRegionVertex, resizeElementRegion, resizeTransitionFootprint, updateElementDetails, updateOpeningWidth, updateTransitionDetails, updateSelectionState } from "./selection-detail-operations";

export type EditableSelection = { kind: "place" | "element" | "surface" | "room" | "wall" | "opening" | "transition"; id: string };
type Identity = { createId(): string; createRoomName(index: number): string };

export type SelectionOperationResult =
  | { state: "applied"; project: EditorProject }
  | { state: "review-required"; project: EditorProject; effects: string[]; accept(): EditorProject }
  | { state: "blocked"; project: EditorProject; reason: "locked-outline" | "outside-outline" | "collision" | "unsupported" | "not-found" };

function activeConstruction(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = active?.kind === "room" && active.parentId ? project.places.find(({ id }) => id === active.parentId) : active;
  return project.constructions.find(({ id }) => id === owner?.constructionId);
}
function constructionOwnerIds(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = active?.kind === "room" && active.parentId ? project.places.find(({ id }) => id === active.parentId) : active;
  return new Set(project.places.filter((place) => place.id === owner?.id || place.parentId === owner?.id).map(({ id }) => id));
}
function translatedPolygon(shape: RegionShape, transform: PlaceNode["transform"]): RegionShape {
  const radians = transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const map = ({ x, y }: KernelPoint) => ({ x: x * cosine - y * sine + transform.x, y: x * sine + y * cosine + transform.y });
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) };
  return { kind: "polygon", points: shapePoints(shape).map(map) };
}
function movePlace(project: EditorProject, activePlaceId: string, id: string, delta: KernelPoint, boundaryEditing: boolean): SelectionOperationResult {
  const selected = project.places.find((place) => place.id === id);
  if (!selected) return { state: "blocked", project, reason: "not-found" };
  if (selected.locked) return { state: "blocked", project, reason: "locked-outline" };
  if (selected.id === activePlaceId) return { state: "blocked", project, reason: boundaryEditing ? "unsupported" : "locked-outline" };
  const transform = { ...selected.transform, x: selected.transform.x + delta.x, y: selected.transform.y + delta.y };
  if (selected.boundary && selected.parentId && selected.kind !== "location" && selected.kind !== "custom") {
    const parent = project.places.find(({ id: candidateId }) => candidateId === selected.parentId);
    const candidate = translatedPolygon(selected.boundary, transform);
    if (parent?.boundary && assessRegionConstraint(candidate, parent.boundary).state !== "inside") return { state: "blocked", project, reason: "outside-outline" };
  }
  return { state: "applied", project: { ...project, places: project.places.map((place) => place.id === id ? { ...place, transform } : place) } };
}

function translateElement(element: DrawingElement, delta: KernelPoint): DrawingElement {
  const geometry = element.geometry.kind === "region" ? { ...element.geometry, shape: translateRegion(element.geometry.shape, delta) }
    : element.geometry.kind === "path" ? { ...element.geometry, points: element.geometry.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })) }
      : element.geometry.kind === "bezier" ? { ...element.geometry, nodes: translateBezier(element.geometry.nodes, delta) }
      : { ...element.geometry, at: { x: element.geometry.at.x + delta.x, y: element.geometry.at.y + delta.y } };
  return { ...element, geometry, ...(element.ribbonCutouts ? { ribbonCutouts: element.ribbonCutouts.map((shape) => translateRegion(shape, delta)) } : {}) };
}

function moveElement(project: EditorProject, id: string, delta: KernelPoint): SelectionOperationResult {
  const selected = project.elements.find((element) => element.id === id);
  if (!selected) return { state: "blocked", project, reason: "not-found" };
  if (selected.locked) return { state: "blocked", project, reason: "locked-outline" };
  const translated = translateElement(selected, delta); const moved = translated.layerId === "roads" ? routeRoad(project, translated) : translated; if (!moved) return { state: "blocked", project, reason: "collision" }; const owner = project.places.find(({ id: placeId }) => placeId === selected.belongsToId);
  if (moved.layerId === "equipment" && owner?.boundary && !geometryFitsBoundary(moved.geometry, owner.boundary)) return { state: "blocked", project, reason: "outside-outline" };
  return { state: "applied", project: { ...project, elements: project.elements.map((element) => element.id === id ? moved : element) } };
}

function replaceConstruction(project: EditorProject, id: string, document: EditorProject["constructions"][number]) {
  return syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === id ? document : candidate) }, document);
}

function synchronizedBoundary(project: EditorProject, activePlaceId: string, document: EditorProject["constructions"][number]) {
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
  const contentsFit = project.elements.filter(({ belongsToId, layerId }) => belongsToId === level.id && layerId === "equipment").every((element) => element.geometry.kind !== "region" || assessRegionConstraint(element.geometry.shape, boundary).state === "inside");
  if (!contentsFit) return { state: "blocked" as const, reason: "collision" as const };
  return { state: "ready" as const, project: { ...project, places: project.places.map((place) => place.id === level.id ? { ...place, boundary } : place.id === building?.id ? { ...place, boundary: buildingBoundary } : place) } };
}

function moveWall(project: EditorProject, activePlaceId: string, id: string, delta: KernelPoint, boundaryEditing: boolean, identity: Identity): SelectionOperationResult {
  const document = activeConstruction(project, activePlaceId); const wall = document?.walls.find((candidate) => candidate.id === id);
  if (!document || !wall) return { state: "blocked", project, reason: "not-found" };
  if (wall.locked) return { state: "blocked", project, reason: "locked-outline" };
  if (wall.role === "boundary" && !boundaryEditing) return { state: "blocked", project, reason: "locked-outline" };
  const normal = wallNormal(wall); if (!normal) return { state: "blocked", project, reason: "unsupported" };
  const candidate = previewWallOffset(document, id, delta.x * normal.x + delta.y * normal.y, { createId: identity.createId, createName: identity.createRoomName });
  const committed = commitConstructionTransaction(document, candidate);
  if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
  let next = replaceConstruction(project, document.id, committed.document);
  if (!equipmentFitsBoundaries(next, constructionOwnerIds(next, activePlaceId))) return { state: "blocked", project, reason: "collision" };
  if (wall.role === "boundary") {
    const synchronized = synchronizedBoundary(next, activePlaceId, committed.document); if (synchronized.state === "blocked") return { state: "blocked", project, reason: synchronized.reason };
    next = synchronized.project;
  }
  return { state: "applied", project: next };
}

export function moveWallGroup(project: EditorProject, input: { activePlaceId: string; wallIds: string[]; delta: KernelPoint; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  const document = activeConstruction(project, input.activePlaceId);
  if (!document || !input.wallIds.length || input.wallIds.some((id) => !document.walls.some((wall) => wall.id === id))) return { state: "blocked", project, reason: "not-found" };
  const selectedWalls = document.walls.filter(({ id }) => input.wallIds.includes(id));
  if (selectedWalls.some(({ id }) => selectionIsLocked(project, { kind: "wall", id }))) return { state: "blocked", project, reason: "locked-outline" };
  if (!input.boundaryEditing && selectedWalls.some(({ role }) => role === "boundary")) return { state: "blocked", project, reason: "locked-outline" };
  const candidate = previewWallGroupTranslation(document, input.wallIds, input.delta, { createId: identity.createId, createName: identity.createRoomName });
  const committed = commitConstructionTransaction(document, candidate);
  if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
  let next = replaceConstruction(project, document.id, committed.document);
  if (!equipmentFitsBoundaries(next, constructionOwnerIds(next, input.activePlaceId))) return { state: "blocked", project, reason: "collision" };
  if (selectedWalls.some(({ role }) => role === "boundary")) {
    const synchronized = synchronizedBoundary(next, input.activePlaceId, committed.document);
    if (synchronized.state === "blocked") return { state: "blocked", project, reason: synchronized.reason };
    next = synchronized.project;
  }
  return { state: "applied", project: next };
}

export function moveWallEndpoint(project: EditorProject, input: { activePlaceId: string; wallId: string; endpoint: "start" | "end"; point: KernelPoint; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  const document = activeConstruction(project, input.activePlaceId); const wall = document?.walls.find(({ id }) => id === input.wallId);
  if (!document || !wall) return { state: "blocked", project, reason: "not-found" };
  if (selectionIsLocked(project, { kind: "wall", id: input.wallId })) return { state: "blocked", project, reason: "locked-outline" };
  if (wall.role === "boundary" && !input.boundaryEditing) return { state: "blocked", project, reason: "locked-outline" };
  const active = project.places.find(({ id }) => id === input.activePlaceId);
  if (wall.role !== "boundary" && active?.boundary && !pointInRegion(input.point, active.boundary)) return { state: "blocked", project, reason: "outside-outline" };
  const before = wall[input.endpoint];
  const candidate = previewJunctionMove(document, before, input.point, { createId: identity.createId, createName: identity.createRoomName });
  const committed = commitConstructionTransaction(document, candidate);
  if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
  let next = replaceConstruction(project, document.id, committed.document);
  if (!equipmentFitsBoundaries(next, constructionOwnerIds(next, input.activePlaceId))) return { state: "blocked", project, reason: "collision" };
  if (wall.role === "boundary") {
    const synchronized = synchronizedBoundary(next, input.activePlaceId, committed.document); if (synchronized.state === "blocked") return { state: "blocked", project, reason: synchronized.reason };
    next = synchronized.project;
  }
  return { state: "applied", project: next };
}

function moveOpening(project: EditorProject, activePlaceId: string, id: string, delta: KernelPoint): SelectionOperationResult {
  const document = activeConstruction(project, activePlaceId); const opening = document?.openings.find((candidate) => candidate.id === id);
  const wall = document?.walls.find(({ id: wallId }) => wallId === opening?.wallId);
  if (!document || !opening || !wall) return { state: "blocked", project, reason: "not-found" };
  if (opening.locked || wall.locked) return { state: "blocked", project, reason: "locked-outline" };
  const point = { x: wall.start.x + (wall.end.x - wall.start.x) * opening.position + delta.x, y: wall.start.y + (wall.end.y - wall.start.y) * opening.position + delta.y };
  const moved = moveWallOpening(document, id, point, 4);
  if (moved.state !== "moved") return { state: "blocked", project, reason: moved.state === "no-wall" ? "outside-outline" : "collision" };
  const active = project.places.find(({ id: placeId }) => placeId === activePlaceId); const room = active?.kind === "room" ? document.rooms.find(({ id: roomId }) => roomId === active.id) : undefined;
  const face = room ? constructionNetwork(document.walls, document.enclosure).faces.find(({ id: faceId }) => faceId === room.faceId) : undefined; const changed = moved.document.openings.find(({ id: openingId }) => openingId === id);
  if (face && changed && !face.wallIds.includes(changed.wallId)) return { state: "blocked", project, reason: "outside-outline" };
  return { state: "applied", project: replaceConstruction(project, document.id, moved.document) };
}

function moveTransition(project: EditorProject, activePlaceId: string, id: string, delta: KernelPoint): SelectionOperationResult {
  const document = activeConstruction(project, activePlaceId); const transition = document?.transitions.find((candidate) => candidate.id === id);
  if (!document || !transition) return { state: "blocked", project, reason: "not-found" };
  if (transition.locked) return { state: "blocked", project, reason: "locked-outline" };
  const footprint = translateRegion(transition.footprint, delta); const without = deleteVerticalTransition(document, id).document;
  const active = project.places.find(({ id: placeId }) => placeId === activePlaceId); const room = active?.kind === "room" ? document.rooms.find(({ id: roomId }) => roomId === active.id) : undefined;
  const face = constructionNetwork(document.walls, document.enclosure).faces.find((candidate) => (!room || candidate.id === room.faceId) && assessRegionConstraint(footprint, roomFaceShape(candidate)).state === "inside");
  if (!face) return { state: "blocked", project, reason: "outside-outline" };
  const result = placeVerticalTransition(without, { ...transition, footprint, enclosure: roomFaceShape(face) });
  return result.state === "placed" ? { state: "applied", project: replaceConstruction(project, document.id, result.document) } : { state: "blocked", project, reason: "collision" };
}

function moveRoom(project: EditorProject, activePlaceId: string, id: string, delta: KernelPoint, boundaryEditing: boolean, identity: Identity): SelectionOperationResult {
  const document = activeConstruction(project, activePlaceId); if (!document) return { state: "blocked", project, reason: "not-found" };
  const room = document.rooms.find(({ id: roomId }) => roomId === id);
  if (room?.locked || project.places.find(({ id: placeId }) => placeId === id)?.locked) return { state: "blocked", project, reason: "locked-outline" };
  const preview = previewRoomTranslation(document, id, delta, { createId: identity.createId, createName: identity.createRoomName });
  if (preview.state !== "ready") return { state: "blocked", project, reason: "not-found" };
  if (preview.includesBoundary && !boundaryEditing) return { state: "blocked", project, reason: "locked-outline" };
  const active = project.places.find(({ id: placeId }) => placeId === activePlaceId);
  const movedFace: RegionShape = translateRegion(roomFaceShape(preview.face), delta);
  if (!preview.includesBoundary && active?.boundary && assessRegionConstraint(movedFace, active.boundary).state !== "inside") return { state: "blocked", project, reason: "outside-outline" };
  const committed = commitConstructionTransaction(document, preview.transaction); if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
  let next = replaceConstruction(project, document.id, committed.document);
  if (!equipmentFitsBoundaries(next, constructionOwnerIds(next, activePlaceId))) return { state: "blocked", project, reason: "collision" };
  if (preview.includesBoundary) {
    const synchronized = synchronizedBoundary(next, activePlaceId, committed.document); if (synchronized.state === "blocked") return { state: "blocked", project, reason: synchronized.reason };
    next = synchronized.project;
  }
  const beforeFaces = constructionNetwork(document.walls, document.enclosure).faces.length; const afterFaces = constructionNetwork(committed.document.walls, committed.document.enclosure).faces.length;
  const effects = preview.transaction.effects.filter(({ kind }) => kind === "openings-removed").map(({ kind }) => kind);
  if (beforeFaces !== afterFaces) effects.push("rooms-created");
  return effects.length ? { state: "review-required", project, effects, accept: () => next } : { state: "applied", project: next };
}

export function moveSelection(project: EditorProject, input: { activePlaceId: string; selection: EditableSelection; delta: KernelPoint; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  if (selectionIsLocked(project, input.selection)) return { state: "blocked", project, reason: "locked-outline" };
  if (input.selection.kind === "place") return movePlace(project, input.activePlaceId, input.selection.id, input.delta, input.boundaryEditing);
  if (input.selection.kind === "element") return moveElement(project, input.selection.id, input.delta);
  if (input.selection.kind === "surface") return moveConstructionSurface(project, input.selection.id, input.delta);
  if (input.selection.kind === "wall") return moveWall(project, input.activePlaceId, input.selection.id, input.delta, input.boundaryEditing, identity);
  if (input.selection.kind === "opening") return moveOpening(project, input.activePlaceId, input.selection.id, input.delta);
  if (input.selection.kind === "transition") return moveTransition(project, input.activePlaceId, input.selection.id, input.delta);
  if (input.selection.kind === "room") return moveRoom(project, input.activePlaceId, input.selection.id, input.delta, input.boundaryEditing, identity);
  return { state: "blocked", project, reason: "unsupported" };
}

export function deleteSelection(project: EditorProject, input: { activePlaceId: string; selection: EditableSelection; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  const { selection } = input;
  if (selectionIsLocked(project, selection)) return { state: "blocked", project, reason: "locked-outline" };
  if (selection.kind === "place") {
    const place = project.places.find(({ id }) => id === selection.id);
    return place?.locked ? { state: "blocked", project, reason: "locked-outline" } : { state: "blocked", project, reason: "unsupported" };
  }
  if (selection.kind === "element") {
    const element = project.elements.find(({ id }) => id === selection.id); if (!element) return { state: "blocked", project, reason: "not-found" }; if (element.locked) return { state: "blocked", project, reason: "locked-outline" };
    return { state: "applied", project: { ...project, elements: project.elements.filter(({ id }) => id !== selection.id) } };
  }
  if (selection.kind === "surface") {
    const surface = project.surfaces.find(({ id }) => id === selection.id); if (!surface) return { state: "blocked", project, reason: "not-found" }; if (surface.locked) return { state: "blocked", project, reason: "locked-outline" };
    return { state: "applied", project: { ...project, surfaces: project.surfaces.filter(({ id }) => id !== selection.id) } };
  }
  const document = activeConstruction(project, input.activePlaceId); if (!document) return { state: "blocked", project, reason: "not-found" };
  if (selection.kind === "opening") {
    const opening = document.openings.find(({ id }) => id === selection.id); if (!opening) return { state: "blocked", project, reason: "not-found" }; if (opening.locked) return { state: "blocked", project, reason: "locked-outline" }; const result = deleteWallOpening(document, selection.id); return result.state === "deleted" ? { state: "applied", project: replaceConstruction(project, document.id, result.document) } : { state: "blocked", project, reason: "not-found" };
  }
  if (selection.kind === "transition") {
    const transition = document.transitions.find(({ id }) => id === selection.id); if (!transition) return { state: "blocked", project, reason: "not-found" }; if (transition.locked) return { state: "blocked", project, reason: "locked-outline" }; const result = deleteVerticalTransition(document, selection.id); return result.state === "deleted" ? { state: "applied", project: replaceConstruction(project, document.id, result.document) } : { state: "blocked", project, reason: "not-found" };
  }
  if (selection.kind === "wall") {
    const wall = document.walls.find(({ id }) => id === selection.id); if (!wall) return { state: "blocked", project, reason: "not-found" };
    if (wall.role === "boundary" || wall.locked) return { state: "blocked", project, reason: "locked-outline" };
    const candidate = previewWallRemoval(document, [selection.id], { createId: identity.createId, createName: identity.createRoomName });
    const committed = commitConstructionTransaction(document, candidate); if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
    const next = replaceConstruction(project, document.id, committed.document); const effects = candidate.effects.filter(({ kind }) => kind === "openings-removed").map(({ kind }) => kind);
    return effects.length ? { state: "review-required", project, effects, accept: () => next } : { state: "applied", project: next };
  }
  if (selection.kind === "room") {
    const room = document.rooms.find(({ id }) => id === selection.id); if (!room) return { state: "blocked", project, reason: "not-found" }; if (room.locked) return { state: "blocked", project, reason: "locked-outline" };
    const candidate = previewRoomRemoval(document, selection.id, { createId: identity.createId, createName: identity.createRoomName });
    if (candidate.state !== "ready") return { state: "blocked", project, reason: candidate.state === "protected-outline" ? "locked-outline" : "not-found" };
    const committed = commitConstructionTransaction(document, candidate.transaction); if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
    const next = replaceConstruction(project, document.id, committed.document); const effects = candidate.transaction.effects.map(({ kind }) => kind);
    return { state: "review-required", project, effects, accept: () => next };
  }
  return { state: "blocked", project, reason: "unsupported" };
}
