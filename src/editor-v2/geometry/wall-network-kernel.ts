import Coordinate from "jsts/org/locationtech/jts/geom/Coordinate.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import PrecisionModel from "jsts/org/locationtech/jts/geom/PrecisionModel.js";
import MCIndexSnapRounder from "jsts/org/locationtech/jts/noding/snapround/MCIndexSnapRounder.js";
import NodedSegmentString from "jsts/org/locationtech/jts/noding/NodedSegmentString.js";
import Polygonizer from "jsts/org/locationtech/jts/operation/polygonize/Polygonizer.js";
import Envelope from "jsts/org/locationtech/jts/geom/Envelope.js";
import STRtree from "jsts/org/locationtech/jts/index/strtree/STRtree.js";
import ArrayList from "jsts/java/util/ArrayList.js";
import { canonicalRing, GEOMETRY_PRECISION, normalizePoint, pointKey, stableHash, undirectedEdgeKey } from "./geometry-normalization";
import type { CanonicalWall, GeometryDiagnostic, KernelPoint, NodedWallSegment, RoomFace, WallNetworkResult } from "./geometry-types";

type SegmentData = { wallId: string };
type JstsCoordinate = { x: number; y: number };
type JstsSegmentString = { getCoordinates(): JstsCoordinate[]; getData(): SegmentData };
type JstsLineString = { getCoordinates(): JstsCoordinate[] };
type JstsRing = { getCoordinates(): JstsCoordinate[] };
type JstsPolygon = {
  getArea(): number;
  getExteriorRing(): JstsRing;
  getNumInteriorRing(): number;
  getInteriorRingN(index: number): JstsRing;
};
type JstsCollection<T> = { iterator(): { hasNext(): boolean; next(): T } };

function collect<T>(collection: JstsCollection<T>) {
  const values: T[] = []; const iterator = collection.iterator();
  while (iterator.hasNext()) values.push(iterator.next());
  return values;
}

function point(coordinate: JstsCoordinate): KernelPoint {
  return normalizePoint({ x: coordinate.x, y: coordinate.y });
}

function distanceSquared(first: KernelPoint, second: KernelPoint) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function segmentProjection(point: KernelPoint, wall: CanonicalWall) {
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y;
  const lengthSquared = dx * dx + dy * dy;
  const position = lengthSquared ? Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSquared)) : 0;
  const projected = normalizePoint({ x: wall.start.x + dx * position, y: wall.start.y + dy * position });
  return { point: projected, distanceSquared: distanceSquared(point, projected) };
}

// Gaps below this threshold are smaller than a practical visible junction at
// ordinary plan zooms.  Healing them here keeps loaded plans and newly edited
// plans consistent; the larger, user-controlled close-gaps tolerance remains
// part of the drawing gesture instead of the geometry kernel.
const JUNCTION_TOLERANCE = .125;

function searchEnvelope(first: KernelPoint, second = first, padding = JUNCTION_TOLERANCE) {
  return new Envelope(
    Math.min(first.x, second.x) - padding,
    Math.max(first.x, second.x) + padding,
    Math.min(first.y, second.y) - padding,
    Math.max(first.y, second.y) + padding,
  );
}

function snapNearEndpoints(walls: CanonicalWall[]) {
  const endpoints = walls.flatMap((wall, wallIndex) => [
    { wallIndex, wallId: wall.id, endpoint: "start" as const, point: wall.start, role: wall.role },
    { wallIndex, wallId: wall.id, endpoint: "end" as const, point: wall.end, role: wall.role },
  ]);
  const parent = endpoints.map((_, index) => index);
  const members = endpoints.map((_, index) => new Set([index]));
  const root = (index: number): number => parent[index] === index ? index : (parent[index] = root(parent[index]));
  const join = (first: number, second: number) => {
    const a = root(first); const b = root(second);
    if (a === b) return;
    const combinedIsSafe = [...members[a]].every((left) => [...members[b]].every((right) => endpoints[left].wallIndex !== endpoints[right].wallIndex && distanceSquared(endpoints[left].point, endpoints[right].point) <= JUNCTION_TOLERANCE ** 2));
    if (!combinedIsSafe) return;
    parent[b] = a;
    members[b].forEach((index) => members[a].add(index));
  };
  const candidates: Array<{ first: number; second: number; distance: number; key: string }> = [];
  const endpointIndex = new STRtree();
  endpoints.forEach(({ point }, index) => endpointIndex.insert(searchEnvelope(point, point, 0), index));
  for (let first = 0; first < endpoints.length; first += 1) {
    for (const second of collect<number>(endpointIndex.query(searchEnvelope(endpoints[first].point)))) {
      if (second <= first) continue;
      if (endpoints[first].wallIndex === endpoints[second].wallIndex) continue;
      const distance = distanceSquared(endpoints[first].point, endpoints[second].point);
      if (distance <= JUNCTION_TOLERANCE ** 2) candidates.push({ first, second, distance, key: JSON.stringify([[endpoints[first].wallId, endpoints[first].endpoint], [endpoints[second].wallId, endpoints[second].endpoint]].toSorted(([firstId], [secondId]) => firstId.localeCompare(secondId))) });
    }
  }
  candidates.toSorted((first, second) => first.distance - second.distance || first.key.localeCompare(second.key)).forEach(({ first, second }) => join(first, second));
  const groups = new Map<number, number[]>();
  endpoints.forEach((_, index) => { const key = root(index); groups.set(key, [...(groups.get(key) ?? []), index]); });
  const representative = new Map<number, KernelPoint>();
  for (const [key, indexes] of groups) {
    const priority = Math.max(...indexes.map((index) => rolePriority(endpoints[index].role)));
    const anchors = indexes.filter((index) => rolePriority(endpoints[index].role) === priority);
    representative.set(key, normalizePoint({
      x: anchors.reduce((sum, index) => sum + endpoints[index].point.x, 0) / anchors.length,
      y: anchors.reduce((sum, index) => sum + endpoints[index].point.y, 0) / anchors.length,
    }));
  }
  const snapped = walls.map((wall) => ({ ...wall }));
  endpoints.forEach((entry, index) => { snapped[entry.wallIndex][entry.endpoint] = representative.get(root(index))!; });
  const endpointSnapped = snapped.map((wall) => ({ ...wall }));
  const wallSpatialIndex = new STRtree();
  snapped.forEach((wall, index) => wallSpatialIndex.insert(searchEnvelope(wall.start, wall.end), index));
  for (let currentWallIndex = 0; currentWallIndex < snapped.length; currentWallIndex += 1) {
    for (const endpoint of ["start", "end"] as const) {
      const source = snapped[currentWallIndex][endpoint];
      const nearest = collect<number>(wallSpatialIndex.query(searchEnvelope(source, source, 0)))
        .flatMap((candidateIndex) => candidateIndex === currentWallIndex ? [] : [{ ...segmentProjection(source, snapped[candidateIndex]), role: snapped[candidateIndex].role, candidateIndex }])
        .filter((candidate) => candidate.distanceSquared <= JUNCTION_TOLERANCE ** 2)
        .toSorted((first, second) => first.distanceSquared - second.distanceSquared || rolePriority(second.role) - rolePriority(first.role) || first.candidateIndex - second.candidateIndex)[0];
      const otherEndpoint = endpoint === "start" ? "end" : "start";
      if (nearest && distanceSquared(nearest.point, endpointSnapped[currentWallIndex][otherEndpoint]) > 1e-12) endpointSnapped[currentWallIndex][endpoint] = nearest.point;
    }
  }
  return endpointSnapped;
}

function sourcePosition(wall: CanonicalWall, segment: Omit<NodedWallSegment, "id">) {
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
  return ((midpoint.x - wall.start.x) * dx + (midpoint.y - wall.start.y) * dy) / lengthSquared;
}

function allocatedSegmentId(sourceId: string, index: number, reserved: Set<string>, allocated: Set<string>) {
  const stem = `@cc-wall-segment:${stableHash(sourceId)}:${index + 1}`;
  let candidate = stem; let suffix = 1;
  while (reserved.has(candidate) || allocated.has(candidate)) candidate = `${stem}:${++suffix}`;
  allocated.add(candidate);
  return candidate;
}

function nodeWalls(walls: CanonicalWall[]) {
  const snappedWalls = snapNearEndpoints(walls);
  const valid = snappedWalls.filter(({ start, end }) => distanceSquared(start, end) > 1e-12);
  // JSTS accepts an empty constructor at runtime, while its generated type
  // declaration requires one argument. `undefined` preserves the intended
  // empty collection without weakening types in the rest of the adapter.
  const segmentStrings = new ArrayList(undefined);
  for (const wall of valid) segmentStrings.add(new NodedSegmentString([
    new Coordinate(normalizePoint(wall.start).x, normalizePoint(wall.start).y),
    new Coordinate(normalizePoint(wall.end).x, normalizePoint(wall.end).y),
  ], { wallId: wall.id } satisfies SegmentData));
  // Noding and persistence must use the same precision. An independently
  // rounded endpoint can sit a fraction of a micron off an oblique segment;
  // exact-only intersections then incorrectly leave a visually closed T open.
  const noder = new MCIndexSnapRounder(new PrecisionModel(GEOMETRY_PRECISION));
  noder.computeNodes(segmentStrings);
  const bySource = new Map<string, Omit<NodedWallSegment, "id">[]>();
  for (const result of collect(noder.getNodedSubstrings() as JstsCollection<JstsSegmentString>)) {
    const coordinates = result.getCoordinates();
    const segment = { sourceWallId: result.getData().wallId, start: point(coordinates[0]), end: point(coordinates.at(-1)!) };
    if (distanceSquared(segment.start, segment.end) <= 1e-12) continue;
    bySource.set(segment.sourceWallId, [...(bySource.get(segment.sourceWallId) ?? []), segment]);
  }
  const sourceById = new Map(snappedWalls.map((wall) => [wall.id, wall]));
  const reserved = new Set(snappedWalls.map(({ id }) => id)); const allocated = new Set<string>();
  return [...bySource.entries()].flatMap(([sourceWallId, pieces]) => {
    const source = sourceById.get(sourceWallId)!;
    const ordered = pieces.toSorted((first, second) => sourcePosition(source, first) - sourcePosition(source, second));
    if (ordered.length === 1) { allocated.add(sourceWallId); return [{ ...ordered[0], id: sourceWallId }]; }
    return ordered.map((segment, index) => ({ ...segment, id: allocatedSegmentId(sourceWallId, index, reserved, allocated) }));
  });
}

function rolePriority(role: CanonicalWall["role"]) {
  return role === "boundary" ? 3 : role === "wall" ? 2 : 1;
}

function uniqueSegments(segments: NodedWallSegment[]) {
  const byEdge = new Map<string, NodedWallSegment[]>();
  for (const segment of segments) {
    const key = undirectedEdgeKey(segment.start, segment.end);
    byEdge.set(key, [...(byEdge.get(key) ?? []), segment]);
  }
  return [...byEdge.values()].map((matches) => matches[0]);
}

/**
 * Turns calculated intersections into persistent, independently editable wall
 * records. A source wall keeps its id while it is a single segment. Split
 * pieces receive collision-checked ids and carry explicit provenance; no
 * caller has to infer ancestry from punctuation inside an arbitrary id.
 */
export function materializeWallSegments(walls: CanonicalWall[]): CanonicalWall[] {
  const sourceById = new Map(walls.map((wall) => [wall.id, wall]));
  const byEdge = new Map<string, NodedWallSegment[]>();
  for (const segment of nodeWalls(walls)) {
    const key = undirectedEdgeKey(segment.start, segment.end);
    byEdge.set(key, [...(byEdge.get(key) ?? []), segment]);
  }
  return [...byEdge.values()].map((matches) => {
    const segment = matches.toSorted((first, second) => {
      const roleDifference = rolePriority(sourceById.get(second.sourceWallId)!.role) - rolePriority(sourceById.get(first.sourceWallId)!.role);
      if (roleDifference) return roleDifference;
      return walls.findIndex(({ id }) => id === first.sourceWallId) - walls.findIndex(({ id }) => id === second.sourceWallId);
    })[0];
    const source = sourceById.get(segment.sourceWallId)!;
    const sourceWallId = segment.id === source.id ? source.sourceWallId : source.id;
    return { ...source, ...(sourceWallId ? { sourceWallId } : {}), id: segment.id, start: segment.start, end: segment.end };
  });
}

function diagnostic(kind: GeometryDiagnostic["kind"], line: JstsLineString, edgeSources: Map<string, Set<string>>): GeometryDiagnostic {
  const points = line.getCoordinates().map(point);
  const wallIds = new Set<string>();
  points.slice(0, -1).forEach((start, index) => edgeSources.get(undirectedEdgeKey(start, points[index + 1]))?.forEach((id) => wallIds.add(id)));
  return { kind, wallIds: [...wallIds].toSorted(), points };
}

function polygonFace(polygon: JstsPolygon, edgeSources: Map<string, Set<string>>): RoomFace {
  const outer = canonicalRing(polygon.getExteriorRing().getCoordinates().map(point));
  const holes = Array.from({ length: polygon.getNumInteriorRing() }, (_, index) => canonicalRing(polygon.getInteriorRingN(index).getCoordinates().map(point)));
  const wallIds = new Set<string>();
  const allRings = [outer, ...holes];
  for (const ring of allRings) ring.forEach((start, index) => edgeSources.get(undirectedEdgeKey(start, ring[(index + 1) % ring.length]))?.forEach((id) => wallIds.add(id)));
  const signature = `${outer.map(pointKey).join(";")}|${holes.map((ring) => ring.map(pointKey).join(";")).toSorted().join("|")}`;
  return { id: `room-face:${stableHash(signature)}`, outer, holes, area: polygon.getArea(), wallIds: [...wallIds].toSorted() };
}

export function buildWallNetwork(walls: CanonicalWall[]): WallNetworkResult {
  const zeroLength = walls.filter(({ start, end }) => distanceSquared(start, end) <= 1e-12);
  const allSegments = nodeWalls(walls);
  const segments = uniqueSegments(allSegments);
  const edgeSources = new Map<string, Set<string>>();
  for (const segment of allSegments) {
    const key = undirectedEdgeKey(segment.start, segment.end);
    edgeSources.set(key, new Set([...(edgeSources.get(key) ?? []), segment.sourceWallId]));
  }
  const factory = new GeometryFactory(); const polygonizer = new Polygonizer();
  for (const segment of segments) polygonizer.add(factory.createLineString([
    new Coordinate(segment.start.x, segment.start.y), new Coordinate(segment.end.x, segment.end.y),
  ]));
  const faces = collect(polygonizer.getPolygons() as JstsCollection<JstsPolygon>).map((polygon) => polygonFace(polygon, edgeSources)).toSorted((first, second) => first.id.localeCompare(second.id));
  const diagnostics: GeometryDiagnostic[] = [
    ...zeroLength.map((wall) => ({ kind: "zero-length-wall" as const, wallIds: [wall.id], points: [wall.start, wall.end] })),
    ...collect(polygonizer.getDangles() as JstsCollection<JstsLineString>).map((line) => diagnostic("dangling-edge", line, edgeSources)),
    ...collect(polygonizer.getCutEdges() as JstsCollection<JstsLineString>).map((line) => diagnostic("cut-edge", line, edgeSources)),
    ...collect(polygonizer.getInvalidRingLines() as JstsCollection<JstsLineString>).map((line) => diagnostic("invalid-ring", line, edgeSources)),
  ];
  return { segments, faces, diagnostics };
}
