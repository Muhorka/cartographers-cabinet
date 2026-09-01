import type { RegionShape } from "../../model/project-model";
import type { KernelPoint } from "../../geometry/geometry-types";
import { pointInRegion, shapePolygons } from "../../geometry/region-constraints";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import BufferOp from "jsts/org/locationtech/jts/operation/buffer/BufferOp.js";
import SnapIfNeededOverlayOp from "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js";
import { regionGeoJson } from "../../geometry/region-constraints";

const EPS = 1e-7;
const factory = new GeometryFactory(); const reader = new GeoJSONReader(factory);

function lineGeometry(a: KernelPoint, b: KernelPoint) { return reader.read({ type: "LineString", coordinates: [[a.x, a.y], [b.x, b.y]] }); }

export function distance(a: KernelPoint, b: KernelPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** A segment is valid only when its interior stays in the face. */
function segmentInRegion(a: KernelPoint, b: KernelPoint, shape: RegionShape, clearance = 0) {
  const length = distance(a, b);
  if (!length) return pointInRegion(a, shape);
  const region = reader.read(regionGeoJson(shape));
  const line = lineGeometry(a, b) as unknown as { getLength(): number };
  const clipped = SnapIfNeededOverlayOp.intersection(region, line) as unknown as { getLength(): number; getArea(): number; isEmpty(): boolean };
  if (clipped.isEmpty() || clipped.getLength() + EPS < line.getLength()) return false;
  if (clearance > EPS) {
    const buffered = BufferOp.bufferOp(line, clearance, 8) as { getArea(): number };
    const inside = (SnapIfNeededOverlayOp.intersection(region, buffered) as unknown as { getArea(): number }).getArea();
    if (inside + Math.max(EPS, buffered.getArea() * 1e-5) < buffered.getArea()) return false;
  }
  return true;
}

function centroid(ring: readonly KernelPoint[]) {
  const sum = ring.reduce((result, point) => ({ x: result.x + point.x, y: result.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / ring.length, y: sum.y / ring.length };
}

/** Stable point inside a place/zone boundary for a newly selected route endpoint. */
export function insidePoint(shape?: RegionShape): KernelPoint {
  if (!shape) return { x: 0, y: 0 };
  const polygons = shapePolygons(shape);
  const candidates: KernelPoint[] = [];
  if (shape.kind === "rectangle") candidates.push({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 });
  else if (shape.kind === "circle") candidates.push({ x: shape.cx, y: shape.cy });
  else if (shape.kind === "ellipse") candidates.push({ x: shape.cx, y: shape.cy });
  for (const polygon of polygons) {
    const centre = centroid(polygon.outer); candidates.push(centre);
    const first = polygon.outer[0]; if (first) candidates.push({ x: (first.x + centre.x) / 2, y: (first.y + centre.y) / 2 });
    const bounds = polygon.outer.reduce((result, point) => ({ minX: Math.min(result.minX, point.x), minY: Math.min(result.minY, point.y), maxX: Math.max(result.maxX, point.x), maxY: Math.max(result.maxY, point.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    candidates.push({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });
    for (let row = 1; row < 10; row += 1) for (let column = 1; column < 10; column += 1) candidates.push({ x: bounds.minX + (bounds.maxX - bounds.minX) * column / 10, y: bounds.minY + (bounds.maxY - bounds.minY) * row / 10 });
  }
  return candidates.find((point) => pointInRegion(point, shape)) ?? polygons[0]?.outer[0] ?? { x: 0, y: 0 };
}

/** Candidate waypoints are nudged off boundaries, which keeps holes real obstacles. */
function boundaryWaypoints(shape: RegionShape, margin: number) {
  const result: KernelPoint[] = [];
  for (const polygon of shapePolygons(shape)) {
    for (const [ring, outward] of [[polygon.outer, false], ...polygon.holes.map((hole) => [hole, true] as const)] as const) {
      const centre = centroid(ring);
      ring.forEach((vertex) => {
        const dx = vertex.x - centre.x; const dy = vertex.y - centre.y; const length = Math.hypot(dx, dy) || 1;
        const sign = outward ? 1 : -1;
        result.push({ x: vertex.x + sign * dx / length * margin, y: vertex.y + sign * dy / length * margin });
      });
    }
  }
  return result.filter((point) => pointInRegion(point, shape));
}

type PathCandidate = { point: KernelPoint; id: string };

/** Deterministic visibility graph for one concave face (including holes). */
export function shortestPath(shape: RegionShape, from: KernelPoint, to: KernelPoint, margin = 0) {
  if (!pointInRegion(from, shape) || !pointInRegion(to, shape)) return undefined;
  const candidates: PathCandidate[] = [
    { id: "from", point: from },
    { id: "to", point: to },
    ...boundaryWaypoints(shape, Math.max(.001, margin * 1.5 + .02)).map((point, index) => ({ id: `v${index}`, point })),
  ];
  const distances = candidates.map(() => Number.POSITIVE_INFINITY); const previous = candidates.map(() => -1); distances[0] = 0;
  const visited = new Set<number>();
  while (visited.size < candidates.length) {
    let current = -1;
    candidates.forEach((_candidate, index) => { if (!visited.has(index) && (current < 0 || distances[index]! < distances[current]! - EPS || (Math.abs(distances[index]! - distances[current]!) <= EPS && index < current))) current = index; });
    if (current < 0 || !Number.isFinite(distances[current])) break;
    visited.add(current);
    if (current === 1) break;
    candidates.forEach((_candidate, next) => {
      if (visited.has(next) || next === current || !segmentInRegion(candidates[current]!.point, candidates[next]!.point, shape, margin)) return;
      const nextDistance = distances[current]! + distance(candidates[current]!.point, candidates[next]!.point);
      if (nextDistance < distances[next]! - EPS) { distances[next] = nextDistance; previous[next] = current; }
    });
  }
  if (!Number.isFinite(distances[1])) return undefined;
  const path: KernelPoint[] = []; for (let index = 1; index >= 0; index = previous[index]) { path.unshift(candidates[index]!.point); if (index === 0) break; }
  return { points: path, distance: distances[1]! };
}

export function polylineDistance(points: readonly KernelPoint[]) {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index]!, point), 0);
}
