import { reshapeRoad } from "../roads/road-editing";
import { reshapeRibbon } from "../geometry/ribbon-editing";
import { commitRibbonEdit } from "../geometry/ribbon-commit";
import { deleteVerticalTransition, findTransitionRoomFace, placeVerticalTransition, resizeWallOpening, updateVerticalTransition, type VerticalTransition } from "../construction/wall-features";
import { assessRegionConstraint, repairRegionShape } from "../geometry/region-constraints";
import { resizeRegionFromCorner, type ResizeCorner } from "../geometry/region-resize";
import { roomFaceShape } from "../geometry/room-face-shape";
import type { KernelPoint } from "../geometry/geometry-types";
import { changeElementOwnership, syncConstructionRooms } from "../model/hierarchy-operations";
import type { DrawingElement, EditorProject, MapAppearance } from "../model/project-model";
import type { SelectionOperationResult } from "./selection-operations";
import { moveRegionVertex } from "../geometry/region-vertex-edit";
import { constructionForSelection, selectionIsLocked } from "./selection-locks";
import { movePathAnchor } from "../geometry/path-anchor-edit";
import { geometryFitsBoundary } from "./geometry-containment";
import { isFlowingWater, isRibbonElement } from "../geometry/ribbon-geometry";
import { noteDimensions, noteLocalPoint, noteWorldPoint } from "../geometry/note-geometry";

function activeConstruction(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = active?.kind === "room" && active.parentId ? project.places.find(({ id }) => id === active.parentId) : active;
  if (owner?.kind === "building") {
    const levels = project.places.filter(({ parentId, kind }) => parentId === owner.id && kind === "level");
    if (levels.length === 1) return project.constructions.find(({ id }) => id === levels[0].constructionId);
  }
  return project.constructions.find(({ id }) => id === owner?.constructionId);
}

export function updateElementDetails(project: EditorProject, id: string, details: { widthMeters?: number; name?: string; description?: string; tags?: string[]; belongsToId?: string; appearance?: MapAppearance; properties?: Record<string, string | number | boolean | null>; geometry?: DrawingElement["geometry"]; visible?: boolean; locked?: boolean }) {
  if (details.belongsToId && !project.places.some(({ id: placeId }) => placeId === details.belongsToId)) return project;
  // Callers may carry gesture fields as well as metadata. Never spread an
  // entire command into the persisted object: only these fields are editable.
  const allowed = ["widthMeters", "name", "description", "tags", "appearance", "properties", "geometry", "visible", "locked"];
  const metadata = Object.fromEntries(Object.entries(details).filter(([key, value]) => allowed.includes(key) && value !== undefined));
  const editableKeys = [...Object.keys(metadata), ...(details.belongsToId ? ["belongsToId"] : [])].filter((key) => key !== "visible" && key !== "locked");
  if (editableKeys.length && selectionIsLocked(project, { kind: "element", id })) return project;
  const { belongsToId } = details;
  const moved = belongsToId ? changeElementOwnership(project, id, belongsToId) : project;
  const selected = moved.elements.find((element) => element.id === id);
  if (selected && isRibbonElement(selected)) { const ratio = details.widthMeters ? details.widthMeters / (selected.widthMeters ?? 4) : 1; const candidate = { ...selected, ...metadata, widthProfile: selected.widthProfile?.map((station) => ({ ...station, left: station.left * ratio, right: station.right * ratio })) }; return commitRibbonEdit(moved, candidate) ?? project; }
  return { ...moved, elements: moved.elements.map((element) => element.id === id ? { ...element, ...metadata } : element) };
}

export function updateSelectionState(project: EditorProject, selection: { kind: string; id: string; scopeId?: string }, details: { visible?: boolean; locked?: boolean }) {
  if (selection.kind === "element") return updateElementDetails(project, selection.id, details);
  if (selection.kind === "place") return { ...project, places: project.places.map((place) => place.id === selection.id ? { ...place, ...details } : place) };
  if (selection.kind === "surface") return { ...project, surfaces: project.surfaces.map((surface) => surface.id === selection.id ? { ...surface, ...details } : surface) };
  const key = selection.kind === "wall" ? "walls" : selection.kind === "opening" ? "openings" : selection.kind === "transition" ? "transitions" : selection.kind === "room" ? "rooms" : undefined;
  const owner = key ? constructionForSelection(project, selection as Parameters<typeof constructionForSelection>[1]) : undefined;
  const constructions = owner && key ? project.constructions.map((document) => document.id === owner.id ? { ...document, revision: document.revision + 1, [key]: document[key].map((item) => item.id === selection.id ? { ...item, ...details } : item) } : document) : project.constructions;
  const places = selection.kind === "room" ? project.places.map((place) => place.id === selection.id ? { ...place, ...details } : place) : project.places;
  return { ...project, constructions, places };
}

export function updateRoomName(project: EditorProject, activePlaceId: string, id: string, name: string) {
  const document = activeConstruction(project, activePlaceId); if (!document) return project;
  if (document.rooms.find(({ id: roomId }) => roomId === id)?.locked || project.places.find(({ id: placeId }) => placeId === id)?.locked) return project;
  const changed = { ...document, rooms: document.rooms.map((room) => room.id === id ? { ...room, name } : room) };
  return syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? changed : candidate) }, changed);
}

export function updateOpeningWidth(project: EditorProject, activePlaceId: string, id: string, width: number, scopeId?: string): SelectionOperationResult {
  const document = constructionForSelection(project, { kind: "opening", id, ...(scopeId ? { scopeId } : {}) }); if (!document) return { state: "blocked", project, reason: "not-found" };
  const opening = document.openings.find(({ id: openingId }) => openingId === id); const wall = opening && document.walls.find(({ id: wallId }) => wallId === opening.wallId);
  if (opening?.locked || wall?.locked) return { state: "blocked", project, reason: "locked-outline" };
  const resized = resizeWallOpening(document, id, width);
  if (resized.state !== "resized") return { state: "blocked", project, reason: resized.state === "not-found" ? "not-found" : "collision" };
  const next = syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? resized.document : candidate) }, resized.document);
  return { state: "applied", project: next };
}

export function updateTransitionDetails(project: EditorProject, id: string, details: Partial<Pick<VerticalTransition, "kind" | "sourceLevelId" | "targetLevelId" | "connectedLevelIds" | "style" | "direction" | "sameLevelRise">>, scopeId?: string): SelectionOperationResult {
  const document = constructionForSelection(project, { kind: "transition", id, ...(scopeId ? { scopeId } : {}) });
  const transition = document?.transitions.find((candidate) => candidate.id === id);
  if (transition?.locked) return { state: "blocked", project, reason: "locked-outline" };
  if (!document) return { state: "blocked", project, reason: "not-found" };
  const updated = updateVerticalTransition(document, id, details, { levelKinds: new Map(project.places.map(({ id: placeId, kind }) => [placeId, kind])) });
  if (updated.state !== "updated") return { state: "blocked", project, reason: updated.state === "not-found" ? "not-found" : updated.reason === "outside-room" ? "outside-outline" : "collision" };
  return { state: "applied", project: syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? updated.document : candidate) }, updated.document) };
}

export function resizeTransitionFootprint(project: EditorProject, id: string, corner: ResizeCorner, point: KernelPoint, scopeId?: string): SelectionOperationResult {
  const document = constructionForSelection(project, { kind: "transition", id, ...(scopeId ? { scopeId } : {}) });
  const transition = document?.transitions.find((candidate) => candidate.id === id);
  if (selectionIsLocked(project, { kind: "transition", id, ...(scopeId ? { scopeId } : {}) })) return { state: "blocked", project, reason: "locked-outline" };
  if (!document || !transition) return { state: "blocked", project, reason: "not-found" };
  const footprint = resizeRegionFromCorner(transition.footprint, corner, point);
  if (!footprint) return { state: "blocked", project, reason: "collision" };
  const face = findTransitionRoomFace(document, footprint);
  if (!face) return { state: "blocked", project, reason: "outside-outline" };
  const without = deleteVerticalTransition(document, id).document;
  const result = placeVerticalTransition(without, { ...transition, footprint, enclosure: roomFaceShape(face) }, { levelKinds: new Map(project.places.map(({ id: placeId, kind }) => [placeId, kind])) });
  if (result.state !== "placed") return { state: "blocked", project, reason: result.state === "outside-room" ? "outside-outline" : "collision" };
  const changed = {
    ...result.document,
    transitions: result.document.transitions.map((candidate) => candidate.id === id ? {
      ...candidate,
      ...(transition.visible === undefined ? {} : { visible: transition.visible }),
      ...(transition.locked === undefined ? {} : { locked: transition.locked }),
    } : candidate),
  };
  return { state: "applied", project: syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? changed : candidate) }, changed) };
}

export function resizeElementRegion(project: EditorProject, id: string, corner: ResizeCorner, point: KernelPoint): SelectionOperationResult {
  const selected = project.elements.find((element) => element.id === id);
  if (!selected) return { state: "blocked", project, reason: "unsupported" };
  if (selectionIsLocked(project, { kind: "element", id })) return { state: "blocked", project, reason: "locked-outline" };
  if (selected.geometry.kind === "note") {
    const geometry = resizeNoteFromCorner(selected.geometry, corner, point);
    if (!geometry) return { state: "blocked", project, reason: "collision" };
    return { state: "applied", project: { ...project, elements: project.elements.map((element) => element.id === id ? { ...element, geometry } : element) } };
  }
  if (selected.geometry.kind !== "region") return { state: "blocked", project, reason: "unsupported" };
  const shape = resizeRegionFromCorner(selected.geometry.shape, corner, point);
  if (!shape) return { state: "blocked", project, reason: "collision" };
  const owner = project.places.find(({ id: placeId }) => placeId === selected.belongsToId);
  if (selected.layerId === "equipment" && owner?.boundary && assessRegionConstraint(shape, owner.boundary).state !== "inside") return { state: "blocked", project, reason: "outside-outline" };
  return { state: "applied", project: { ...project, elements: project.elements.map((element) => element.id === id ? { ...element, geometry: { kind: "region", shape } } : element) } };
}

function resizeNoteFromCorner(note: Extract<DrawingElement["geometry"], { kind: "note" }>, corner: ResizeCorner, point: KernelPoint) {
  const { width, height } = noteDimensions(note); const pointer = noteLocalPoint(note, point);
  const opposite = { x: corner.includes("east") ? 0 : width, y: corner.includes("south") ? 0 : height };
  const nextWidth = Math.abs(pointer.x - opposite.x); const nextHeight = Math.abs(pointer.y - opposite.y);
  if (nextWidth < .2 || nextHeight < .2) return undefined;
  const origin = { x: corner.includes("west") ? opposite.x - nextWidth : opposite.x, y: corner.includes("north") ? opposite.y - nextHeight : opposite.y };
  return { ...note, at: noteWorldPoint(note, origin), width: nextWidth, height: nextHeight };
}

export function moveElementRegionVertex(project: EditorProject, id: string, polygonIndex: number, vertexIndex: number, point: KernelPoint): SelectionOperationResult {
  const selected = project.elements.find((element) => element.id === id);
  if (selected && selectionIsLocked(project, { kind: "element", id })) return { state: "blocked", project, reason: "locked-outline" };
  if (selected && isRibbonElement(selected)) { const candidate = isFlowingWater(selected) ? reshapeRibbon(selected, polygonIndex, vertexIndex, point) : reshapeRoad(selected, polygonIndex, vertexIndex, point); const next = candidate && commitRibbonEdit(project, candidate); return next ? { state: "applied", project: next } : { state: "blocked", project, reason: "collision" }; }
  if (selected && (selected.geometry.kind === "path" || selected.geometry.kind === "bezier")) {
    const geometry = polygonIndex === 0 ? movePathAnchor(selected.geometry, vertexIndex, point) : undefined;
    if (!geometry) return { state: "blocked", project, reason: "unsupported" };
    const owner = project.places.find(({ id: placeId }) => placeId === selected.belongsToId);
    if (selected.layerId === "equipment" && owner?.boundary && !geometryFitsBoundary(geometry, owner.boundary)) return { state: "blocked", project, reason: "outside-outline" };
    return { state: "applied", project: { ...project, elements: project.elements.map((element) => element.id === id ? { ...element, geometry } : element) } };
  }
  if (!selected || selected.geometry.kind !== "region") return { state: "blocked", project, reason: "unsupported" };
  if (selected.locked) return { state: "blocked", project, reason: "locked-outline" };
  const changed = moveRegionVertex(selected.geometry.shape, polygonIndex, vertexIndex, point); const shape = changed && repairRegionShape(changed);
  if (!shape) return { state: "blocked", project, reason: "collision" };
  const owner = project.places.find(({ id: placeId }) => placeId === selected.belongsToId);
  if (selected.layerId === "equipment" && owner?.boundary && assessRegionConstraint(shape, owner.boundary).state !== "inside") return { state: "blocked", project, reason: "outside-outline" };
  return { state: "applied", project: { ...project, elements: project.elements.map((element) => element.id === id ? { ...element, geometry: { kind: "region", shape } } : element) } };
}
