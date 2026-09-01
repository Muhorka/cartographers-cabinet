import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import BufferOp from "jsts/org/locationtech/jts/operation/buffer/BufferOp.js";
import SnapIfNeededOverlayOp from "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js";
import type { RegionShape } from "../model/project-model";
import type { KernelPoint } from "./geometry-types";
import { regionGeoJson, regionShapesFromGeoJson } from "./region-constraints";

type LineJson = { type: "LineString"; coordinates: number[][] };
type MultiLineJson = { type: "MultiLineString"; coordinates: number[][][] };
type ResultJson = LineJson | MultiLineJson | { type: string; coordinates?: unknown };

const factory = new GeometryFactory();
const reader = new GeoJSONReader(factory);
const writer = new GeoJSONWriter();
const EPSILON = 1e-7;

function lineJson(points: readonly KernelPoint[]): LineJson {
  const usable = points.length === 1 ? [points[0], { x: points[0].x + EPSILON, y: points[0].y }] : points;
  return { type: "LineString", coordinates: usable.map(({ x, y }) => [x, y]) };
}

function eraserGeometry(stroke: readonly KernelPoint[], radius: number) {
  return BufferOp.bufferOp(reader.read(lineJson(stroke)), radius, 8);
}

/** Returns the same JSTS buffer used by both region and path erasing as
 * ordinary project geometry, so callers can persist the exact UI mask. */
export function eraserRegionShapes(stroke: readonly KernelPoint[], radius: number): RegionShape[] {
  if (!stroke.length || radius <= 0) return [];
  return regionShapesFromGeoJson(writer.write(eraserGeometry(stroke, radius)) as ResultJson);
}

export function subtractEraserFromRegion(shape: RegionShape, stroke: readonly KernelPoint[], radius: number): RegionShape[] {
  if (!stroke.length || radius <= 0) return [shape];
  const difference = SnapIfNeededOverlayOp.difference(reader.read(regionGeoJson(shape)), eraserGeometry(stroke, radius));
  const result = writer.write(difference) as ResultJson;
  return regionShapesFromGeoJson(result);
}

export function subtractEraserFromPath(points: readonly KernelPoint[], stroke: readonly KernelPoint[], radius: number): KernelPoint[][] {
  if (points.length < 2 || !stroke.length || radius <= 0) return points.length >= 2 ? [[...points]] : [];
  const difference = SnapIfNeededOverlayOp.difference(reader.read(lineJson(points)), eraserGeometry(stroke, radius));
  const result = writer.write(difference) as ResultJson;
  const lines = result.type === "LineString" ? [(result as LineJson).coordinates] : result.type === "MultiLineString" ? (result as MultiLineJson).coordinates : [];
  return lines.map((coordinates) => coordinates.map(([x, y]) => ({ x, y }))).filter((line) => line.length >= 2);
}
