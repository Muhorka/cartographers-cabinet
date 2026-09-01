import { ribbonPoints, type RibbonWidthStation } from "../geometry/ribbon-geometry";
import { sampleBezier } from "../geometry/bezier-geometry";
import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import type { DrawingElement, EditorProject, RoadJunction } from "../model/project-model";
import { CONSTRUCTION_SNAP_TOLERANCE } from "../drawing/construction-snapping";
import { commitRoadEdit } from "./road-editing";
import { isFlowingWater } from "../geometry/ribbon-geometry";

type RoadGeometry = Extract<DrawingElement["geometry"], { kind: "path" | "bezier" }>;
type RoadIdentity = { createId(): string };
type Endpoint = "start" | "end";
export type RoadJoinResult =
  | { state: "joined"; project: EditorProject; survivorId: string; removedId: string }
  | { state: "junctions-created"; project: EditorProject; junctions: RoadJunction[] }
  | { state: "blocked"; project: EditorProject; reason: "not-found" | "locked" | "different-owner" | "too-far" | "unsupported" | "already-joined" | "routing" };
export type RoadJoinBlockedReason = Extract<RoadJoinResult, { state: "blocked" }>["reason"];
export type RoadJoinNoticeKey = "locked-outline" | `road-${Exclude<RoadJoinBlockedReason, "locked">}`;

export function roadJoinNoticeKey(reason: RoadJoinBlockedReason): RoadJoinNoticeKey {
  return reason === "locked" ? "locked-outline" : `road-${reason}`;
}

const distance = (first: KernelPoint, second: KernelPoint) => Math.hypot(first.x - second.x, first.y - second.y);
const add = (first: KernelPoint, second: KernelPoint) => ({ x: first.x + second.x, y: first.y + second.y });
const subtract = (first: KernelPoint, second: KernelPoint) => ({ x: first.x - second.x, y: first.y - second.y });
const scale = (point: KernelPoint, factor: number) => ({ x: point.x * factor, y: point.y * factor });
const cross = (first: KernelPoint, second: KernelPoint) => first.x * second.y - first.y * second.x;

function projection(point: KernelPoint, start: KernelPoint, end: KernelPoint) {
  const direction = subtract(end, start); const lengthSquared = direction.x * direction.x + direction.y * direction.y;
  const ratio = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * direction.x + (point.y - start.y) * direction.y) / lengthSquared)) : 0;
  const projected = add(start, scale(direction, ratio)); return { point: projected, ratio, distance: distance(point, projected) };
}

function endpoint(geometry: RoadGeometry, side: Endpoint) {
  if (geometry.kind === "path") return geometry.points[side === "start" ? 0 : geometry.points.length - 1];
  return geometry.nodes[side === "start" ? 0 : geometry.nodes.length - 1]?.anchor;
}

function reverseNodes(nodes: BezierNode[]) {
  return [...nodes].reverse().map(({ anchor, inHandle, outHandle }) => ({ anchor: { ...anchor }, ...(outHandle ? { inHandle: { ...outHandle } } : {}), ...(inHandle ? { outHandle: { ...inHandle } } : {}) }));
}

function reverseGeometry(geometry: RoadGeometry): RoadGeometry {
  return geometry.kind === "path" ? { ...geometry, points: [...geometry.points].reverse() } : { ...geometry, nodes: reverseNodes(geometry.nodes) };
}

function orientGeometry(geometry: RoadGeometry, endpointAtEnd: Endpoint): RoadGeometry {
  return endpointAtEnd === "end" ? geometry : reverseGeometry(geometry);
}

function orientRoad(road: DrawingElement, reversed: boolean, geometry: RoadGeometry): DrawingElement {
  if (!reversed || !road.widthProfile) return { ...road, geometry };
  return { ...road, geometry, widthProfile: road.widthProfile.map(({ t, left, right }) => ({ t: 1 - t, left: right, right: left })).toSorted((a, b) => a.t - b.t) };
}

function geometryNodes(geometry: RoadGeometry): BezierNode[] {
  return geometry.kind === "bezier" ? geometry.nodes.map(({ anchor, inHandle, outHandle }) => ({ anchor: { ...anchor }, ...(inHandle ? { inHandle: { ...inHandle } } : {}), ...(outHandle ? { outHandle: { ...outHandle } } : {}) })) : geometry.points.map((anchor) => ({ anchor: { ...anchor } }));
}

function geometryLength(geometry: RoadGeometry) {
  const points = geometry.kind === "path" ? geometry.points : sampleBezier(geometry.nodes, false);
  return points.slice(1).reduce((total, point, index) => total + distance(points[index]!, point), 0);
}

function profileAtRoad(road: DrawingElement, offset: number, length: number, total: number, seam: number): RibbonWidthStation[] {
  const half = Math.max(.05, (road.widthMeters ?? 4) / 2); const source = road.widthProfile ?? []; const byPosition = new Map<number, RibbonWidthStation>([[0, { t: 0, left: half, right: half }], [1, { t: 1, left: half, right: half }]]);
  source.forEach(({ t, left, right }) => byPosition.set(t, { t, left, right }));
  const stations = [...byPosition.values()].toSorted((first, second) => first.t - second.t);
  return stations.map(({ t, left, right }) => ({ t: (offset + t * length + (offset === 0 && t === 1 ? -seam : offset > 0 && t === 0 ? seam : 0)) / total, left, right }));
}

function mergedProfile(first: DrawingElement, second: DrawingElement, firstLength: number, secondLength: number): RibbonWidthStation[] | undefined {
  if (!first.widthProfile && !second.widthProfile && first.widthMeters === second.widthMeters) return undefined;
  const total = Math.max(firstLength + secondLength, 1e-9); const seam = Math.min(total * .01, Math.min(firstLength, secondLength) * .1); const stations = [...profileAtRoad(first, 0, firstLength, total, seam), ...profileAtRoad(second, firstLength, secondLength, total, seam)];
  const merged: RibbonWidthStation[] = [];
  stations.toSorted((a, b) => a.t - b.t).forEach((station) => {
    const previous = merged.at(-1);
    if (!previous || Math.abs(previous.t - station.t) > 1e-7) merged.push(station);
    else { previous.left = (previous.left + station.left) / 2; previous.right = (previous.right + station.right) / 2; }
  });
  return merged;
}

function roadCenterline(road: DrawingElement): KernelPoint[] {
  return ribbonPoints({ geometry: road.geometry, widthMeters: road.widthMeters, widthProfile: road.widthProfile, ribbonCutouts: undefined });
}

function interiorIntersections(first: DrawingElement, second: DrawingElement) {
  const firstPoints = roadCenterline(first); const secondPoints = roadCenterline(second); const intersections: KernelPoint[] = [];
  for (let firstIndex = 1; firstIndex < firstPoints.length; firstIndex += 1) {
    const start = firstPoints[firstIndex - 1]!; const direction = subtract(firstPoints[firstIndex]!, start);
    for (let secondIndex = 1; secondIndex < secondPoints.length; secondIndex += 1) {
      const otherStart = secondPoints[secondIndex - 1]!; const otherDirection = subtract(secondPoints[secondIndex]!, otherStart); const denominator = cross(direction, otherDirection);
      if (Math.abs(denominator) <= 1e-9) continue;
      const delta = subtract(otherStart, start); const firstRatio = cross(delta, otherDirection) / denominator; const secondRatio = cross(delta, direction) / denominator;
      if (firstRatio < -1e-6 || firstRatio > 1 + 1e-6 || secondRatio < -1e-6 || secondRatio > 1 + 1e-6) continue;
      const firstOuterEndpoint = (firstIndex === 1 && firstRatio <= 1e-6) || (firstIndex === firstPoints.length - 1 && firstRatio >= 1 - 1e-6);
      const secondOuterEndpoint = (secondIndex === 1 && secondRatio <= 1e-6) || (secondIndex === secondPoints.length - 1 && secondRatio >= 1 - 1e-6);
      // A T-junction is valid when exactly one road ends on the other road's
      // body. Only a shared endpoint is excluded (the endpoint-join path has
      // already handled it, and should remain the single merged road case).
      if (firstOuterEndpoint && secondOuterEndpoint) continue;
      const clampedFirstRatio = Math.max(0, Math.min(1, firstRatio));
      const point = add(start, scale(direction, clampedFirstRatio)); if (!intersections.some((candidate) => distance(candidate, point) <= 1e-5)) intersections.push(point);
    }
  }
  // A road endpoint can be a junction even when the authored points miss the
  // other axis by a small amount. Snap the junction marker to the closest
  // interior segment, using the same construction tolerance as the editor.
  const addEndpointProjections = (endpoints: KernelPoint[], body: KernelPoint[]) => endpoints.forEach((endpointPoint) => { for (let bodyIndex = 1; bodyIndex < body.length; bodyIndex += 1) {
    const bodyStart = body[bodyIndex - 1]!; const bodyEnd = body[bodyIndex]!; const candidate = projection(endpointPoint, bodyStart, bodyEnd);
    const outerEndpoint = (bodyIndex === 1 && candidate.ratio <= 1e-6) || (bodyIndex === body.length - 1 && candidate.ratio >= 1 - 1e-6);
    if (candidate.distance <= CONSTRUCTION_SNAP_TOLERANCE && !outerEndpoint && !intersections.some((existing) => distance(existing, candidate.point) <= 1e-5)) intersections.push(candidate.point);
  } });
  addEndpointProjections([firstPoints[0]!, firstPoints.at(-1)!], secondPoints);
  addEndpointProjections([secondPoints[0]!, secondPoints.at(-1)!], firstPoints);
  return intersections;
}

function updateJunctionReferences(project: EditorProject, survivorId: string, removedId: string) {
  return (project.roadJunctions ?? []).flatMap((junction) => {
    const roadIds = [...new Set(junction.roadIds.map((id) => id === removedId ? survivorId : id))];
    return roadIds.length >= 2 ? [{ ...junction, roadIds }] : [];
  });
}

/** Recomputes persisted junction points after road edits and drops orphaned crossings. */
export function reconcileRoadJunctions(project: EditorProject): EditorProject {
  const junctions = project.roadJunctions ?? []; if (!junctions.length) return project;
  const roads = new Map(project.elements.filter((element) => element.layerId === "roads").map((road) => [road.id, road]));
  const intersectionsByPair = new Map<string, KernelPoint[]>(); const usedByPair = new Map<string, Set<number>>();
  const updated = junctions.flatMap((junction) => {
    if (junction.roadIds.length !== 2) return [];
    const [firstId, secondId] = junction.roadIds; const first = roads.get(firstId); const second = roads.get(secondId);
    if (!first || !second || first.belongsToId !== second.belongsToId) return [];
    const key = [firstId, secondId].toSorted().join("\u0000"); const intersections = intersectionsByPair.get(key) ?? interiorIntersections(first, second); intersectionsByPair.set(key, intersections);
    const used = usedByPair.get(key) ?? new Set<number>(); let candidateIndex = -1; let candidateDistance = Number.POSITIVE_INFINITY;
    intersections.forEach((point, index) => { if (!used.has(index) && distance(point, junction.point) < candidateDistance) { candidateIndex = index; candidateDistance = distance(point, junction.point); } });
    if (candidateIndex < 0) return []; used.add(candidateIndex); usedByPair.set(key, used); return [{ ...junction, point: intersections[candidateIndex]! }];
  });
  return updated.length === junctions.length && updated.every((junction, index) => junction.point.x === junctions[index]!.point.x && junction.point.y === junctions[index]!.point.y) ? project : { ...project, roadJunctions: updated };
}

function endpointPair(first: RoadGeometry, second: RoadGeometry) {
  const candidates: { first: Endpoint; second: Endpoint; distance: number }[] = [];
  for (const firstSide of ["start", "end"] as const) for (const secondSide of ["start", "end"] as const) {
    const firstPoint = endpoint(first, firstSide); const secondPoint = endpoint(second, secondSide); if (firstPoint && secondPoint) candidates.push({ first: firstSide, second: secondSide, distance: distance(firstPoint, secondPoint) });
  }
  return candidates.toSorted((a, b) => a.distance - b.distance)[0];
}

/** Pure endpoint merge shared by roads and flowing-water ribbons. */
function mergeOpenRibbons(first: DrawingElement, second: DrawingElement, pair: { first: Endpoint; second: Endpoint }) {
  const firstGeometry = orientGeometry(first.geometry as RoadGeometry, pair.first); const secondGeometry = pair.second === "start" ? second.geometry as RoadGeometry : reverseGeometry(second.geometry as RoadGeometry);
  const firstRibbon = orientRoad(first, pair.first === "start", firstGeometry); const secondRibbon = orientRoad(second, pair.second === "end", secondGeometry);
  const firstNodes = geometryNodes(firstGeometry); const secondNodes = geometryNodes(secondGeometry); const joinPoint = firstNodes.at(-1)!.anchor; const secondStart = secondNodes[0]!; const moved = subtract(joinPoint, secondStart.anchor);
  secondNodes[0] = { ...secondStart, anchor: joinPoint, ...(secondStart.inHandle ? { inHandle: add(secondStart.inHandle, moved) } : {}), ...(secondStart.outHandle ? { outHandle: add(secondStart.outHandle, moved) } : {}) };
  const firstLast = firstNodes.at(-1)!; const secondFirst = secondNodes[0]!; const joinNode: BezierNode = { anchor: joinPoint, ...(firstLast.inHandle ? { inHandle: firstLast.inHandle } : {}), ...(secondFirst.outHandle ? { outHandle: secondFirst.outHandle } : {}) };
  const geometry: RoadGeometry = first.geometry.kind === "path" && second.geometry.kind === "path" ? { kind: "path", points: [...firstGeometry.kind === "path" ? firstGeometry.points : firstNodes.map(({ anchor }) => anchor), ...secondGeometry.kind === "path" ? secondGeometry.points.slice(1) : secondNodes.slice(1).map(({ anchor }) => anchor)], closed: false } : { kind: "bezier", nodes: [...firstNodes.slice(0, -1), joinNode, ...secondNodes.slice(1)], closed: false };
  const firstLength = geometryLength(firstGeometry); const secondLength = geometryLength(secondGeometry);
  return { ...firstRibbon, geometry, widthProfile: mergedProfile(firstRibbon, secondRibbon, firstLength, secondLength), ribbonCutouts: [...(first.ribbonCutouts ?? []), ...(second.ribbonCutouts ?? [])], tags: [...new Set([...first.tags, ...second.tags])], access: [...new Set([...first.access, ...second.access])] };
}

/** Joins two roads at close endpoints, or records their interior crossings as editable junctions. */
export function joinRoads(project: EditorProject, roadIds: readonly string[], identity: RoadIdentity, tolerance = CONSTRUCTION_SNAP_TOLERANCE): RoadJoinResult {
  if (roadIds.length !== 2 || roadIds[0] === roadIds[1]) return { state: "blocked", project, reason: "unsupported" };
  const roads = roadIds.map((id) => project.elements.find((element) => element.id === id));
  if (!roads[0] || !roads[1]) return { state: "blocked", project, reason: "not-found" };
  const [first, second] = roads;
  if (first.layerId !== "roads" || second.layerId !== "roads" || first.belongsToId !== second.belongsToId) return { state: "blocked", project, reason: first.belongsToId === second.belongsToId ? "unsupported" : "different-owner" };
  if (first.locked || second.locked) return { state: "blocked", project, reason: "locked" };
  if ((first.geometry.kind !== "path" && first.geometry.kind !== "bezier") || (second.geometry.kind !== "path" && second.geometry.kind !== "bezier") || (first.geometry.closed || second.geometry.closed)) return { state: "blocked", project, reason: "unsupported" };
  const pair = endpointPair(first.geometry, second.geometry);
  if (pair && pair.distance <= tolerance) {
    const nextRoad = mergeOpenRibbons(first, second, pair);
    const committed = commitRoadEdit({ ...project, elements: project.elements.filter((element) => element.id !== second.id) }, nextRoad);
    if (!committed) return { state: "blocked", project, reason: "routing" };
    return { state: "joined", project: { ...committed, roadJunctions: updateJunctionReferences(committed, first.id, second.id) }, survivorId: first.id, removedId: second.id };
  }
  const points = interiorIntersections(first, second); if (!points.length) return { state: "blocked", project, reason: pair ? "too-far" : "unsupported" };
  const existing = project.roadJunctions ?? []; const fresh = points.filter((point) => !existing.some((junction) => junction.roadIds.includes(first.id) && junction.roadIds.includes(second.id) && distance(junction.point, point) <= 1e-5)).map((point) => ({ id: identity.createId(), belongsToId: first.belongsToId, point, roadIds: [first.id, second.id] }));
  if (!fresh.length) return { state: "blocked", project, reason: "already-joined" };
  return { state: "junctions-created", project: { ...project, roadJunctions: [...existing, ...fresh] }, junctions: fresh };
}

/** Joins two flowing-water ribbons at a nearby endpoint. Crossings remain
 * separate because water does not use the road junction/obstacle model. */
export function joinFlowingWater(project: EditorProject, ribbonIds: readonly string[], tolerance = CONSTRUCTION_SNAP_TOLERANCE): RoadJoinResult {
  if (ribbonIds.length !== 2 || ribbonIds[0] === ribbonIds[1]) return { state: "blocked", project, reason: "unsupported" };
  const ribbons = ribbonIds.map((id) => project.elements.find((element) => element.id === id)); const first = ribbons[0]; const second = ribbons[1];
  if (!first || !second) return { state: "blocked", project, reason: "not-found" };
  if (!isFlowingWater(first) || !isFlowingWater(second) || first.belongsToId !== second.belongsToId) return { state: "blocked", project, reason: first.belongsToId === second.belongsToId ? "unsupported" : "different-owner" };
  if (first.locked || second.locked) return { state: "blocked", project, reason: "locked" };
  if ((first.geometry.kind !== "path" && first.geometry.kind !== "bezier") || (second.geometry.kind !== "path" && second.geometry.kind !== "bezier") || first.geometry.closed || second.geometry.closed) return { state: "blocked", project, reason: "unsupported" };
  const pair = endpointPair(first.geometry as RoadGeometry, second.geometry as RoadGeometry);
  if (!pair || pair.distance > tolerance) return { state: "blocked", project, reason: pair ? "too-far" : "unsupported" };
  const merged = mergeOpenRibbons(first, second, pair);
  return { state: "joined", project: { ...project, elements: project.elements.filter(({ id }) => id !== second.id).map((element) => element.id === first.id ? merged : element) }, survivorId: first.id, removedId: second.id };
}
