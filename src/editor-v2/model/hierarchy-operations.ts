import { constructionNetwork, createConstructionDocument } from "../construction/construction-document";
import type { CanonicalWall, KernelPoint } from "../geometry/geometry-types";
import type { ConstructionSurface, DrawingElement, EditorProject, MapAppearance, PlaceNode, RegionShape } from "./project-model";
import { shapePolygons } from "../geometry/region-constraints";
import { roomFaceShape } from "../geometry/room-face-shape";
import { storyRefKey, type StoryObjectRef } from "../story/types";
import { descendants, geometryBetweenPlaces, geometryInside, place, relativePose, synchronizeBuildingBoundaries, validContainingPlaces, worldPose, type Pose } from "./hierarchy-references";
export { validContainingPlaces } from "./hierarchy-references";
type Identity = { createId(): string };
function boundaryWalls(shape: RegionShape, identity: Identity): CanonicalWall[] {
  const rings = shapePolygons(shape).flatMap(({ outer, holes }) => [outer, ...holes]);
  return rings.flatMap((points) => points.map((start, index) => ({ id: identity.createId(), start, end: points[(index + 1) % points.length], thickness: 0.3, role: "boundary" as const })));
}

export function createPlace(project: EditorProject, input: Omit<PlaceNode, "transform" | "tags" | "access" | "properties"> & Partial<Pick<PlaceNode, "transform" | "tags" | "access" | "properties">>) {
  if (input.parentId && !place(project, input.parentId)) throw new Error("The containing place does not exist");
  if (place(project, input.id)) throw new Error("A place with this identifier already exists");
  const created: PlaceNode = { ...input, transform: input.transform ?? { x: 0, y: 0, rotation: 0 }, tags: input.tags ?? [], access: input.access ?? [], properties: input.properties ?? {} };
  return { ...project, places: [...project.places, created] };
}

export function createBuildingWithDefaultLevel(project: EditorProject, input: { id: string; levelId: string; constructionId: string; parentId?: string; name: string; levelName: string; boundary: RegionShape; transform?: PlaceNode["transform"]; roomName?: (index: number) => string }, identity: Identity) {
  let next = createPlace(project, { id: input.id, parentId: input.parentId, name: input.name, kind: "building", boundary: input.boundary, transform: input.transform });
  const construction = createConstructionDocument(input.constructionId, boundaryWalls(input.boundary, identity), { createId: identity.createId, createName: input.roomName ?? ((index) => `Room ${index}`) }, input.boundary);
  next = createPlace(next, { id: input.levelId, parentId: input.id, name: input.levelName, kind: "level", boundary: input.boundary, constructionId: construction.id, order: 0 });
  return syncConstructionRooms({ ...next, constructions: [...next.constructions, construction] }, construction);
}

export function createLevelForBuilding(project: EditorProject, input: { id: string; constructionId: string; buildingId: string; name: string; position?: "above" | "below"; roomName?: (index: number) => string }, identity: Identity) {
  const building = place(project, input.buildingId); if (!building || building.kind !== "building" || !building.boundary) throw new Error("The building does not have an editable outline");
  const siblings = project.places.filter(({ parentId, kind }) => parentId === building.id && kind === "level");
  const orders = siblings.map((candidate, index) => candidate.order ?? index);
  const order = input.position === "below" ? Math.min(...orders, 0) - 1 : Math.max(...orders, -1) + 1;
  const construction = createConstructionDocument(input.constructionId, boundaryWalls(building.boundary, identity), { createId: identity.createId, createName: input.roomName ?? ((index) => `Room ${index}`) }, building.boundary);
  const next = createPlace(project, { id: input.id, parentId: building.id, name: input.name, kind: "level", boundary: structuredClone(building.boundary), constructionId: construction.id, order });
  return syncConstructionRooms({ ...next, constructions: [...next.constructions, construction] }, construction);
}

export function createIndependentLevel(project: EditorProject, input: { id: string; constructionId: string; name: string; boundary: RegionShape; roomName?: (index: number) => string }, identity: Identity) {
  const construction = createConstructionDocument(input.constructionId, boundaryWalls(input.boundary, identity), { createId: identity.createId, createName: input.roomName ?? ((index) => `Room ${index}`) }, input.boundary);
  const next = createPlace(project, { id: input.id, name: input.name, kind: "level", boundary: input.boundary, constructionId: construction.id, order: 0 });
  return syncConstructionRooms({ ...next, constructions: [...next.constructions, construction] }, construction);
}

export function syncConstructionRooms(project: EditorProject, construction: EditorProject["constructions"][number]) {
  const level = project.places.find(({ constructionId }) => constructionId === construction.id); if (!level) return project;
  const network = createRoomFaces(construction); const faceById = new Map(network.map((face) => [face.id, face])); const roomIds = new Set(construction.rooms.map(({ id }) => id));
  const removedRoomIds = new Set(project.places.filter(({ parentId, kind, id }) => parentId === level.id && kind === "room" && !roomIds.has(id)).map(({ id }) => id));
  const existingRoomIds = new Set(project.places.filter(({ parentId, kind }) => parentId === level.id && kind === "room").map(({ id }) => id));
  const levelWorld = removedRoomIds.size === 0 ? undefined : worldPose(project, level.id);
  const orphanedChildTransforms = levelWorld ? new Map(project.places.filter(({ parentId }) => parentId && removedRoomIds.has(parentId)).map((candidate) => [candidate.id, relativePose(worldPose(project, candidate.id), levelWorld)])) : new Map<string, Pose>();
  const places = project.places.filter(({ id }) => !removedRoomIds.has(id)).map((candidate) => {
    const room = construction.rooms.find(({ id }) => id === candidate.id); const face = room ? faceById.get(room.faceId) : undefined;
    const orphanedTransform = orphanedChildTransforms.get(candidate.id);
    if (orphanedTransform) return { ...candidate, parentId: level.id, transform: orphanedTransform };
    return room && face ? { ...candidate, parentId: level.id, kind: "room" as const, name: room.name, description: room.description, boundary: roomFaceShape(face), transform: { x: 0, y: 0, rotation: 0 }, visible: room.visible, locked: room.locked } : candidate;
  });
  for (const room of construction.rooms) {
    if (existingRoomIds.has(room.id)) continue; const face = faceById.get(room.faceId); if (!face) continue;
    places.push({ id: room.id, parentId: level.id, name: room.name, description: room.description, kind: "room", transform: { x: 0, y: 0, rotation: 0 }, boundary: roomFaceShape(face), tags: room.tags, access: room.access, properties: room.properties, visible: room.visible, locked: room.locked });
  }
  const elements = project.elements.map((element) => removedRoomIds.has(element.belongsToId) ? { ...element, belongsToId: level.id } : element);
  const surfaces = project.surfaces.map((surface) => removedRoomIds.has(surface.belongsToId) ? { ...surface, belongsToId: level.id } : surface);
  return { ...project, places, elements, surfaces };
}

function createRoomFaces(construction: EditorProject["constructions"][number]) {
  return constructionNetwork(construction.walls, construction.enclosure).faces;
}

export function reparentPlace(project: EditorProject, id: string, parentId?: string) {
  const selected = place(project, id); if (!selected) throw new Error("The place does not exist"); if (selected.locked) return project;
  if (parentId && !place(project, parentId)) throw new Error("The new containing place does not exist");
  if (parentId === id || (parentId && descendants(project, id).has(parentId))) throw new Error("A place cannot be moved into itself or its contents");
  if (parentId && !validContainingPlaces(project, id).some((candidate) => candidate.id === parentId)) throw new Error("The selected place cannot contain this map");
  const world = worldPose(project, id); const container = parentId ? worldPose(project, parentId) : { x: 0, y: 0, rotation: 0 };
  const transform = relativePose(world, container);
  const next = { ...project, places: project.places.map((candidate) => candidate.id === id ? { ...candidate, parentId, transform } : candidate) };
  return selected.kind === "level" ? synchronizeBuildingBoundaries(next, [selected.parentId, parentId]) : next;
}

export function movePlace(project: EditorProject, id: string, delta: KernelPoint) {
  if (!place(project, id)) throw new Error("The place does not exist");
  return { ...project, places: project.places.map((candidate) => candidate.id === id ? { ...candidate, transform: { ...candidate.transform, x: candidate.transform.x + delta.x, y: candidate.transform.y + delta.y } } : candidate) };
}

export function addElement(project: EditorProject, element: Omit<DrawingElement, "belongsToId"> & { belongsToId?: string }, activePlaceId: string) {
  const belongsToId = element.belongsToId ?? activePlaceId;
  if (!place(project, belongsToId)) throw new Error("The selected owner does not exist");
  if (project.elements.some(({ id }) => id === element.id)) throw new Error("An element with this identifier already exists");
  return { ...project, elements: [...project.elements, { ...element, belongsToId }] };
}

export function addConstructionSurface(project: EditorProject, surface: Omit<ConstructionSurface, "belongsToId"> & { belongsToId?: string }, activePlaceId: string) {
  const belongsToId = surface.belongsToId ?? activePlaceId;
  if (!place(project, belongsToId)) throw new Error("The selected owner does not exist");
  if (project.surfaces.some(({ id }) => id === surface.id)) throw new Error("A construction surface with this identifier already exists");
  return { ...project, surfaces: [...project.surfaces, { ...surface, belongsToId }] };
}

export function changeElementOwnership(project: EditorProject, elementId: string, belongsToId: string) {
  const owner = place(project, belongsToId); if (!owner) throw new Error("The selected owner does not exist");
  const element = project.elements.find(({ id }) => id === elementId); if (!element) throw new Error("The element does not exist");
  if (element.belongsToId === belongsToId) return project;
  const geometry = geometryBetweenPlaces(project, element.geometry, element.belongsToId, belongsToId);
  if (element.layerId === "equipment" && owner.boundary && !geometryInside(geometry, owner.boundary)) throw new Error("The object does not fit inside the selected place");
  const ribbonCutouts = element.ribbonCutouts?.map((shape) => (geometryBetweenPlaces(project, { kind: "region", shape }, element.belongsToId, belongsToId) as { kind: "region"; shape: RegionShape }).shape);
  return { ...project, elements: project.elements.map((candidate) => candidate.id === elementId ? { ...candidate, belongsToId, geometry, ...(ribbonCutouts ? { ribbonCutouts } : {}) } : candidate) };
}

export function validElementOwners(project: EditorProject, elementId: string) {
  const element = project.elements.find(({ id }) => id === elementId); if (!element) return [];
  return project.places.filter((candidate) => {
    if (candidate.id === element.belongsToId || element.layerId !== "equipment" || !candidate.boundary) return true;
    return geometryInside(geometryBetweenPlaces(project, element.geometry, element.belongsToId, candidate.id), candidate.boundary);
  });
}

export function worldPosition(project: EditorProject, placeId: string) {
  const pose = worldPose(project, placeId);
  return { x: pose.x, y: pose.y };
}

export function roots(project: EditorProject) {
  return project.places.filter(({ parentId }) => !parentId);
}

export function wrapPlaceInBroaderMap(project: EditorProject, placeId: string, wrapper: { id: string; name: string; kind: "world" | "location" | "building" | "level" | "custom"; boundary?: RegionShape }) {
  const contained = place(project, placeId); if (!contained) throw new Error("The place does not exist");
  if (place(project, wrapper.id)) throw new Error("A place with this identifier already exists");
  const broader: PlaceNode = { id: wrapper.id, parentId: contained.parentId, name: wrapper.name, kind: wrapper.kind, boundary: wrapper.boundary, transform: contained.transform, tags: [], access: [], properties: {} };
  return { ...project, places: [...project.places.map((candidate) => candidate.id === placeId ? { ...candidate, parentId: wrapper.id, transform: { x: 0, y: 0, rotation: 0 } } : candidate), broader] };
}

export function wrapStandaloneRoomInBuilding(project: EditorProject, roomId: string, input: { buildingId: string; levelId: string; constructionId: string; buildingName: string; levelName: string }, identity: Identity) {
  const room = place(project, roomId); if (!room || room.kind !== "standalone-room" || !room.boundary) throw new Error("The standalone room does not have a usable outline");
  const generated = createConstructionDocument(input.constructionId, boundaryWalls(room.boundary, identity), { createId: identity.createId, createName: () => room.name }, room.boundary);
  const generatedRoom = generated.rooms[0]; if (!generatedRoom) throw new Error("The room outline did not create an interior");
  const construction = { ...generated, rooms: [{ ...generatedRoom, id: room.id, name: room.name, description: room.description, tags: room.tags, access: room.access, properties: room.properties }] };
  let next = { ...project, places: project.places.filter(({ id }) => id !== room.id) };
  next = createPlace(next, { id: input.buildingId, parentId: room.parentId, name: input.buildingName, kind: "building", boundary: room.boundary, transform: room.transform });
  next = createPlace(next, { id: input.levelId, parentId: input.buildingId, name: input.levelName, kind: "level", boundary: structuredClone(room.boundary), constructionId: construction.id, order: 0 });
  next = syncConstructionRooms({ ...next, constructions: [...next.constructions, construction] }, construction);
  return { ...next, places: next.places.map((candidate) => candidate.id === room.id ? { ...candidate, appearance: room.appearance } : candidate) };
}

export function updatePlaceDetails(project: EditorProject, placeId: string, details: { name?: string; description?: string; tags?: string[]; appearance?: MapAppearance }) {
  const selected = place(project, placeId); if (!selected) throw new Error("The place does not exist"); if (selected.locked) return project;
  const constructions = selected.kind === "room" ? project.constructions.map((construction) => construction.rooms.some(({ id }) => id === selected.id) ? { ...construction, rooms: construction.rooms.map((room) => room.id === selected.id ? { ...room, ...details } : room) } : construction) : project.constructions;
  return { ...project, places: project.places.map((candidate) => candidate.id === placeId ? { ...candidate, ...details } : candidate), constructions };
}

const storyReferenceKinds = new Set(["place", "element", "surface", "room", "wall", "opening", "transition"]);

function storyReferenceKey(kind: string, id: string, scopeId?: string) {
  return storyRefKey({ kind: kind as StoryObjectRef["kind"], id, ...(scopeId ? { scopeId } : {}) });
}

function findRemovedStoryReference(value: unknown, removedRefs: Set<string>, removedRoomIds: Set<string>, seen = new Set<object>()): { kind: string; id: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (!Array.isArray(value) && "kind" in value && "id" in value && typeof value.kind === "string" && typeof value.id === "string" && storyReferenceKinds.has(value.kind)) {
    const scopeId = "scopeId" in value && typeof value.scopeId === "string" ? value.scopeId : undefined;
    if (removedRefs.has(storyReferenceKey(value.kind, value.id, scopeId)) || value.kind === "room" && !scopeId && removedRoomIds.has(value.id)) return { kind: value.kind, id: value.id };
  }
  if (Array.isArray(value)) for (const item of value) { const found = findRemovedStoryReference(item, removedRefs, removedRoomIds, seen); if (found) return found; }
  else for (const item of Object.values(value)) { const found = findRemovedStoryReference(item, removedRefs, removedRoomIds, seen); if (found) return found; }
  return undefined;
}

export function deletePlaceSubtree(project: EditorProject, placeId: string) {
  const selected = place(project, placeId); if (!selected) throw new Error("The place does not exist");
  const removedIds = descendants(project, placeId); removedIds.add(placeId);
  const constructionIds = new Set(project.places.filter(({ id }) => removedIds.has(id)).flatMap(({ constructionId }) => constructionId ? [constructionId] : []));
  const removedElementIds = new Set(project.elements.filter(({ belongsToId }) => removedIds.has(belongsToId)).map(({ id }) => id));
  const lockedPlace = project.places.find(({ id, locked }) => removedIds.has(id) && locked);
  if (lockedPlace) throw new Error(`Cannot delete place subtree: place ${lockedPlace.id} is locked.`);
  const lockedElement = project.elements.find(({ belongsToId, locked }) => removedIds.has(belongsToId) && locked);
  if (lockedElement) throw new Error(`Cannot delete place subtree: element ${lockedElement.id} is locked.`);
  const lockedSurface = project.surfaces.find(({ belongsToId, locked }) => removedIds.has(belongsToId) && locked);
  if (lockedSurface) throw new Error(`Cannot delete place subtree: surface ${lockedSurface.id} is locked.`);
  for (const construction of project.constructions) {
    if (!constructionIds.has(construction.id)) continue;
    const lockedWall = construction.walls.find(({ locked }) => locked);
    if (lockedWall) throw new Error(`Cannot delete place subtree: wall ${lockedWall.id} is locked.`);
    const lockedRoom = construction.rooms.find(({ locked }) => locked);
    if (lockedRoom) throw new Error(`Cannot delete place subtree: room ${lockedRoom.id} is locked.`);
    const lockedOpening = construction.openings.find(({ locked }) => locked);
    if (lockedOpening) throw new Error(`Cannot delete place subtree: opening ${lockedOpening.id} is locked.`);
    const lockedTransition = construction.transitions.find(({ locked }) => locked);
    if (lockedTransition) throw new Error(`Cannot delete place subtree: transition ${lockedTransition.id} is locked.`);
  }
  const removedRoomIds = new Set(project.constructions.filter(({ id }) => constructionIds.has(id)).flatMap(({ rooms }) => rooms.map(({ id }) => id)));
  const externalTransition = project.constructions
    .filter(({ id }) => !constructionIds.has(id))
    .flatMap(({ transitions }) => transitions)
    .find((transition) => [transition.sourceLevelId, transition.targetLevelId, ...(transition.connectedLevelIds ?? [])]
      .some((levelId) => Boolean(levelId && removedIds.has(levelId))));
  if (externalTransition) throw new Error(`Cannot delete place subtree: transition ${externalTransition.id} connects to a deleted level.`);
  const removedRefs = new Set<string>();
  project.places.filter(({ id }) => removedIds.has(id)).forEach(({ id, kind }) => removedRefs.add(storyReferenceKey(kind === "room" ? "room" : "place", id)));
  project.elements.filter(({ belongsToId }) => removedIds.has(belongsToId)).forEach(({ id }) => removedRefs.add(storyReferenceKey("element", id)));
  project.surfaces.filter(({ belongsToId }) => removedIds.has(belongsToId)).forEach(({ id }) => removedRefs.add(storyReferenceKey("surface", id)));
  project.constructions.filter(({ id }) => constructionIds.has(id)).forEach((construction) => {
    construction.walls.forEach(({ id }) => removedRefs.add(storyReferenceKey("wall", id, construction.id)));
    construction.rooms.forEach(({ id }) => removedRefs.add(storyReferenceKey("room", id, construction.id)));
    construction.openings.forEach(({ id }) => removedRefs.add(storyReferenceKey("opening", id, construction.id)));
    construction.transitions.forEach(({ id }) => removedRefs.add(storyReferenceKey("transition", id, construction.id)));
  });
  const storyReference = findRemovedStoryReference(project.story, removedRefs, removedRoomIds);
  if (storyReference) throw new Error(`Cannot delete place subtree: story data references ${storyReference.kind} ${storyReference.id}.`);
  const routeReference = project.story.routes.find((route) => {
    const endpoints = [route.query.from, route.query.to];
    if (endpoints.some(({ placeId: endpointPlaceId, levelId }) => removedIds.has(endpointPlaceId) || Boolean(levelId && removedIds.has(levelId)))) return true;
    const alternatives = route.result.route ? [...route.result.routes, route.result.route] : route.result.routes;
    return alternatives.some((alternative) => alternative.segments.some(({ placeId: segmentPlaceId, levelId }) => removedIds.has(segmentPlaceId) || Boolean(levelId && removedIds.has(levelId))));
  });
  if (routeReference) throw new Error(`Cannot delete place subtree: saved route ${routeReference.id} references the deleted place.`);
  const next = {
    ...project,
    places: project.places.filter(({ id }) => !removedIds.has(id)),
    elements: project.elements.filter(({ belongsToId }) => !removedIds.has(belongsToId)),
    surfaces: project.surfaces.filter(({ belongsToId }) => !removedIds.has(belongsToId)),
    constructions: project.constructions.filter(({ id }) => !constructionIds.has(id)),
    roadJunctions: (project.roadJunctions ?? []).filter(({ belongsToId, roadIds }) => !removedIds.has(belongsToId) && roadIds.every((id) => !removedElementIds.has(id))),
  };
  return selected.kind === "level" ? synchronizeBuildingBoundaries(next, [selected.parentId]) : next;
}
