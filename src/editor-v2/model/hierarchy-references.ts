import type { KernelPoint } from "../geometry/geometry-types";
import { assessRegionConstraint, pointInRegion, shapePoints, unionRegionShapes } from "../geometry/region-constraints";
import { assessPathConstraint } from "../geometry/path-constraints";
import type { DrawingElement, EditorProject, PlaceNode, RegionShape } from "./project-model";

export function place(project: EditorProject, id: string) {
  return project.places.find((candidate) => candidate.id === id);
}

function children(project: EditorProject, id: string) {
  return project.places.filter(({ parentId }) => parentId === id);
}

export function descendants(project: EditorProject, id: string) {
  const result = new Set<string>(); const pending = [id];
  while (pending.length) {
    const current = pending.pop()!;
    for (const child of children(project, current)) if (!result.has(child.id)) { result.add(child.id); pending.push(child.id); }
  }
  return result;
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

export type Pose = { x: number; y: number; rotation: number };

function composePose(container: Pose, local: Pose): Pose {
  const radians = container.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  return { x: container.x + local.x * cosine - local.y * sine, y: container.y + local.x * sine + local.y * cosine, rotation: container.rotation + local.rotation };
}

export function worldPose(project: EditorProject, id: string): Pose {
  const lineage: PlaceNode[] = []; const visited = new Set<string>(); let current = place(project, id);
  while (current) { if (visited.has(current.id)) throw new Error("The hierarchy contains a cycle"); visited.add(current.id); lineage.unshift(current); current = current.parentId ? place(project, current.parentId) : undefined; }
  return lineage.reduce((pose, candidate) => composePose(pose, candidate.transform), { x: 0, y: 0, rotation: 0 });
}

export function relativePose(world: Pose, container: Pose): Pose {
  const radians = -container.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians); const dx = world.x - container.x; const dy = world.y - container.y;
  return { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine, rotation: world.rotation - container.rotation };
}

function shapeInContainer(shape: RegionShape, transform: Pose): RegionShape {
  const radians = transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const map = ({ x, y }: KernelPoint) => ({ x: x * cosine - y * sine + transform.x, y: x * sine + y * cosine + transform.y });
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) };
  return { kind: "polygon", points: shapePoints(shape).map(map) };
}

export function synchronizeBuildingBoundaries(project: EditorProject, ids: Array<string | undefined>) {
  const wanted = new Set(ids.filter((id): id is string => Boolean(id)));
  return { ...project, places: project.places.map((candidate) => {
    if (candidate.kind !== "building" || !wanted.has(candidate.id)) return candidate;
    const boundary = unionBuildingLevels(project, candidate.id);
    return boundary ? { ...candidate, boundary } : candidate;
  }) };
}

function unionBuildingLevels(project: EditorProject, buildingId: string) {
  const levels = project.places.filter(({ parentId, kind, boundary }) => parentId === buildingId && kind === "level" && boundary);
  if (!levels.length) return undefined;
  return unionRegionShapes(levels.map((level) => shapeInContainer(level.boundary!, level.transform)));
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

function pointBetweenPoses(point: KernelPoint, from: Pose, to: Pose): KernelPoint {
  const fromRadians = from.rotation * Math.PI / 180; const fromCosine = Math.cos(fromRadians); const fromSine = Math.sin(fromRadians);
  const world = { x: from.x + point.x * fromCosine - point.y * fromSine, y: from.y + point.x * fromSine + point.y * fromCosine };
  const toRadians = -to.rotation * Math.PI / 180; const toCosine = Math.cos(toRadians); const toSine = Math.sin(toRadians); const dx = world.x - to.x; const dy = world.y - to.y;
  return { x: dx * toCosine - dy * toSine, y: dx * toSine + dy * toCosine };
}

export function geometryBetweenPlaces(project: EditorProject, geometry: DrawingElement["geometry"], fromId: string, toId: string): DrawingElement["geometry"] {
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

export function geometryInside(geometry: DrawingElement["geometry"], boundary: RegionShape) {
  if (geometry.kind === "region") return assessRegionConstraint(geometry.shape, boundary).state === "inside";
  if (geometry.kind === "path") return assessPathConstraint(geometry.points, boundary).state === "inside";
  if (geometry.kind === "bezier") return assessPathConstraint(geometry.nodes.map(({ anchor }) => anchor), boundary).state === "inside";
  return pointInRegion(geometry.at, boundary);
}
