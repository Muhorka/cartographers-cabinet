import type { KernelPoint } from "./geometry-types";
import { createLabelCache, labelValueFingerprint } from "./label-layout-cache";

export type LabelFace = { outer: readonly KernelPoint[]; holes?: readonly (readonly KernelPoint[])[] };
export type PreparedLabelRing = {
  points: readonly KernelPoint[];
  bounds: { left: number; right: number; top: number; bottom: number };
  contains(point: KernelPoint): boolean;
  distance(point: KernelPoint): number;
};
export type PreparedLabelFace = {
  outer: PreparedLabelRing;
  holes: readonly PreparedLabelRing[];
  rings: readonly PreparedLabelRing[];
  bounds: { left: number; right: number; top: number; bottom: number };
  contains(point: KernelPoint): boolean;
};

const preparedCache = createLabelCache<PreparedLabelFace>(256);
let frozenKeys = new WeakMap<object, string>();
let nextFrozenKey = 0;

export function clearPreparedLabelGeometryCache() {
  preparedCache.clear();
  frozenKeys = new WeakMap();
  nextFrozenKey = 0;
}

export function preparedLabelGeometryCacheSize() {
  return preparedCache.size;
}

export function prepareLabelFace(face: LabelFace): PreparedLabelFace {
  const object = face as object;
  const deeplyFrozen = isDeeplyFrozen(face);
  const key = deeplyFrozen ? frozenKey(object) : `value:${labelValueFingerprint(face)}`;
  const cached = preparedCache.get(key);
  if (cached.hit) return cached.value!;
  const value = buildPreparedFace(face);
  preparedCache.set(key, value);
  return value;
}

export function preparedInsideFace(point: KernelPoint, face: PreparedLabelFace) {
  return face.contains(point);
}

export function preparedDistanceToEdges(point: KernelPoint, rings: readonly PreparedLabelRing[]) {
  let nearest = Infinity;
  for (let index = 0; index < rings.length; index += 1) {
    const distance = rings[index]!.distance(point);
    if (Number.isNaN(distance)) return Number.NaN;
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}

function buildPreparedFace(face: LabelFace): PreparedLabelFace {
  const outer = prepareRing(face.outer);
  const holes = (face.holes ?? []).map(prepareRing);
  const rings = [outer, ...holes];
  let left = Infinity; let right = -Infinity; let top = Infinity; let bottom = -Infinity;
  for (const point of outer.points) {
    left = Math.min(left, point.x); right = Math.max(right, point.x);
    top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
  }
  const contains = holes.length ? (point: KernelPoint) => {
    if (!outer.contains(point)) return false;
    for (let index = 0; index < holes.length; index += 1) if (holes[index]!.contains(point)) return false;
    return true;
  } : outer.contains;
  return Object.freeze({ outer, holes: Object.freeze(holes), rings: Object.freeze(rings), bounds: Object.freeze({ left, right, top, bottom }), contains });
}

function prepareRing(source: readonly KernelPoint[]): PreparedLabelRing {
  const points = source.map(({ x, y }) => Object.freeze({ x, y }));
  // These arrays never escape the two closures. Callers can neither change
  // cached coordinates nor slow the hot loop through frozen array iteration.
  const xs = new Float64Array(source.length); const ys = new Float64Array(source.length);
  let left = Infinity; let right = -Infinity; let top = Infinity; let bottom = -Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    xs[index] = point.x; ys[index] = point.y;
    left = Math.min(left, point.x); right = Math.max(right, point.x);
    top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
  }
  let rayLeft = Infinity; let rayRight = -Infinity;
  for (let index = 0, previous = xs.length - 1; index < xs.length; previous = index++) {
    const dx = xs[previous]! - xs[index]!; const dy = ys[previous]! - ys[index]!;
    if (dy === 0) continue;
    // Bound the actual floating-point expression, rather than the ideal segment.
    // Overflow expands the bounds; NaN disables this shortcut through comparisons.
    const start = dx * 0 / dy + xs[index]!; const end = dx * dy / dy + xs[index]!;
    rayLeft = Math.min(rayLeft, start, end); rayRight = Math.max(rayRight, start, end);
  }
  // Between two vertex y values the set of ray-crossing edges is constant.
  // Use exact comparisons, with no rounded spatial buckets or geometry tolerance.
  // Large or non-finite rings retain the linear predicate and bounded preparation cost.
  const levels = ys.length <= 128 && ys.every(Number.isFinite) ? [...new Set(ys)].sort((a, b) => a - b) : undefined;
  const slabs = levels?.slice(0, -1).map((y) => {
    const crossings: number[] = [];
    for (let index = 0, previous = ys.length - 1; index < ys.length; previous = index++) {
      if ((ys[index]! > y) !== (ys[previous]! > y)) crossings.push(index);
    }
    return crossings;
  });
  const contains = (point: KernelPoint) => {
    if (Number.isNaN(point.y)) return false;
    if (point.y < top || point.y >= bottom) return false;
    if (point.x < rayLeft || point.x > rayRight) return false;
    let inside = false;
    if (levels && slabs) {
      let low = 0; let high = levels.length - 1;
      while (low + 1 < high) { const middle = (low + high) >>> 1; if (point.y >= levels[middle]!) low = middle; else high = middle; }
      const crossings = slabs[low] ?? [];
      for (let edge = 0; edge < crossings.length; edge += 1) {
        const index = crossings[edge]!; const previous = (index + xs.length - 1) % xs.length;
        if (point.x < (xs[previous]! - xs[index]!) * (point.y - ys[index]!) / (ys[previous]! - ys[index]!) + xs[index]!) inside = !inside;
      }
      return inside;
    }
    for (let index = 0, previous = xs.length - 1; index < xs.length; previous = index++) {
      const firstX = xs[index]!; const firstY = ys[index]!; const secondX = xs[previous]!; const secondY = ys[previous]!;
      if ((firstY > point.y) !== (secondY > point.y) && point.x < (secondX - firstX) * (point.y - firstY) / (secondY - firstY) + firstX) inside = !inside;
    }
    return inside;
  };
  const distance = (point: KernelPoint) => {
    let nearest = Infinity;
    for (let index = 0; index < xs.length; index += 1) {
      const next = (index + 1) % xs.length;
      const startX = xs[index]!; const startY = ys[index]!;
      const dx = xs[next]! - startX; const dy = ys[next]! - startY; const lengthSquared = dx * dx + dy * dy;
      const amount = lengthSquared ? Math.max(0, Math.min(1, ((point.x - startX) * dx + (point.y - startY) * dy) / lengthSquared)) : 0;
      const value = Math.hypot(point.x - (startX + amount * dx), point.y - (startY + amount * dy));
      if (Number.isNaN(value)) return Number.NaN;
      if (value < nearest) nearest = value;
    }
    return nearest;
  };
  return Object.freeze({ points: Object.freeze(points), bounds: Object.freeze({ left, right, top, bottom }), contains, distance });
}

function isDeeplyFrozen(face: LabelFace) {
  const holes = face.holes;
  return Object.isFrozen(face) && Object.isFrozen(face.outer) && face.outer.every(Object.isFrozen) && (!holes || Object.isFrozen(holes) && holes.every((hole) => Object.isFrozen(hole) && hole.every(Object.isFrozen)));
}

function frozenKey(object: object) {
  const retained = frozenKeys.get(object);
  if (retained) return retained;
  const key = `frozen:${nextFrozenKey++}`;
  frozenKeys.set(object, key);
  return key;
}
