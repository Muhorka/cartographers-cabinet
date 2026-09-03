import type { KernelPoint } from "./geometry-types";
import type { RegionShape } from "../model/project-model";
import { sampleBezier, translateBezier } from "./bezier-geometry";
import { shapePoints } from "./region-constraints";

export type RegionBounds = { minX: number; minY: number; maxX: number; maxY: number };

export function pointBounds(points: readonly KernelPoint[]): RegionBounds | undefined {
  const first = points[0]; if (!first) return undefined;
  let minX = first.x; let minY = first.y; let maxX = first.x; let maxY = first.y;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    if (point.x < minX) minX = point.x; else if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y; else if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

export function regionBounds(shape: RegionShape): RegionBounds {
  if (shape.kind === "rectangle") return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.width, maxY: shape.y + shape.height };
  if (shape.kind === "circle") return { minX: shape.cx - shape.radius, minY: shape.cy - shape.radius, maxX: shape.cx + shape.radius, maxY: shape.cy + shape.radius };
  if (shape.kind === "ellipse") return { minX: shape.cx - shape.rx, minY: shape.cy - shape.ry, maxX: shape.cx + shape.rx, maxY: shape.cy + shape.ry };
  const points = shape.kind === "bezier" ? sampleBezier(shape.nodes, true) : shapePoints(shape);
  return pointBounds(points)!;
}

export function regionBoundsCenter(shape: RegionShape): KernelPoint {
  const bounds = regionBounds(shape);
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

export function translateRegion(shape: RegionShape, delta: KernelPoint): RegionShape {
  if (shape.kind === "rectangle") return { ...shape, x: shape.x + delta.x, y: shape.y + delta.y };
  if (shape.kind === "circle" || shape.kind === "ellipse") return { ...shape, cx: shape.cx + delta.x, cy: shape.cy + delta.y };
  if (shape.kind === "bezier") return { ...shape, nodes: translateBezier(shape.nodes, delta) };
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })), holes: holes.map((hole) => hole.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }))) })) };
  return { ...shape, points: shape.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })) };
}

/** Copies a region without relying on structuredClone, so Immer draft geometry is supported. */
export function copyRegion(shape: RegionShape): RegionShape {
  return translateRegion(shape, { x: 0, y: 0 });
}

/** Converts a boundary drawn on the containing map into local geometry plus map placement. */
export function localizeRegion(shape: RegionShape) {
  const center = regionBoundsCenter(shape);
  return {
    boundary: translateRegion(shape, { x: -center.x, y: -center.y }),
    transform: { x: center.x, y: center.y, rotation: 0 },
  };
}
