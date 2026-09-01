import { describe, expect, it, vi } from "vitest";
import type { KernelPoint } from "../../geometry/geometry-types";
import { distance, polylineDistance } from "./geometry";
import { outdoorVisibilityPath } from "./outdoor-visibility";

type Edge = readonly [number, number];

function fixture(points: KernelPoint[], edges: readonly Edge[]) {
  const links = points.map(() => points.map(() => false));
  for (const [a, b] of edges) links[a]![b] = links[b]![a] = true;
  const open = (a: KernelPoint, b: KernelPoint) => links[points.indexOf(a)]![points.indexOf(b)]!;
  return { links, open, route: () => outdoorVisibilityPath(points[0]!, points[1]!, points.slice(2), open) };
}

/** Independent all-pairs reference: no heuristic, settled nodes, or lazy collision checks. */
function referenceDistance(points: KernelPoint[], links: boolean[][]) {
  const costs = points.map((a, i) => points.map((b, j) => i === j ? 0 : links[i]![j] ? distance(a, b) : Infinity));
  for (let via = 0; via < points.length; via += 1) {
    for (let from = 0; from < points.length; from += 1) {
      for (let to = 0; to < points.length; to += 1) {
        costs[from]![to] = Math.min(costs[from]![to]!, costs[from]![via]! + costs[via]![to]!);
      }
    }
  }
  return costs[0]![1]!;
}

describe("outdoor visibility search", () => {
  it("does not settle a longer path when a later candidate has lower g but higher f", () => {
    const points = [{ x: 29, y: 35 }, { x: 22, y: 39 }, { x: 25, y: 24 }, { x: 18, y: 13 },
      { x: 39, y: 7 }, { x: 11, y: 10 }, { x: 19, y: 31 }];
    const graph = fixture(points, [[0, 3], [0, 4], [0, 5], [1, 6], [2, 3], [2, 6], [5, 6]]);
    const route = graph.route();
    // The old non-transitive comparator settled node 6 via 5 and returned 61.822... .
    expect(route?.points).toEqual([points[0], points[3], points[2], points[6], points[1]]);
    expect(route?.distance).toBeCloseTo(55.398700765513404, 10);
    expect(route?.distance).toBeCloseTo(referenceDistance(points, graph.links), 10);
  });

  it("preserves candidate-order ties and coalesces duplicate candidates", () => {
    const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1 }, { x: 2, y: -1 }];
    const graph = fixture(points, [[0, 2], [0, 3], [2, 1], [3, 1]]);
    expect(outdoorVisibilityPath(points[0]!, points[1]!, [...points, ...points], graph.open)?.points)
      .toEqual([points[0], points[2], points[1]]);
    expect(graph.route()).toEqual(graph.route());
  });

  it("avoids collision work for equal-length detours without changing the direct path", () => {
    const from = { x: 0, y: 0 }; const to = { x: 10, y: 0 };
    const open = vi.fn<(a: KernelPoint, b: KernelPoint) => boolean>(() => true);
    expect(outdoorVisibilityPath(from, to, [{ x: 1, y: 0 }, { x: 2, y: 0 }], open))
      .toEqual({ points: [from, to], distance: 10 });
    expect(open).toHaveBeenCalledTimes(3);
    expect(open.mock.calls.every(([a]) => a === from)).toBe(true);
  });

  it("matches an independent shortest-path reference on deterministic sparse graphs", () => {
    let seed = 8327;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let sample = 0; sample < 40; sample += 1) {
      const points = Array.from({ length: 10 }, (_, index) => ({ x: index * 3 + random(), y: random() * 40 }));
      const edges: Edge[] = [];
      for (let a = 0; a < points.length; a += 1) for (let b = a + 1; b < points.length; b += 1) {
        if (sample !== 0 && random() < .23) edges.push([a, b]);
      }
      const graph = fixture(points, edges); const expected = referenceDistance(points, graph.links);
      const actual = graph.route();
      if (!Number.isFinite(expected)) { expect(actual).toBeUndefined(); continue; }
      expect(actual?.distance).toBeCloseTo(expected, 10);
      expect(polylineDistance(actual!.points)).toBeCloseTo(expected, 10);
      expect(actual!.points[0]).toEqual(points[0]);
      expect(actual!.points.at(-1)).toEqual(points[1]);
      for (let index = 1; index < actual!.points.length; index += 1) {
        expect(graph.open(actual!.points[index - 1]!, actual!.points[index]!)).toBe(true);
      }
      expect(graph.route()).toEqual(actual);
    }
  });
});
