import * as geometry from "./geometry";
import type { KernelPoint } from "../../geometry/geometry-types";

type RouteShape = Parameters<typeof geometry.shortestPath>[0];
type RoutePath = NonNullable<ReturnType<typeof geometry.shortestPath>>;
type CachedPath = RoutePath | undefined;

const MAX_ENTRIES = 512;
const MAX_WEIGHT = 2_000_000;

/** A bounded cache whose lifetime is limited to one route path finder. */
export function createRoutePathFinder() {
  const entries = new Map<string, { value: CachedPath; weight: number }>();
  let totalWeight = 0;

  const get = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    entries.delete(key); entries.set(key, entry);
    return clonePath(entry.value);
  };

  const set = (key: string, value: CachedPath) => {
    const cloned = clonePath(value);
    const weight = key.length + (cloned?.points.length ?? 0) * 24 + 64;
    if (weight > MAX_WEIGHT) return;
    const existing = entries.get(key);
    if (existing) { totalWeight -= existing.weight; entries.delete(key); }
    while (entries.size >= MAX_ENTRIES || totalWeight + weight > MAX_WEIGHT) {
      const oldest = entries.entries().next().value as [string, { value: CachedPath; weight: number }] | undefined;
      if (!oldest) break;
      entries.delete(oldest[0]); totalWeight -= oldest[1].weight;
    }
    entries.set(key, { value: cloned, weight }); totalWeight += weight;
  };

  return (shape: RouteShape, from: KernelPoint, to: KernelPoint, margin = 0): RoutePath | undefined => {
    const key = cacheKey(shape, from, to, margin);
    if (key !== undefined) {
      const cached = get(key);
      if (cached !== undefined) return cached;
      if (entries.has(key)) return undefined;
    }
    const result = geometry.shortestPath(shape, from, to, margin);
    if (key !== undefined) set(key, result);
    return clonePath(result);
  };
}

function cacheKey(shape: RouteShape, from: KernelPoint, to: KernelPoint, margin: number) {
  const shapeKey = finiteKey(shape); const fromKey = finiteKey(from); const toKey = finiteKey(to); const marginKey = finiteKey(margin);
  if (shapeKey === undefined || fromKey === undefined || toKey === undefined || marginKey === undefined) return undefined;
  return `shape=${shapeKey}|from=${fromKey}|to=${toKey}|margin=${marginKey}`;
}

function finiteKey(value: unknown) {
  return finiteKeyInner(value, new Set<object>());
}

function finiteKeyInner(value: unknown, seen: Set<object>): string | undefined {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return Object.is(value, -0) ? "number:-0" : `number:${value}`;
  }
  if (typeof value === "string") return `string:${value.length}:${value}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  if (typeof value === "undefined") return "undefined";
  if (typeof value !== "object") return `${typeof value}:${String(value)}`;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => finiteKeyInner(item, seen));
    seen.delete(value);
    return parts.some((part) => part === undefined) ? undefined : `array:${value.length}[${parts.join(",")}]`;
  }
  const parts: string[] = [];
  for (const key of Object.keys(value).toSorted()) {
    const part = finiteKeyInner((value as Record<string, unknown>)[key], seen);
    if (part === undefined) { seen.delete(value); return undefined; }
    parts.push(`${finiteKeyInner(key, seen)}=${part}`);
  }
  seen.delete(value);
  return `object{${parts.join(",")}}`;
}

function clonePath(path: CachedPath): CachedPath {
  return path ? { distance: path.distance, points: path.points.map(({ x, y }) => ({ x, y })) } : undefined;
}
