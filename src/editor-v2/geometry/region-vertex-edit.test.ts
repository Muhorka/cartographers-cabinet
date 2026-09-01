import { describe, expect, it } from "vitest";
import { moveRegionVertex, regionVertices } from "./region-vertex-edit";

describe("region vertex editing", () => {
  it("exposes and moves polygon vertices without changing the other points", () => {
    const shape = { kind: "polygon" as const, points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }] };
    expect(regionVertices(shape)).toHaveLength(4);
    expect(moveRegionVertex(shape, 0, 2, { x: 7, y: 5 })).toEqual({ ...shape, points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 7, y: 5 }, { x: 0, y: 6 }] });
  });

  it("edits only the requested island of a compound region", () => {
    const shape = { kind: "compound" as const, polygons: [
      { outer: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }], holes: [] },
      { outer: [{ x: 10, y: 10 }, { x: 14, y: 10 }, { x: 10, y: 14 }], holes: [] },
    ] };
    const changed = moveRegionVertex(shape, 1, 0, { x: 11, y: 11 });
    expect(changed).toMatchObject({ kind: "compound", polygons: [shape.polygons[0], { outer: [{ x: 11, y: 11 }, { x: 14, y: 10 }, { x: 10, y: 14 }] }] });
  });
});
