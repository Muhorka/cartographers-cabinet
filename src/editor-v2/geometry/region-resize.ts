import { scaleBezier } from "./bezier-geometry";
import { regionBounds } from "./region-transform";
import type { KernelPoint } from "./geometry-types";
import type { RegionShape } from "../model/project-model";

export type ResizeCorner = "north-west" | "north-east" | "south-east" | "south-west";

export function regionCorner(shape: RegionShape, corner: ResizeCorner): KernelPoint {
  const bounds = regionBounds(shape);
  return {
    x: corner === "north-west" || corner === "south-west" ? bounds.minX : bounds.maxX,
    y: corner === "north-west" || corner === "north-east" ? bounds.minY : bounds.maxY,
  };
}

function opposite(corner: ResizeCorner): ResizeCorner {
  return ({ "north-west": "south-east", "north-east": "south-west", "south-east": "north-west", "south-west": "north-east" })[corner] as ResizeCorner;
}

function scaledPoint(point: KernelPoint, anchor: KernelPoint, scale: KernelPoint) {
  return { x: anchor.x + (point.x - anchor.x) * scale.x, y: anchor.y + (point.y - anchor.y) * scale.y };
}

export function resizeRegionFromCorner(shape: RegionShape, corner: ResizeCorner, next: KernelPoint, minimumSize = .2) {
  const handle = regionCorner(shape, corner); const anchor = regionCorner(shape, opposite(corner));
  const oldWidth = handle.x - anchor.x; const oldHeight = handle.y - anchor.y;
  const nextWidth = next.x - anchor.x; const nextHeight = next.y - anchor.y;
  if (Math.abs(nextWidth) < minimumSize || Math.abs(nextHeight) < minimumSize || Math.sign(nextWidth) !== Math.sign(oldWidth) || Math.sign(nextHeight) !== Math.sign(oldHeight)) return undefined;
  const scale = { x: nextWidth / oldWidth, y: nextHeight / oldHeight };
  if (shape.kind === "rectangle") {
    const first = scaledPoint({ x: shape.x, y: shape.y }, anchor, scale); const second = scaledPoint({ x: shape.x + shape.width, y: shape.y + shape.height }, anchor, scale);
    return { kind: "rectangle" as const, x: Math.min(first.x, second.x), y: Math.min(first.y, second.y), width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y) };
  }
  if (shape.kind === "circle" || shape.kind === "ellipse") {
    const center = scaledPoint({ x: shape.cx, y: shape.cy }, anchor, scale); const rx = (shape.kind === "circle" ? shape.radius : shape.rx) * Math.abs(scale.x); const ry = (shape.kind === "circle" ? shape.radius : shape.ry) * Math.abs(scale.y);
    return { kind: "ellipse" as const, cx: center.x, cy: center.y, rx, ry };
  }
  if (shape.kind === "bezier") return { ...shape, nodes: scaleBezier(shape.nodes, anchor, scale) };
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map((point) => scaledPoint(point, anchor, scale)), holes: holes.map((hole) => hole.map((point) => scaledPoint(point, anchor, scale))) })) };
  return { ...shape, points: shape.points.map((point) => scaledPoint(point, anchor, scale)) };
}
