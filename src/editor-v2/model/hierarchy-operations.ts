import { constructionNetwork, createConstructionDocument } from "../construction/construction-document";
import type { CanonicalWall, KernelPoint } from "../geometry/geometry-types";
import type { ConstructionSurface, DrawingElement, EditorProject, MapAppearance, PlaceNode, RegionShape } from "./project-model";
import { shapePoints, shapePolygons } from "../geometry/region-constraints";
import { assessRegionConstraint, pointInRegion, unionRegionShapes } from "../geometry/region-constraints";
import { assessPathConstraint } from "../geometry/path-constraints";
import { roomFaceShape } from "../geometry/room-face-shape";
type Identity = { createId(): string };
function place(project: EditorProject, id: string) {
  return project.places.find((candidate) => candidate.id === id);
}

function children(project: EditorProject, id: string) {
  return project.places.filter(({ parentId }) => parentId === id);
}

function descendants(project: EditorProject, id: string) {
  const result = new Set<string>(); const pending = [id];
  while (pending.length) {
    const current = pending.pop()!;
    for (const child of children(project, current)) if (!result.has(child.id)) { result.add(child.id); pending.push(child.id); }
  }
  return result;
}

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
  const places = project.places.filter(({ id }) => !removedRoomIds.has(id)).map((candidate) => {
    const room = construction.rooms.find(({ id }) => id === candidate.id); const face = room ? faceById.get(room.faceId) : undefined;
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

const allowedContainerKinds: Record<PlaceNode["kind"], ReadonlySet<PlaceNode["kind"]>> = {
  world: new Set(),
  location: new Set(["world", "location", "custom"]),
  building: new Set(["world", "location", "custom"]),
  level: new Set(["building"]),
  room: new Set(),
  object: new Set(["world", "location", "building", "level", "room", "custom"]),
  "standalone-room": new Set(["world", "location", "building", "level", "custom"]),
  custom: new Set(["world", "location", "custom"]),
};

type Pose = { x: number; y: number; rotation: number };

function composePose(container: Pose, local: Pose): Pose {
  const radians = container.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  return { x: container.x + local.x * cosine - local.y * sine, y: container.y + local.x * sine + local.y * cosine, rotation: container.rotation + local.rotation };
}

function worldPose(project: EditorProject, id: string): Pose {
  const lineage: PlaceNode[] = []; const visited = new Set<string>(); let current = place(project, id);
  while (current) { if (visited.has(current.id)) throw new Error("The hierarchy contains a cycle"); visited.add(current.id); lineage.unshift(current); current = current.parentId ? place(project, current.parentId) : undefined; }
  return lineage.reduce((pose, candidate) => composePose(pose, candidate.transform), { x: 0, y: 0, rotation: 0 });
}

function relativePose(world: Pose, container: Pose): Pose {
  const radians = -container.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians); const dx = world.x - container.x; const dy = world.y - container.y;
  return { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine, rotation: world.rotation - container.rotation };
}

function shapeInContainer(shape: RegionShape, transform: Pose): RegionShape {
  const radians = transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const map = ({ x, y }: KernelPoint) => ({ x: x * cosine - y * sine + transform.x, y: x * sine + y * cosine + transform.y });
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) };
  return { kind: "polygon", points: shapePoints(shape).map(map) };
}

function synchronizeBuildingBoundaries(project: EditorProject, ids: Array<string | undefined>) {
  const wanted = new Set(ids.filter((id): id is string => Boolean(id)));
  return { ...project, places: project.places.map((candidate) => {
    if (candidate.kind !== "building" || !wanted.has(candidate.id)) return candidate;
    const boundary = unionRegionShapes(project.places.filter(({ parentId, kind, boundary }) => parentId === candidate.id && kind === "level" && boundary).map((level) => shapeInContainer(level.boundary!, level.transform)));
    return boundary ? { ...candidate, boundary } : candidate;
  }) };
}

function canFitInside(project: EditorProject, selected: PlaceNode, container: PlaceNode) {
  if (!selected.boundary || !container.boundary || selected.kind === "location" || selected.kind === "custom") return true;
  const transform = relativePose(worldPose(project, selected.id), worldPose(project, container.id));
  const candidateShape = shapeInContainer(selected.boundary, transform);
  if (assessRegionConstraint(candidateShape, container.boundary).state !== "inside") return false;
  if (selected.kind !== "building") return true;
  return !project.places.some((sibling) => sibling.id !== selected.id && sibling.kind === "building" && sibling.parentId === container.id && sibling.boundary
    && assessRegionConstraint(candidateShape, shapeInContainer(sibling.boundary, sibling.transform)).state !== "outside");
}

export function validContainingPlaces(project: EditorProject, id: string) {
  const selected = place(project, id); if (!selected) return [];
  const nestedIds = descendants(project, id); const allowedKinds = allowedContainerKinds[selected.kind];
  return project.places.filter((candidate) => candidate.id !== id && !nestedIds.has(candidate.id) && allowedKinds.has(candidate.kind) && canFitInside(project, selected, candidate));
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

function pointBetweenPoses(point: KernelPoint, from: Pose, to: Pose): KernelPoint {
  const fromRadians = from.rotation * Math.PI / 180; const fromCosine = Math.cos(fromRadians); const fromSine = Math.sin(fromRadians);
  const world = { x: from.x + point.x * fromCosine - point.y * fromSine, y: from.y + point.x * fromSine + point.y * fromCosine };
  const toRadians = -to.rotation * Math.PI / 180; const toCosine = Math.cos(toRadians); const toSine = Math.sin(toRadians); const dx = world.x - to.x; const dy = world.y - to.y;
  return { x: dx * toCosine - dy * toSine, y: dx * toSine + dy * toCosine };
}

function geometryBetweenPlaces(project: EditorProject, geometry: DrawingElement["geometry"], fromId: string, toId: string): DrawingElement["geometry"] {
  const from = worldPose(project, fromId); const to = worldPose(project, toId); const map = (point: KernelPoint) => pointBetweenPoses(point, from, to); const angle = from.rotation - to.rotation;
  if (geometry.kind === "path") return { ...geometry, points: geometry.points.map(map) };
  if (geometry.kind === "point" || geometry.kind === "note") return { ...geometry, at: map(geometry.at) };
  if (geometry.kind === "bezier") return { ...geometry, nodes: geometry.nodes.map((node) => ({ anchor: map(node.anchor), ...(node.inHandle ? { inHandle: map(node.inHandle) } : {}), ...(node.outHandle ? { outHandle: map(node.outHandle) } : {}) })) };
  const shape = geometry.shape;
  if (shape.kind === "circle") { const center = map({ x: shape.cx, y: shape.cy }); return { kind: "region", shape: { ...shape, cx: center.x, cy: center.y } }; }
  if (shape.kind === "bezier") return { kind: "region", shape: { ...shape, nodes: shape.nodes.map((node) => ({ anchor: map(node.anchor), ...(node.inHandle ? { inHandle: map(node.inHandle) } : {}), ...(node.outHandle ? { outHandle: map(node.outHandle) } : {}) })) } };
  if (shape.kind === "ellipse" && Math.abs(angle % 180) < 1e-7) { const center = map({ x: shape.cx, y: shape.cy }); return { kind: "region", shape: { ...shape, cx: center.x, cy: center.y } }; }
  if (shape.kind === "compound") return { kind: "region", shape: { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) } };
  return { kind: "region", shape: { kind: "polygon", points: shapePoints(shape).map(map) } };
}

function geometryInside(geometry: DrawingElement["geometry"], boundary: RegionShape) {
  if (geometry.kind === "region") return assessRegionConstraint(geometry.shape, boundary).state === "inside";
  if (geometry.kind === "path") return assessPathConstraint(geometry.points, boundary).state === "inside";
  if (geometry.kind === "bezier") return assessPathConstraint(geometry.nodes.map(({ anchor }) => anchor), boundary).state === "inside";
  return pointInRegion(geometry.at, boundary);
}

export function worldPosition(project: EditorProject, placeId: string): KernelPoint {
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

export function deletePlaceSubtree(project: EditorProject, placeId: string) {
  const selected = place(project, placeId); if (!selected) throw new Error("The place does not exist"); if (selected.locked) return project;
  const removedIds = descendants(project, placeId); removedIds.add(placeId);
  const constructionIds = new Set(project.places.filter(({ id }) => removedIds.has(id)).flatMap(({ constructionId }) => constructionId ? [constructionId] : []));
  const next = { ...project, places: project.places.filter(({ id }) => !removedIds.has(id)), elements: project.elements.filter(({ belongsToId }) => !removedIds.has(belongsToId)), surfaces: project.surfaces.filter(({ belongsToId }) => !removedIds.has(belongsToId)), constructions: project.constructions.filter(({ id }) => !constructionIds.has(id)) };
  return selected.kind === "level" ? synchronizeBuildingBoundaries(next, [selected.parentId]) : next;
}
