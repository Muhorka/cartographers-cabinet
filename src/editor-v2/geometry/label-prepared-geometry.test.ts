import { describe, expect, it } from "vitest";
import { clearPreparedLabelGeometryCache, prepareLabelFace, preparedDistanceToEdges, preparedInsideFace, preparedLabelGeometryCacheSize } from "./label-prepared-geometry";

const square = () => [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];

function referenceContains(point: { x: number; y: number }, ring: readonly { x: number; y: number }[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const first = ring[index]!; const second = ring[previous]!;
    if ((first.y > point.y) !== (second.y > point.y) && point.x < (second.x - first.x) * (point.y - first.y) / (second.y - first.y) + first.x) inside = !inside;
  }
  return inside;
}

function pointsAroundRing(ring: readonly { x: number; y: number }[]) {
  const samples = [...ring];
  for (let index = 0; index < ring.length; index += 1) {
    const first = ring[index]!; const second = ring[(index + 1) % ring.length]!;
    const dx = second.x - first.x; const dy = second.y - first.y; const length = Math.hypot(dx, dy);
    const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    samples.push(middle);
    if (length > 0) {
      const normal = { x: -dy / length * 1e-7, y: dx / length * 1e-7 };
      samples.push({ x: middle.x + normal.x, y: middle.y + normal.y }, { x: middle.x - normal.x, y: middle.y - normal.y });
    }
  }
  return samples;
}

function frozenFace(index: number) {
  const outer = Object.freeze(square().map(({ x, y }) => Object.freeze({ x: x + index * 30, y })));
  return Object.freeze({ outer, holes: Object.freeze([]) });
}

function circlePoints(count: number, radius = 20) {
  return Array.from({ length: count }, (_, index) => ({ x: Math.cos(index / count * Math.PI * 2) * radius, y: Math.sin(index / count * Math.PI * 2) * radius }));
}

describe("prepared label geometry", () => {
  it("preserves hole containment and segment distance semantics", () => {
    const prepared = prepareLabelFace({ outer: square(), holes: [[{ x: 7, y: 7 }, { x: 13, y: 7 }, { x: 13, y: 13 }, { x: 7, y: 13 }]] });
    expect(preparedInsideFace({ x: 2, y: 2 }, prepared)).toBe(true);
    expect(preparedInsideFace({ x: 10, y: 10 }, prepared)).toBe(false);
    expect(preparedDistanceToEdges({ x: 10, y: 10 }, prepared.rings)).toBe(3);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.outer.points)).toBe(true);
    expect(Object.isFrozen(prepared.outer.points[0])).toBe(true);
  });

  it("invalidates mutable faces when points or holes change", () => {
    clearPreparedLabelGeometryCache();
    const holes = [[{ x: 7, y: 7 }, { x: 13, y: 7 }, { x: 13, y: 13 }, { x: 7, y: 13 }]];
    const face = { outer: square(), holes };
    const first = prepareLabelFace(face);
    face.outer[0]!.x = -2;
    const second = prepareLabelFace(face);
    expect(second).not.toBe(first);
    expect(second.bounds.left).toBe(-2);
    holes.push([{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 4 }]);
    const third = prepareLabelFace(face);
    expect(third).not.toBe(second);
    expect(third.holes).toHaveLength(2);
  });

  it("invalidates a frozen wrapper when its mutable holes collection changes", () => {
    clearPreparedLabelGeometryCache();
    const outer = Object.freeze(square().map(({ x, y }) => Object.freeze({ x, y })));
    const holes: { x: number; y: number }[][] = [];
    const face = Object.freeze({ outer, holes });
    const first = prepareLabelFace(face);
    holes.push([{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }]);
    const second = prepareLabelFace(face);
    expect(second).not.toBe(first);
    expect(first.contains({ x: 2, y: 2 })).toBe(true);
    expect(second.contains({ x: 2, y: 2 })).toBe(false);
  });

  it("does not retain prepared values after clear or LRU eviction", () => {
    clearPreparedLabelGeometryCache();
    const source = frozenFace(0);
    const first = prepareLabelFace(source);
    expect(prepareLabelFace(source)).toBe(first);
    for (let index = 1; index < 257; index += 1) prepareLabelFace(frozenFace(index));
    expect(preparedLabelGeometryCacheSize()).toBe(256);
    const afterEviction = prepareLabelFace(source);
    expect(afterEviction).not.toBe(first);
    expect(prepareLabelFace(source)).toBe(afterEviction);
    clearPreparedLabelGeometryCache();
    const afterClear = prepareLabelFace(source);
    expect(afterClear).not.toBe(afterEviction);
    expect(preparedLabelGeometryCacheSize()).toBe(1);
  });

  it("keeps cached coordinates safe from public geometry mutations", () => {
    clearPreparedLabelGeometryCache();
    const source = frozenFace(0);
    const prepared = prepareLabelFace(source);
    expect(() => Object.defineProperty(prepared.outer.points[0], "x", { value: 999 })).toThrow();
    expect(() => Object.defineProperty(prepared.outer.bounds, "left", { value: -999 })).toThrow();
    expect(() => Object.defineProperty(prepared.outer, "contains", { value: () => true })).toThrow();
    expect(prepared.outer.contains({ x: 2, y: 2 })).toBe(true);
    expect(prepareLabelFace(source)).toBe(prepared);
    expect(prepareLabelFace(source).outer.contains({ x: 2, y: 2 })).toBe(true);
  });

  it("matches the original ray crossing predicate on circle, concave, reverse, and large rings", () => {
    const concave = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 8 }, { x: 0, y: 8 }];
    const rings = [circlePoints(64), concave, [...concave].reverse(), circlePoints(129)];
    for (const ring of rings) {
      const prepared = prepareLabelFace({ outer: ring });
      for (const point of pointsAroundRing(ring)) expect(prepared.outer.contains(point)).toBe(referenceContains(point, ring));
      for (const point of [{ x: 0, y: 0 }, { x: 1.25, y: 2.5 }, { x: 100, y: 100 }, { x: -100, y: -100 }]) expect(prepared.outer.contains(point)).toBe(referenceContains(point, ring));
    }
  });

  it("preserves strict invalid numeric containment and distance results", () => {
    const rings = [square(), [{ x: -1e200, y: -1e200 }, { x: 1e200, y: -1e200 }, { x: 1e200, y: 1e200 }, { x: -1e200, y: 1e200 }], [{ x: -1e200, y: 0 }, { x: 0, y: -1e200 }, { x: 1e200, y: 0 }, { x: 0, y: 1e200 }], [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }, { x: 1, y: 0 }]];
    for (const ring of rings) {
      const prepared = prepareLabelFace({ outer: ring });
      for (const point of [{ x: 0, y: 0 }, { x: 1e200, y: 0 }, { x: 1e250, y: 1e199 }, { x: Number.POSITIVE_INFINITY, y: 0 }, { x: Number.NaN, y: 0 }, { x: 0, y: Number.NaN }, { x: 0, y: Number.POSITIVE_INFINITY }]) expect(prepared.outer.contains(point)).toBe(referenceContains(point, ring));
    }
    expect(preparedDistanceToEdges({ x: 0, y: 0 }, [])).toBe(Infinity);
    expect(preparedDistanceToEdges({ x: Number.NaN, y: 0 }, [prepareLabelFace({ outer: square() }).outer])).toBeNaN();
    expect(preparedDistanceToEdges({ x: 0, y: 0 }, [prepareLabelFace({ outer: [] }).outer])).toBe(Infinity);
  });

  it("keeps prepared geometry cache bounded", () => {
    clearPreparedLabelGeometryCache();
    for (let index = 0; index < 270; index += 1) prepareLabelFace({ outer: [{ x: index, y: 0 }, { x: index + 10, y: 0 }, { x: index + 10, y: 10 }, { x: index, y: 10 }] });
    expect(preparedLabelGeometryCacheSize()).toBeLessThanOrEqual(256);
  });
});
