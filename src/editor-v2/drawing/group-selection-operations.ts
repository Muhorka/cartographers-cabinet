import type { KernelPoint } from "../geometry/geometry-types";
import { commitConstructionTransaction, previewRoomRemoval, previewWallRemoval } from "../construction/construction-document";
import { assessRegionConstraint, shapePoints } from "../geometry/region-constraints";
import type { EditorProject, PlaceNode, RegionShape } from "../model/project-model";
import { deleteSelection, moveSelection, moveWallGroup, type EditableSelection, type SelectionOperationResult } from "./selection-operations";
import { syncConstructionRooms } from "../model/hierarchy-operations";

type Identity = { createId(): string; createRoomName(index: number): string };

function translatedPolygon(shape: RegionShape, transform: PlaceNode["transform"]): RegionShape {
  const radians = transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const map = ({ x, y }: KernelPoint) => ({ x: x * cosine - y * sine + transform.x, y: x * sine + y * cosine + transform.y });
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) };
  return { kind: "polygon", points: shapePoints(shape).map(map) };
}

export function moveSelectionGroup(project: EditorProject, input: { activePlaceId: string; selections: EditableSelection[]; delta: KernelPoint; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  if (input.selections.length === 1) return moveSelection(project, { ...input, selection: input.selections[0] }, identity);
  if (!input.selections.length) return { state: "blocked", project, reason: "not-found" };
  if (input.selections.every(({ kind }) => kind === "wall")) {
    return moveWallGroup(project, { activePlaceId: input.activePlaceId, wallIds: input.selections.map(({ id }) => id), delta: input.delta, boundaryEditing: input.boundaryEditing }, identity);
  }
  if (input.selections.every(({ kind }) => kind === "place")) return movePlaceGroup(project, input);
  return moveMixedGroup(project, input, identity);
}

function moveMixedGroup(project: EditorProject, input: { activePlaceId: string; selections: EditableSelection[]; delta: KernelPoint; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  const selections = withoutNestedSelections(project, input.selections);
  let next = project;
  for (const selection of selections) {
    const result = moveSelection(next, { ...input, selection }, identity);
    if (result.state === "blocked") return { ...result, project };
    next = result.state === "review-required" ? result.accept() : result.project;
  }
  return { state: "applied", project: next };
}

function withoutNestedSelections(project: EditorProject, selections: EditableSelection[]) {
  const selectedPlaceIds = new Set(selections.filter(({ kind }) => kind === "place").map(({ id }) => id));
  const byId = new Map(project.places.map((place) => [place.id, place]));
  const containedBySelection = (placeId?: string) => {
    let current = placeId ? byId.get(placeId) : undefined;
    while (current) {
      if (selectedPlaceIds.has(current.id)) return true;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };
  return selections.filter((selection) => {
    if (selection.kind === "place") {
      const parentId = byId.get(selection.id)?.parentId;
      return !containedBySelection(parentId);
    }
    if (selection.kind === "element") return !containedBySelection(project.elements.find(({ id }) => id === selection.id)?.belongsToId);
    if (selection.kind === "surface") return !containedBySelection(project.surfaces.find(({ id }) => id === selection.id)?.belongsToId);
    return true;
  });
}

function movePlaceGroup(project: EditorProject, input: { activePlaceId: string; selections: EditableSelection[]; delta: KernelPoint; boundaryEditing: boolean }): SelectionOperationResult {
  const ids = new Set(input.selections.map(({ id }) => id));
  if (ids.has(input.activePlaceId)) return { state: "blocked", project, reason: input.boundaryEditing ? "unsupported" : "locked-outline" };
  if (project.places.filter(({ id }) => ids.has(id)).some(({ locked }) => locked)) return { state: "blocked", project, reason: "locked-outline" };
  const transforms = new Map(project.places.filter(({ id }) => ids.has(id)).map((place) => [place.id, { ...place.transform, x: place.transform.x + input.delta.x, y: place.transform.y + input.delta.y }]));
  if (transforms.size !== ids.size) return { state: "blocked", project, reason: "not-found" };
  for (const selected of project.places.filter(({ id }) => ids.has(id))) {
    const transform = transforms.get(selected.id)!;
    if (!selected.boundary || !selected.parentId) continue;
    const parent = project.places.find(({ id }) => id === selected.parentId); const candidate = translatedPolygon(selected.boundary, transform);
    if (parent?.boundary && assessRegionConstraint(candidate, parent.boundary).state !== "inside") return { state: "blocked", project, reason: "outside-outline" };
  }
  return { state: "applied", project: { ...project, places: project.places.map((place) => transforms.has(place.id) ? { ...place, transform: transforms.get(place.id)! } : place) } };
}

export function deleteSelectionGroup(project: EditorProject, input: { activePlaceId: string; selections: EditableSelection[]; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  if (input.selections.length === 1) return deleteSelection(project, { ...input, selection: input.selections[0] }, identity);
  if (!input.selections.length || input.selections.some(({ kind }) => kind === "place")) return { state: "blocked", project, reason: "unsupported" };
  if (input.selections.every(({ kind }) => kind === "wall" || kind === "room")) return deleteConstructionGroup(project, input, identity);
  return input.selections.reduce<SelectionOperationResult>((result, selection) => result.state === "applied" ? deleteSelection(result.project, { ...input, selection }, identity) : result, { state: "applied", project });
}

function deleteConstructionGroup(project: EditorProject, input: { activePlaceId: string; selections: EditableSelection[]; boundaryEditing: boolean }, identity: Identity): SelectionOperationResult {
  const active = project.places.find(({ id }) => id === input.activePlaceId);
  const owner = active?.kind === "room" ? project.places.find(({ id }) => id === active.parentId) : active;
  const document = project.constructions.find(({ id }) => id === owner?.constructionId);
  if (!document) return { state: "blocked", project, reason: "not-found" };
  const wallIds = new Set(input.selections.filter(({ kind }) => kind === "wall").map(({ id }) => id));
  if ([...wallIds].some((id) => document.walls.find((wall) => wall.id === id)?.role === "boundary")) return { state: "blocked", project, reason: "locked-outline" };
  const roomIdentity = { createId: identity.createId, createName: identity.createRoomName };
  for (const selection of input.selections.filter(({ kind }) => kind === "room")) {
    if (document.rooms.find(({ id }) => id === selection.id)?.locked || project.places.find(({ id }) => id === selection.id)?.locked) return { state: "blocked", project, reason: "locked-outline" };
    const preview = previewRoomRemoval(document, selection.id, roomIdentity);
    if (preview.state !== "ready") return { state: "blocked", project, reason: preview.state === "protected-outline" ? "locked-outline" : "not-found" };
    preview.wallIds.forEach((id) => wallIds.add(id));
  }
  if (!wallIds.size || [...wallIds].some((id) => !document.walls.some((wall) => wall.id === id))) return { state: "blocked", project, reason: "not-found" };
  const preview = previewWallRemoval(document, [...wallIds], roomIdentity); const committed = commitConstructionTransaction(document, preview);
  if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
  const next = syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? committed.document : candidate) }, committed.document);
  const effects = preview.effects.filter(({ kind }) => kind === "openings-removed").map(({ kind }) => kind);
  return effects.length ? { state: "review-required", project, effects, accept: () => next } : { state: "applied", project: next };
}
