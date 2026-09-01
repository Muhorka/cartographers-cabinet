import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import SnapIfNeededOverlayOp from "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js";
import type { KernelPoint } from "./geometry-types";
import { regionGeoJson } from "./region-constraints";
import type { RegionShape } from "../model/project-model";

type LengthGeometry = { getLength(): number };
type LineJson = { type: "LineString"; coordinates: number[][] };
type MultiLineJson = { type: "MultiLineString"; coordinates: number[][][] };
type GeometryCollectionJson = { type: "GeometryCollection"; geometries: ResultJson[] };
type ResultJson = LineJson | MultiLineJson | GeometryCollectionJson | { type: string; coordinates?: unknown };

const factory = new GeometryFactory();
const reader = new GeoJSONReader(factory);
const writer = new GeoJSONWriter();
const LENGTH_EPSILON = 1e-7;

function lineJson(points: KernelPoint[]): LineJson {
  return { type: "LineString", coordinates: points.map(({ x, y }) => [x, y]) };
}

function pathsFromResult(result: ResultJson): KernelPoint[][] {
  if (result.type === "LineString") {
    return [(result as LineJson).coordinates.map(([x, y]) => ({ x, y }))];
  }
  if (result.type === "MultiLineString") {
    return (result as MultiLineJson).coordinates.map((line) => line.map(([x, y]) => ({ x, y })));
  }
  if (result.type === "GeometryCollection") {
    return (result as GeometryCollectionJson).geometries.flatMap(pathsFromResult);
  }
  return [];
}

export function assessPathConstraint(points: KernelPoint[], boundary?: RegionShape) {
  if (points.length < 2) return { state: "outside" as const };
  if (!boundary) return { state: "inside" as const, paths: [points] };
  const candidate = reader.read(lineJson(points)) as LengthGeometry;
  const enclosure = reader.read(regionGeoJson(boundary)) as LengthGeometry;
  const intersection = SnapIfNeededOverlayOp.intersection(candidate, enclosure) as LengthGeometry;
  if (intersection.getLength() <= LENGTH_EPSILON) return { state: "outside" as const };
  if (Math.abs(intersection.getLength() - candidate.getLength()) <= LENGTH_EPSILON) {
    return { state: "inside" as const, paths: [points] };
  }
  const paths = pathsFromResult(writer.write(intersection) as ResultJson).filter((path) => path.length >= 2);
  return paths.length ? { state: "clip-available" as const, paths } : { state: "outside" as const };
}
