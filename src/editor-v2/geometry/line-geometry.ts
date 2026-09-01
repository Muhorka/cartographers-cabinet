import { normalizePoint } from "./geometry-normalization";
import type { CanonicalWall, KernelPoint } from "./geometry-types";

const EPSILON = 1e-7;

export function pointsEqual(first: KernelPoint, second: KernelPoint) {
  return Math.abs(first.x - second.x) <= EPSILON && Math.abs(first.y - second.y) <= EPSILON;
}

export function pointOnSegment(point: KernelPoint, start: KernelPoint, end: KernelPoint) {
  const cross = (point.x - start.x) * (end.y - start.y) - (point.y - start.y) * (end.x - start.x);
  if (Math.abs(cross) > EPSILON) return false;
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot >= -EPSILON && dot <= lengthSquared + EPSILON;
}

export function infiniteLineIntersection(first: Pick<CanonicalWall, "start" | "end">, second: Pick<CanonicalWall, "start" | "end">) {
  const a = first.start; const b = first.end; const c = second.start; const d = second.end;
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) <= EPSILON) return undefined;
  const firstCross = a.x * b.y - a.y * b.x; const secondCross = c.x * d.y - c.y * d.x;
  return normalizePoint({
    x: (firstCross * (c.x - d.x) - (a.x - b.x) * secondCross) / denominator,
    y: (firstCross * (c.y - d.y) - (a.y - b.y) * secondCross) / denominator,
  });
}

export function translate(point: KernelPoint, delta: KernelPoint) {
  return normalizePoint({ x: point.x + delta.x, y: point.y + delta.y });
}

export function wallNormal(wall: Pick<CanonicalWall, "start" | "end">) {
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON) return undefined;
  return { x: -dy / length, y: dx / length };
}
