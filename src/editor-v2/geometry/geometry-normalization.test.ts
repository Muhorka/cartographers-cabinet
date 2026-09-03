import { describe, expect, it } from "vitest";
import type { KernelPoint } from "./geometry-types";
import { canonicalRing, normalizePoint, pointKey } from "./geometry-normalization";

function referenceCanonicalRing(points: KernelPoint[]) {
  const open = points.length > 1 && pointKey(points[0]!) === pointKey(points.at(-1)!) ? points.slice(0, -1) : [...points];
  if (open.length < 2) return canonicalRing(open);
  const normalized = open.map(normalizePoint);
  const candidates = [normalized, [...normalized].reverse()].flatMap((ring) => ring.map((_, index) => [...ring.slice(index), ...ring.slice(0, index)]));
  return candidates.toSorted((first, second) => first.map(pointKey).join(";").localeCompare(second.map(pointKey).join(";")))[0]!.map(({ x, y }) => ({ x, y }));
}

describe("canonicalRing", () => {
  it.each([
    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
    [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
    [{ x: -0, y: .0000004 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 }],
  ])("matches the established canonical ordering", (...points) => {
    expect(canonicalRing(points)).toEqual(referenceCanonicalRing(points));
  });

  it("handles a schema-sized ring without constructing every rotation", () => {
    const points = Array.from({ length: 100_000 }, (_, index) => ({ x: Math.cos(index), y: Math.sin(index) }));
    expect(canonicalRing(points)).toHaveLength(points.length);
  });
});
