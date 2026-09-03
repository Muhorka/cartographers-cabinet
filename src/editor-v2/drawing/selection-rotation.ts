import { constructionNetwork } from "../construction/construction-network";
import { commitConstructionTransaction, previewEnclosureReplacement, previewWallReplacement } from "../construction/construction-document";
import { validateVerticalTransitions } from "../construction/wall-features";
import { applyAffinePoint, relativePlaceMatrix, transformDrawingGeometry, transformRegion, type AffineMatrix } from "../geometry/affine-transform";
import type { KernelPoint } from "../geometry/geometry-types";
import { assessRegionConstraint, shapePoints } from "../geometry/region-constraints";
import { geometryFitsBoundary } from "./geometry-containment";
import { roadFitsBuildings } from "../roads/road-routing";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import { noteCorners } from "../geometry/note-geometry";
import type { ConstructionDocument } from "../construction/construction-document";
import type { DrawingElement, EditorProject, PlaceNode } from "../model/project-model";

export type RotationSelection = { kind: "place" | "element" | "surface" | "room" | "wall" | "opening" | "transition"; id: string };
export type RotationIdentity = { createId(): string; createRoomName(index: number): string };
export type RotationReason = "not-found" | "mixed-owners" | "locked" | "locked-outline" | "anchored-opening" | "outside-outline" | "collision" | "unsupported";
export type RotationResult = { state: "applied"; project: EditorProject; selections: RotationSelection[] } | { state: "blocked"; project: EditorProject; reason: RotationReason };
export type RotationBounds = { minX: number; minY: number; maxX: number; maxY: number };

type RecordItem = { selection: RotationSelection; ownerId: string; points: KernelPoint[] };
type ConstructionItem = { ownerId: string; document: ConstructionDocument; wallIds: Set<string>; transitionIds: Set<string> };

function multiply(left: AffineMatrix, right: AffineMatrix): AffineMatrix {
  const [a, b, c, d, e, f] = left; const [g, h, i, j, k, l] = right;
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
}

function invert([a, b, c, d, e, f]: AffineMatrix): AffineMatrix {
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return [1, 0, 0, 1, 0, 0];
  return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant];
}

function rotationAround(center: KernelPoint, degrees: number): AffineMatrix {
  const angle = degrees * Math.PI / 180; const cosine = Math.cos(angle); const sine = Math.sin(angle);
  return [cosine, sine, -sine, cosine, center.x - cosine * center.x + sine * center.y, center.y - sine * center.x - cosine * center.y];
}

function poseMatrix(place: PlaceNode): AffineMatrix {
  const angle = place.transform.rotation * Math.PI / 180; const cosine = Math.cos(angle); const sine = Math.sin(angle);
  return [cosine, sine, -sine, cosine, place.transform.x, place.transform.y];
}

function poseFromMatrix([a, b, , , x, y]: AffineMatrix) { return { x, y, rotation: Math.atan2(b, a) * 180 / Math.PI }; }

function pointsForGeometry(geometry: DrawingElement["geometry"]): KernelPoint[] {
  if (geometry.kind === "region") return shapePoints(geometry.shape);
  if (geometry.kind === "path") return geometry.points;
  if (geometry.kind === "bezier") return geometry.nodes.map(({ anchor }) => anchor);
  if (geometry.kind === "note") return noteCorners(geometry);
  return [geometry.at];
}

function ownerConstruction(project: EditorProject, selection: RotationSelection) {
  const document = project.constructions.find((candidate) => {
    if (selection.kind === "wall") return candidate.walls.some(({ id }) => id === selection.id);
    if (selection.kind === "room") return candidate.rooms.some(({ id }) => id === selection.id);
    if (selection.kind === "opening") return candidate.openings.some(({ id }) => id === selection.id);
    return candidate.transitions.some(({ id }) => id === selection.id);
  });
  return document && project.places.find(({ constructionId }) => constructionId === document.id);
}

function constructionForSelection(project: EditorProject, selection: RotationSelection) {
  const owner = ownerConstruction(project, selection); return owner && project.constructions.find(({ id }) => id === owner.constructionId);
}

function findRecord(project: EditorProject, activePlaceId: string, selection: RotationSelection): RecordItem | undefined {
  const activeToOwner = (ownerId: string) => relative(project, activePlaceId, ownerId);
  if (selection.kind === "element") { const element = project.elements.find(({ id }) => id === selection.id); return element ? { selection, ownerId: element.belongsToId, points: pointsForGeometry(element.geometry).map((point) => applyAffinePoint(activeToOwner(element.belongsToId), point)) } : undefined; }
  if (selection.kind === "surface") { const surface = project.surfaces.find(({ id }) => id === selection.id); return surface ? { selection, ownerId: surface.belongsToId, points: shapePoints(surface.shape).map((point) => applyAffinePoint(activeToOwner(surface.belongsToId), point)) } : undefined; }
  if (selection.kind === "place") { const place = project.places.find(({ id }) => id === selection.id); return place?.parentId && place.boundary ? { selection, ownerId: place.parentId, points: shapePoints(place.boundary).map((point) => applyAffinePoint(activeToOwner(place.id), point)) } : undefined; }
  const owner = ownerConstruction(project, selection); if (!owner) return undefined;
  const document = project.constructions.find(({ id }) => id === owner.constructionId)!;
  if (selection.kind === "wall") { const wall = document.walls.find(({ id }) => id === selection.id); return wall ? { selection, ownerId: owner.id, points: [wall.start, wall.end].map((point) => applyAffinePoint(activeToOwner(owner.id), point)) } : undefined; }
  if (selection.kind === "transition") { const transition = document.transitions.find(({ id }) => id === selection.id); return transition ? { selection, ownerId: owner.id, points: shapePoints(transition.footprint).map((point) => applyAffinePoint(activeToOwner(owner.id), point)) } : undefined; }
  const room = document.rooms.find(({ id }) => id === selection.id); const face = room && constructionNetwork(document.walls, document.enclosure).faces.find(({ id }) => id === room.faceId);
  return face ? { selection, ownerId: owner.id, points: [...face.outer, ...face.holes.flat()].map((point) => applyAffinePoint(activeToOwner(owner.id), point)) } : undefined;
}

function relative(project: EditorProject, target: string, source: string) { return relativePlaceMatrix(project, target, source); }

function descendants(project: EditorProject, ancestorId: string, candidateId: string) {
  let current = project.places.find(({ id }) => id === candidateId)?.parentId;
  while (current) { if (current === ancestorId) return true; current = project.places.find(({ id }) => id === current)?.parentId; }
  return false;
}

function selectionOwnerPlace(project: EditorProject, selection: RotationSelection) {
  if (selection.kind === "place") return selection.id;
  if (selection.kind === "element") return project.elements.find(({ id }) => id === selection.id)?.belongsToId;
  if (selection.kind === "surface") return project.surfaces.find(({ id }) => id === selection.id)?.belongsToId;
  return ownerConstruction(project, selection)?.id;
}

function openingCoveredBySelection(project: EditorProject, opening: RotationSelection, selections: readonly RotationSelection[]) {
  const document = constructionForSelection(project, opening); const wallId = document?.openings.find(({ id }) => id === opening.id)?.wallId;
  return Boolean(wallId && selections.some((selection) => {
    if (selection.kind === "wall") return selection.id === wallId;
    if (selection.kind !== "room") return false;
    const roomDocument = constructionForSelection(project, selection); const room = roomDocument?.rooms.find(({ id }) => id === selection.id); const face = room && constructionNetwork(roomDocument!.walls, roomDocument!.enclosure).faces.find(({ id }) => id === room.faceId);
    return roomDocument?.id === document?.id && Boolean(face?.wallIds.includes(wallId));
  }));
}

function effectiveSelections(project: EditorProject, selections: readonly RotationSelection[]) {
  const places = selections.filter(({ kind }) => kind === "place");
  return selections.filter((selection) => selection.kind === "place" || !places.some((place) => {
    const ownerId = selectionOwnerPlace(project, selection); return ownerId === place.id || (ownerId ? descendants(project, place.id, ownerId) : false);
  })).filter((selection) => selection.kind !== "opening" || !openingCoveredBySelection(project, selection, selections));
}

function records(project: EditorProject, activePlaceId: string, selections: readonly RotationSelection[]) { return effectiveSelections(project, selections).map((selection) => findRecord(project, activePlaceId, selection)); }

export function rotationSelectionBounds(project: EditorProject, activePlaceId: string, selections: readonly RotationSelection[]): RotationBounds | undefined {
  const points = records(project, activePlaceId, selections).flatMap((record) => record?.points ?? []); if (!points.length) return undefined;
  return { minX: Math.min(...points.map(({ x }) => x)), minY: Math.min(...points.map(({ y }) => y)), maxX: Math.max(...points.map(({ x }) => x)), maxY: Math.max(...points.map(({ y }) => y)) };
}

export function rotationSelectionCenter(project: EditorProject, activePlaceId: string, selections: readonly RotationSelection[]): KernelPoint | undefined {
  const bounds = rotationSelectionBounds(project, activePlaceId, selections); return bounds && { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

function placeLocked(place: PlaceNode) { return place.locked === true || ["world", "level", "room"].includes(place.kind); }

function validate(project: EditorProject, activePlaceId: string, selections: readonly RotationSelection[], boundaryEditing: boolean) {
  if (!selections.length || new Set(selections.map(({ id }) => id)).size !== selections.length) return "not-found" as const;
  if (!project.places.some(({ id }) => id === activePlaceId)) return "not-found" as const;
  const effective = effectiveSelections(project, selections);
  if (effective.some(({ kind }) => kind === "opening")) return "anchored-opening" as const;
  const resolved = records(project, activePlaceId, effective); if (resolved.some((record) => !record)) return "not-found" as const;
  const places = effective.filter(({ kind }) => kind === "place").map(({ id }) => project.places.find((place) => place.id === id)!);
  if (places.some(placeLocked)) return "locked" as const;
  if (effective.some(({ kind, id }) => kind === "element" && project.elements.find((element) => element.id === id)?.locked || kind === "surface" && project.surfaces.find((surface) => surface.id === id)?.locked)) return "locked" as const;
  if (resolved.some((record) => record && record.selection.kind === "transition" && constructionForSelection(project, record.selection)?.transitions.some((transition) => transition.id === record.selection.id && transition.locked))) return "locked" as const;
  if (resolved.some((record) => record && record.selection.kind === "room" && constructionForSelection(project, record.selection)?.rooms.some((room) => room.id === record.selection.id && room.locked))) return "locked" as const;
  const constructionOwners = new Set(resolved.flatMap((record) => record && ["room", "wall", "transition"].includes(record.selection.kind) ? [record.ownerId] : []));
  if (constructionOwners.size > 1) return "mixed-owners" as const;
  const docs = resolved.flatMap((record) => record && ["room", "wall"].includes(record.selection.kind) ? [ownerConstruction(project, record.selection)] : []).filter(Boolean);
  const wallIds = new Set(docs.flatMap((owner) => { const document = project.constructions.find(({ id }) => id === owner!.constructionId)!; return resolved.flatMap((record) => { if (!record || record.ownerId !== owner!.id) return []; if (record.selection.kind === "wall") return [record.selection.id]; if (record.selection.kind !== "room") return []; const room = document.rooms.find(({ id }) => id === record.selection.id); const face = room && constructionNetwork(document.walls, document.enclosure).faces.find(({ id }) => id === room.faceId); return face?.wallIds ?? []; }); }));
  if (!boundaryEditing && [...wallIds].some((id) => docs.some((owner) => project.constructions.find(({ id: constructionId }) => constructionId === owner!.constructionId)?.walls.some((wall) => wall.id === id && wall.role === "boundary")))) return "locked-outline" as const;
  if ([...wallIds].some((id) => project.constructions.some((document) => document.walls.some((wall) => wall.id === id && wall.locked)))) return "locked" as const;
  return undefined;
}

export function canRotateSelection(project: EditorProject, activePlaceId: string, selections: readonly RotationSelection[], boundaryEditing = false) {
  const reason = validate(project, activePlaceId, selections, boundaryEditing); return reason ? { can: false as const, reason } : { can: true as const };
}

function constructionItems(project: EditorProject, selections: readonly RotationSelection[]) {
  const items = new Map<string, ConstructionItem>();
  for (const selection of effectiveSelections(project, selections)) {
    if (!["room", "wall", "transition"].includes(selection.kind)) continue;
    const owner = ownerConstruction(project, selection); if (!owner) continue; const document = project.constructions.find(({ id }) => id === owner.constructionId)!;
    const item = items.get(document.id) ?? { ownerId: owner.id, document, wallIds: new Set<string>(), transitionIds: new Set<string>() }; items.set(document.id, item);
    if (selection.kind === "wall") item.wallIds.add(selection.id); else if (selection.kind === "transition") item.transitionIds.add(selection.id); else { const room = document.rooms.find(({ id }) => id === selection.id); const face = room && constructionNetwork(document.walls, document.enclosure).faces.find(({ id }) => id === room.faceId); face?.wallIds.forEach((id) => item.wallIds.add(id)); }
  }
  return [...items.values()];
}

function transformPlace(project: EditorProject, place: PlaceNode, activePlaceId: string, matrix: AffineMatrix) {
  if (!place.parentId) return place;
  const parentToActive = relative(project, activePlaceId, place.parentId); const next = multiply(invert(parentToActive), multiply(matrix, multiply(parentToActive, poseMatrix(place))));
  return { ...place, transform: poseFromMatrix(next) };
}

function elementMatrix(project: EditorProject, activePlaceId: string, ownerId: string, matrix: AffineMatrix) { const ownerToActive = relative(project, activePlaceId, ownerId); return multiply(relative(project, ownerId, activePlaceId), multiply(matrix, ownerToActive)); }

function transformedConstruction(project: EditorProject, item: ConstructionItem, activePlaceId: string, matrix: AffineMatrix, identity: RotationIdentity) {
  const local = elementMatrix(project, activePlaceId, item.ownerId, matrix); const walls = item.document.walls.map((wall) => item.wallIds.has(wall.id) ? { ...wall, start: applyAffinePoint(local, wall.start), end: applyAffinePoint(local, wall.end) } : wall);
  const identityForRooms = { createId: identity.createId, createName: identity.createRoomName }; const boundaryIds = item.document.walls.filter(({ role }) => role === "boundary").map(({ id }) => id);
  const enclosure = boundaryIds.length > 0 && boundaryIds.every((id) => item.wallIds.has(id)) && item.document.enclosure ? transformRegion(local, item.document.enclosure) : item.document.enclosure;
  const preview = item.wallIds.size ? enclosure !== item.document.enclosure ? previewEnclosureReplacement(item.document, walls, enclosure!, identityForRooms) : previewWallReplacement(item.document, walls, identityForRooms) : undefined;
  const candidate = preview ? commitConstructionTransaction(item.document, preview) : { state: "committed" as const, document: { ...item.document, revision: item.document.revision + 1 } };
  if (candidate.state !== "committed") return undefined;
  const rotation = Math.atan2(local[1], local[0]) * 180 / Math.PI;
  const transitions = candidate.document.transitions.map((transition) => item.transitionIds.has(transition.id) ? { ...transition, footprint: transformRegion(local, transition.footprint), direction: transition.direction === undefined ? undefined : transition.direction + rotation } : transition);
  const result = { ...candidate.document, transitions };
  return validateVerticalTransitions(result).length ? undefined : result;
}

function fits(project: EditorProject, elements: DrawingElement[]) {
  return elements.every((element) => {
    if (!roadFitsBuildings(project, element)) return false; const owner = project.places.find(({ id }) => id === element.belongsToId);
    return element.layerId !== "equipment" || !owner?.boundary || geometryFitsBoundary(element.geometry, owner.boundary);
  });
}

function placesFit(project: EditorProject, places: PlaceNode[]) {
  return places.every((place) => {
    if (!place.parentId || !place.boundary || ["location", "custom"].includes(place.kind)) return true;
    const parent = project.places.find(({ id }) => id === place.parentId); if (!parent?.boundary) return true;
    const radians = place.transform.rotation * Math.PI / 180; const local: AffineMatrix = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), place.transform.x, place.transform.y];
    return assessRegionConstraint(transformRegion(local, place.boundary), parent.boundary).state === "inside";
  });
}

export function rotateSelection(project: EditorProject, activePlaceId: string, selections: readonly RotationSelection[], degrees: number, identity: RotationIdentity, boundaryEditing = false): RotationResult {
  const reason = validate(project, activePlaceId, selections, boundaryEditing); if (reason || !Number.isFinite(degrees)) return { state: "blocked", project, reason: reason ?? "unsupported" };
  const effective = effectiveSelections(project, selections); const center = rotationSelectionCenter(project, activePlaceId, effective); if (!center) return { state: "blocked", project, reason: "unsupported" };
  const matrix = rotationAround(center, degrees); let next = { ...project, places: project.places.map((place) => effective.some((selection) => selection.kind === "place" && selection.id === place.id) ? transformPlace(project, place, activePlaceId, matrix) : place) };
  const transformedPlaces = next.places.filter((place) => effective.some((selection) => selection.kind === "place" && selection.id === place.id));
  if (!placesFit(next, transformedPlaces)) return { state: "blocked", project, reason: "outside-outline" };
  const selectedElementIds = new Set(effective.filter(({ kind }) => kind === "element").map(({ id }) => id)); const roomIds = new Set(effective.filter(({ kind }) => kind === "room").map(({ id }) => id));
  const items = constructionItems(project, effective); const roomOwned = new Set(items.flatMap((item) => [...roomIds].filter((id) => project.places.find((place) => place.id === id)?.parentId === item.ownerId)));
  const elements = next.elements.map((element) => { const direct = selectedElementIds.has(element.id); const roomChild = roomOwned.has(element.belongsToId); if (!direct && !roomChild) return element; const ownerId = element.belongsToId; return { ...element, geometry: transformDrawingGeometry(elementMatrix(project, activePlaceId, ownerId, matrix), element.geometry), ribbonCutouts: element.ribbonCutouts?.map((shape) => transformRegion(elementMatrix(project, activePlaceId, ownerId, matrix), shape)) }; });
  next = { ...next, elements };
  next = { ...next, surfaces: next.surfaces.map((surface) => effective.some((selection) => selection.kind === "surface" && selection.id === surface.id) ? { ...surface, shape: transformRegion(elementMatrix(project, activePlaceId, surface.belongsToId, matrix), surface.shape) } : surface) };
  for (const item of items) { const document = transformedConstruction(project, item, activePlaceId, matrix, identity); if (!document) return { state: "blocked", project, reason: "collision" }; next = syncConstructionRooms({ ...next, constructions: next.constructions.map((candidate) => candidate.id === document.id ? document : candidate) }, document); }
  if (!fits(next, elements.filter((element) => selectedElementIds.has(element.id) || roomOwned.has(element.belongsToId)))) return { state: "blocked", project, reason: "outside-outline" };
  return { state: "applied", project: next, selections: effective };
}
