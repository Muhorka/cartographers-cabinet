import { afterEach, describe, expect, it, vi } from "vitest";
import * as geometry from "./geometry";
import { createRoutePathFinder } from "./shortest-path-cache";

const square = (x = 0) => ({ kind: "polygon" as const, points: [{ x, y: 0 }, { x: x + 10, y: 0 }, { x: x + 10, y: 10 }, { x, y: 10 }] });
const shape = () => square();

describe("request-local shortest path cache", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reuses exact directional queries and returns independent point copies", () => {
    const spy = vi.spyOn(geometry, "shortestPath");
    const find = createRoutePathFinder();
    const first = find(shape(), { x: 1, y: 1 }, { x: 9, y: 9 }, .5);
    const second = find(shape(), { x: 1, y: 1 }, { x: 9, y: 9 }, .5);
    expect(second).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
    if (first && second) { second.points[0]!.x = 999; expect(find(shape(), { x: 1, y: 1 }, { x: 9, y: 9 }, .5)).toEqual(first); }
  });

  it("keeps shape, direction, margin, and holes in the key", () => {
    const raw = geometry.shortestPath;
    const spy = vi.spyOn(geometry, "shortestPath");
    const find = createRoutePathFinder(); const base = { kind: "compound" as const, polygons: [{ outer: square().points, holes: [] }] };
    const withHole = { kind: "compound" as const, polygons: [{ outer: square().points, holes: [[{ x: 4, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 7 }, { x: 4, y: 7 }]] }] };
    const first = find(base, { x: 1, y: 5 }, { x: 9, y: 5 }, .5);
    const holed = find(withHole, { x: 1, y: 5 }, { x: 9, y: 5 }, .5);
    expect(holed).toEqual(raw(withHole, { x: 1, y: 5 }, { x: 9, y: 5 }, .5));
    expect(holed).not.toEqual(first);
    find(base, { x: 9, y: 5 }, { x: 1, y: 5 }, .5);
    find(base, { x: 1, y: 5 }, { x: 9, y: 5 }, .75);
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it("detects mutable shape and endpoint changes before reading the cache", () => {
    const spy = vi.spyOn(geometry, "shortestPath");
    const find = createRoutePathFinder(); const mutable = shape(); const from = { x: 1, y: 1 }; const to = { x: 9, y: 9 };
    find(mutable, from, to, .5); mutable.points[0]!.x = -2; find(mutable, from, to, .5); from.x = 2; find(mutable, from, to, .5);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("caches negative results without confusing them with a miss", () => {
    const raw = geometry.shortestPath;
    const spy = vi.spyOn(geometry, "shortestPath");
    const find = createRoutePathFinder(); const blocked = { kind: "compound" as const, polygons: [{ outer: square().points, holes: [[{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }]] }] };
    const expected = raw(blocked, { x: 5, y: 5 }, { x: 9, y: 9 }, .5);
    expect(expected).toBeUndefined();
    expect(find(blocked, { x: 5, y: 5 }, { x: 9, y: 9 }, .5)).toEqual(expected);
    expect(find(blocked, { x: 5, y: 5 }, { x: 9, y: 9 }, .5)).toEqual(expected);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache for nonfinite input and preserves signed zero in the key", () => {
    const raw = geometry.shortestPath;
    const spy = vi.spyOn(geometry, "shortestPath");
    const find = createRoutePathFinder(); const base = shape();
    const capture = (call: () => unknown) => { try { return { ok: true, value: call() }; } catch (error) { return { ok: false, error: String(error) }; } };
    const nonfinite = [{ from: { x: Number.NaN, y: 1 }, to: { x: 9, y: 9 }, margin: .5 }, { from: { x: 1, y: 1 }, to: { x: 9, y: 9 }, margin: Number.POSITIVE_INFINITY }];
    for (const query of nonfinite) {
      const expected = capture(() => raw(base, query.from, query.to, query.margin));
      expect(capture(() => find(base, query.from, query.to, query.margin))).toEqual(expected);
      expect(capture(() => find(base, query.from, query.to, query.margin))).toEqual(expected);
    }
    find(base, { x: -0, y: 1 }, { x: 9, y: 9 }, .5); find(base, { x: 0, y: 1 }, { x: 9, y: 9 }, .5);
    expect(spy).toHaveBeenCalledTimes(6);
  });

  it("evicts old entries at the bounded limit and keeps instances isolated", () => {
    const spy = vi.spyOn(geometry, "shortestPath");
    const first = createRoutePathFinder(); const second = createRoutePathFinder();
    for (let index = 0; index < 512; index += 1) first(square(index * 20), { x: index * 20 + 1, y: 1 }, { x: index * 20 + 9, y: 9 }, .5);
    first(square(512 * 20), { x: 512 * 20 + 1, y: 1 }, { x: 512 * 20 + 9, y: 9 }, .5);
    first(square(0), { x: 1, y: 1 }, { x: 9, y: 9 }, .5);
    second(square(0), { x: 1, y: 1 }, { x: 9, y: 9 }, .5);
    expect(spy).toHaveBeenCalledTimes(515);
  });
});
