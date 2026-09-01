import type { KernelPoint } from "./geometry-types";
import type { RegionShape } from "../model/project-model";

export type RegionVertex = { polygonIndex: number; vertexIndex: number; point: KernelPoint };

export function regionVertices(shape: RegionShape): RegionVertex[] {
  if (shape.kind === "polygon") return shape.points.map((point, vertexIndex) => ({ polygonIndex: 0, vertexIndex, point }));
  if (shape.kind === "compound") return shape.polygons.flatMap(({ outer }, polygonIndex) => outer.map((point, vertexIndex) => ({ polygonIndex, vertexIndex, point })));
  return [];
}

export function moveRegionVertex(shape: RegionShape, polygonIndex: number, vertexIndex: number, point: KernelPoint): RegionShape | undefined {
  if (shape.kind === "polygon") {
    if (polygonIndex !== 0 || !shape.points[vertexIndex] || shape.points.length < 3) return undefined;
    return { ...shape, points: shape.points.map((candidate, index) => index === vertexIndex ? point : candidate) };
  }
  if (shape.kind !== "compound" || !shape.polygons[polygonIndex]?.outer[vertexIndex]) return undefined;
  return { ...shape, polygons: shape.polygons.map((polygon, index) => index === polygonIndex ? { ...polygon, outer: polygon.outer.map((candidate, candidateIndex) => candidateIndex === vertexIndex ? point : candidate) } : polygon) };
}
