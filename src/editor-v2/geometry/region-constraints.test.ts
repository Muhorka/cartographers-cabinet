import { describe, expect, it } from "vitest";
import { assessRegionConstraint, pointInRegion, subtractRegionShape, unionRegionShapes } from "./region-constraints";

const boundary = { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 10 };

describe("region constraints", () => {
  it("accepts contents inside the open place", () => {
    expect(assessRegionConstraint({ kind: "circle", cx: 5, cy: 5, radius: 2 }, boundary).state).toBe("inside");
  });

  it("offers an actual clipped geometry for an overshoot", () => {
    const result = assessRegionConstraint({ kind: "rectangle", x: 8, y: 2, width: 5, height: 4 }, boundary);
    expect(result.state).toBe("clip-available");
    if (result.state === "clip-available") {
      const points = result.shapes[0].kind === "polygon" ? result.shapes[0].points : [];
      expect(new Set(points.map(({ x }) => x))).toEqual(new Set([8, 10]));
      expect(new Set(points.map(({ y }) => y))).toEqual(new Set([2, 6]));
    }
  });

  it("rejects content completely outside the open place", () => {
    expect(assessRegionConstraint({ kind: "rectangle", x: 20, y: 20, width: 2, height: 2 }, boundary).state).toBe("outside");
  });

  it("keeps disconnected parts when several outlines become one object", () => {
    const shape = unionRegionShapes([
      { kind: "rectangle", x: 0, y: 0, width: 2, height: 2 },
      { kind: "rectangle", x: 5, y: 0, width: 2, height: 2 },
    ]);
    expect(shape).toMatchObject({ kind: "compound", polygons: [{ holes: [] }, { holes: [] }] });
    expect(pointInRegion({ x: 1, y: 1 }, shape!)).toBe(true);
    expect(pointInRegion({ x: 3.5, y: 1 }, shape!)).toBe(false);
  });

  it("preserves a true hole after subtracting an interior shape", () => {
    const shape = subtractRegionShape(boundary, { kind: "circle", cx: 5, cy: 5, radius: 2 });
    expect(shape).toMatchObject({ kind: "compound", polygons: [{ holes: [expect.any(Array)] }] });
    expect(pointInRegion({ x: 5, y: 5 }, shape!)).toBe(false);
    expect(pointInRegion({ x: 1, y: 1 }, shape!)).toBe(true);
  });

  it("repairs a self-crossing polygon instead of throwing a runtime topology error", () => {
    const crossing = { kind: "polygon" as const, points: [{ x: 2, y: 2 }, { x: 8, y: 8 }, { x: 2, y: 8 }, { x: 8, y: 2 }] };
    expect(() => assessRegionConstraint(crossing, boundary)).not.toThrow();
    expect(assessRegionConstraint(crossing, boundary).state).toBe("inside");
  });
});
