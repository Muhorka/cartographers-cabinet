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

function leastRotationIndex(values: readonly string[]) {
  const count = values.length;
  let first = 0; let second = 1; let offset = 0;
  while (first < count && second < count && offset < count) {
    const comparison = values[(first + offset) % count]!.localeCompare(values[(second + offset) % count]!);
    if (comparison === 0) { offset += 1; continue; }
    if (comparison > 0) {
      first += offset + 1;
      if (first <= second) first = second + 1;
    } else {
      second += offset + 1;
      if (second <= first) second = first + 1;
    }
    offset = 0;
  }
  return Math.min(first, second);
}

function rotated<T>(values: readonly T[], start: number) {
  return Array.from({ length: values.length }, (_, index) => values[(start + index) % values.length]!);
}

function compareRotations(firstValues: readonly string[], first: number, secondValues: readonly string[], second: number) {
  for (let offset = 0; offset < firstValues.length; offset += 1) {
    const comparison = firstValues[(first + offset) % firstValues.length]!.localeCompare(secondValues[(second + offset) % secondValues.length]!);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

export function canonicalRing(points: KernelPoint[]) {
  const open = points.length > 1 && pointKey(points[0]) === pointKey(points.at(-1)!) ? points.slice(0, -1) : [...points];
  if (open.length < 2) return open.map(normalizePoint);
  const normalized = open.map(normalizePoint);
  const forwardKeys = normalized.map(pointKey);
  const reverse = [...normalized].reverse();
  const reverseKeys = [...forwardKeys].reverse();
  const forwardStart = leastRotationIndex(forwardKeys);
  const reverseStart = leastRotationIndex(reverseKeys);
  return compareRotations(forwardKeys, forwardStart, reverseKeys, reverseStart) <= 0
    ? rotated(normalized, forwardStart)
    : rotated(reverse, reverseStart);
}

export function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
