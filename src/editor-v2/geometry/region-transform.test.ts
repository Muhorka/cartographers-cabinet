import { describe, expect, it } from "vitest";
import { localizeRegion, pointBounds, regionBoundsCenter, translateRegion } from "./region-transform";

describe("region coordinate transforms", () => {
  it("separates a shape drawn on a containing map into local geometry and placement", () => {
    const localized = localizeRegion({ kind: "rectangle", x: 30, y: 20, width: 10, height: 6 });
    expect(localized).toEqual({
      boundary: { kind: "rectangle", x: -5, y: -3, width: 10, height: 6 },
      transform: { x: 35, y: 23, rotation: 0 },
    });
  });

  it("round-trips a polygon through its local coordinate system", () => {
    const source = { kind: "polygon" as const, points: [{ x: 10, y: 5 }, { x: 18, y: 5 }, { x: 14, y: 11 }] };
    const localized = localizeRegion(source);
    expect(translateRegion(localized.boundary, localized.transform)).toEqual(source);
    expect(regionBoundsCenter(localized.boundary)).toEqual({ x: 0, y: 0 });
  });

  it("measures very large point sets without spreading them as function arguments", () => {
    const points = Array.from({ length: 100_000 }, (_, index) => ({ x: index - 50_000, y: 50_000 - index }));
    expect(pointBounds(points)).toEqual({ minX: -50_000, minY: -49_999, maxX: 49_999, maxY: 50_000 });
  });
});
