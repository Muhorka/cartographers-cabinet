import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import SnapIfNeededOverlayOp from "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js";
import BufferOp from "jsts/org/locationtech/jts/operation/buffer/BufferOp.js";
import IsValidOp from "jsts/org/locationtech/jts/operation/valid/IsValidOp.js";
import type { RegionPolygon, RegionShape } from "../model/project-model";
import type { KernelPoint } from "./geometry-types";
import { sampleBezier } from "./bezier-geometry";

type AreaGeometry = { getArea(): number; isEmpty(): boolean };
export type PolygonJson = { type: "Polygon"; coordinates: number[][][] };
type MultiPolygonJson = { type: "MultiPolygon"; coordinates: number[][][][] };
type ResultJson = PolygonJson | MultiPolygonJson | { type: string; coordinates?: unknown };

const factory = new GeometryFactory(); const reader = new GeoJSONReader(factory); const writer = new GeoJSONWriter();
const AREA_EPSILON = 1e-7;

export function shapePoints(shape: RegionShape): KernelPoint[] {
  if (shape.kind === "compound") return shape.polygons.flatMap(({ outer }) => outer);
  if (shape.kind === "polygon") return shape.points;
  if (shape.kind === "bezier") return sampleBezier(shape.nodes, true);
  if (shape.kind === "rectangle") return [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }, { x: shape.x, y: shape.y + shape.height }];
  const count = 48;
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return shape.kind === "circle" ? { x: shape.cx + Math.cos(angle) * shape.radius, y: shape.cy + Math.sin(angle) * shape.radius }
      : { x: shape.cx + Math.cos(angle) * shape.rx, y: shape.cy + Math.sin(angle) * shape.ry };
  });
}

function pointInRing(point: KernelPoint, ring: readonly KernelPoint[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index]; const b = ring[previous];
    const onEdge = Math.abs((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) < 1e-7
      && point.x >= Math.min(a.x, b.x) - 1e-7 && point.x <= Math.max(a.x, b.x) + 1e-7
      && point.y >= Math.min(a.y, b.y) - 1e-7 && point.y <= Math.max(a.y, b.y) + 1e-7;
    if (onEdge) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function shapePolygons(shape: RegionShape): RegionPolygon[] {
  return shape.kind === "compound" ? shape.polygons : [{ outer: shapePoints(shape), holes: [] }];
}

export function pointInRegion(point: KernelPoint, shape: RegionShape) {
  return shapePolygons(shape).some(({ outer, holes }) => pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole)));
}

function closedCoordinates(points: readonly KernelPoint[]) {
  const closed = [...points, points[0]]; return closed.map(({ x, y }) => [x, y]);
}

export function regionGeoJson(shape: RegionShape): PolygonJson | MultiPolygonJson {
  const polygons = shapePolygons(shape); const coordinates = polygons.map(({ outer, holes }) => [closedCoordinates(outer), ...holes.map(closedCoordinates)]);
  return coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
}

function validAreaGeometry(shape: RegionShape) {
  const geometry = reader.read(regionGeoJson(shape)) as AreaGeometry;
  return IsValidOp.isValid(geometry) ? geometry : BufferOp.bufferOp(geometry, 0) as AreaGeometry;
}

/** Raw validity check for callers that must reject, rather than repair, input geometry. */
export function isValidRegionShape(shape: RegionShape) {
  try {
    const geometry = reader.read(regionGeoJson(shape)) as AreaGeometry;
    return !geometry.isEmpty() && IsValidOp.isValid(geometry) && geometry.getArea() > AREA_EPSILON;
  } catch {
    return false;
  }
}

export function repairRegionShape(shape: RegionShape) {
  return regionShapesFromGeoJson(writer.write(validAreaGeometry(shape)) as ResultJson)[0];
}

export function regionShapesFromGeoJson(result: ResultJson): RegionShape[] {
  const polygons = result.type === "Polygon" ? [(result as PolygonJson).coordinates] : result.type === "MultiPolygon" ? (result as MultiPolygonJson).coordinates : [];
  const parsed = polygons.map((coordinates) => ({ outer: coordinates[0].slice(0, -1).map(([x, y]) => ({ x, y })), holes: coordinates.slice(1).map((ring) => ring.slice(0, -1).map(([x, y]) => ({ x, y }))) })).filter(({ outer }) => outer.length >= 3);
  if (!parsed.length) return [];
  if (parsed.length === 1 && !parsed[0].holes.length) return [{ kind: "polygon", points: parsed[0].outer }];
  return [{ kind: "compound", polygons: parsed }];
}

export function assessRegionConstraint(candidate: RegionShape, boundary?: RegionShape) {
  if (!boundary) return { state: "inside" as const, shape: candidate };
  const candidateGeometry = validAreaGeometry(candidate); const boundaryGeometry = validAreaGeometry(boundary);
  if (candidateGeometry.isEmpty() || boundaryGeometry.isEmpty()) return { state: "outside" as const };
  const intersection = SnapIfNeededOverlayOp.intersection(candidateGeometry, boundaryGeometry) as AreaGeometry;
  if (intersection.getArea() <= AREA_EPSILON) return { state: "outside" as const };
  if (Math.abs(intersection.getArea() - candidateGeometry.getArea()) <= AREA_EPSILON) return { state: "inside" as const, shape: candidate };
  const clipped = regionShapesFromGeoJson(writer.write(intersection) as ResultJson);
  return clipped.length ? { state: "clip-available" as const, shapes: clipped } : { state: "outside" as const };
}

export function unionRegionShapes(shapes: readonly RegionShape[]) {
  if (!shapes.length) return undefined;
  let combined = validAreaGeometry(shapes[0]);
  for (const shape of shapes.slice(1)) combined = SnapIfNeededOverlayOp.union(combined, validAreaGeometry(shape));
  return regionShapesFromGeoJson(writer.write(combined) as ResultJson)[0];
}

export function regionArea(shape: RegionShape) {
  return validAreaGeometry(shape).getArea();
}

export function subtractRegionShape(shape: RegionShape, cut: RegionShape) {
  const difference = SnapIfNeededOverlayOp.difference(validAreaGeometry(shape), validAreaGeometry(cut));
  return regionShapesFromGeoJson(writer.write(difference) as ResultJson)[0];
}
