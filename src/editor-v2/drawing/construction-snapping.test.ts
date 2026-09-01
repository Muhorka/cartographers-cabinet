import { describe, expect, it } from "vitest";
import type { CanonicalWall } from "../geometry/geometry-types";
import { snapConstructionPath, snapConstructionPoint, snapConstructionRegion } from "./construction-snapping";

const walls: CanonicalWall[] = [
  { id: "top", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: .2, role: "boundary" },
  { id: "partial", start: { x: 5, y: 0 }, end: { x: 5, y: 5 }, thickness: .2, role: "partition" },
];

describe("construction snapping", () => {
  it("prefers a nearby existing junction", () => {
    expect(snapConstructionPoint({ x: 5.45, y: 5.35 }, walls)).toEqual({ x: 5, y: 5 });
  });

  it("projects a nearby point onto a wall", () => {
    expect(snapConstructionPoint({ x: 8, y: .4 }, walls)).toEqual({ x: 8, y: 0 });
  });

  it("does not pull a point back to a farther endpoint when a wall is much closer", () => {
    expect(snapConstructionPoint({ x: 5.9, y: .15 }, walls)).toEqual({ x: 5.9, y: 0 });
  });

  it("snaps only the ends of a freehand wall and leaves its interior shape intact", () => {
    expect(snapConstructionPath([{ x: 5.1, y: 5.1 }, { x: 5.2, y: 5.2 }, { x: 9, y: 9 }], walls)).toEqual([{ x: 5, y: 5 }, { x: 5.2, y: 5.2 }, { x: 9, y: 9 }]);
  });

  it("snaps attached surface corners without changing the middle of the shape", () => {
    const snapped = snapConstructionRegion({ kind: "rectangle", x: .4, y: .3, width: 4.6, height: 3.7 }, walls, 1);
    expect(snapped).toEqual({ kind: "polygon", points: [{ x: .4, y: 0 }, { x: 5, y: .3 }, { x: 5, y: 4 }, { x: .4, y: 4 }] });
  });
});
