import { describe, expect, it } from "vitest";
import { bezierPathData, sampleBezier } from "./bezier-geometry";

describe("Bezier geometry", () => {
  const nodes = [{ anchor: { x: 0, y: 0 }, outHandle: { x: 3, y: 4 } }, { anchor: { x: 10, y: 0 }, inHandle: { x: 7, y: 4 } }];

  it("renders cubic control handles instead of a polyline", () => {
    expect(bezierPathData(nodes)).toBe("M 0 0 C 3 4, 7 4, 10 0");
  });

  it("samples the exact endpoints for constraint checks", () => {
    const points = sampleBezier(nodes, false, 4);
    expect(points[0]).toEqual({ x: 0, y: 0 }); expect(points.at(-1)).toEqual({ x: 10, y: 0 }); expect(points[2].y).toBeGreaterThan(0);
  });
});
