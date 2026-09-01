import type { KernelPoint } from "./geometry-types";

export const GEOMETRY_PRECISION = 1_000_000;

function normalizeNumber(value: number) {
  const normalized = Math.round(value * GEOMETRY_PRECISION) / GEOMETRY_PRECISION;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function normalizePoint(point: KernelPoint): KernelPoint {
  return { x: normalizeNumber(point.x), y: normalizeNumber(point.y) };
}

export function pointKey(point: KernelPoint) {
  const normalized = normalizePoint(point);
  return `${normalized.x},${normalized.y}`;
}

export function undirectedEdgeKey(first: KernelPoint, second: KernelPoint) {
  const a = pointKey(first); const b = pointKey(second);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function canonicalRing(points: KernelPoint[]) {
  const open = points.length > 1 && pointKey(points[0]) === pointKey(points.at(-1)!) ? points.slice(0, -1) : [...points];
  if (open.length < 2) return open.map(normalizePoint);
  const normalized = open.map(normalizePoint);
  const candidates = [normalized, [...normalized].reverse()].flatMap((ring) => ring.map((_, index) => [...ring.slice(index), ...ring.slice(0, index)]));
  return candidates.toSorted((first, second) => first.map(pointKey).join(";").localeCompare(second.map(pointKey).join(";")))[0];
}

export function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
