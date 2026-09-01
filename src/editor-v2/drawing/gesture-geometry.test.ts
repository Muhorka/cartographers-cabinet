import { describe, expect, it } from "vitest";
import { arcBezierNodes, gestureSegments, regionFromGesture } from "./gesture-geometry";
import { sampleBezier } from "../geometry/bezier-geometry";

describe("drawing gesture geometry", () => {
  it("keeps rectangle, circle and ellipse as distinct instruments", () => {
    const points = [{ x: 8, y: 7 }, { x: 2, y: 3 }];
    expect(regionFromGesture("rectangle", points)).toEqual({ kind: "rectangle", x: 2, y: 3, width: 6, height: 4 });
    expect(regionFromGesture("circle", points)).toMatchObject({ kind: "circle", cx: 8, cy: 7 });
    expect(regionFromGesture("ellipse", points)).toEqual({ kind: "ellipse", cx: 5, cy: 5, rx: 3, ry: 2 });
  });

  it("turns a wall run into independent canonical wall segments", () => {
    expect(gestureSegments("wall", [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }], "partition")).toHaveLength(2);
  });

  it("turns three points into an editable cubic arc that passes through the bend", () => {
    const nodes = arcBezierNodes({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 });
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    expect(nodes[0].anchor).toEqual({ x: 0, y: 0 });
    expect(nodes.at(-1)?.anchor).toEqual({ x: 10, y: 0 });
    expect(nodes.some(({ anchor }) => Math.hypot(anchor.x - 5, anchor.y - 5) < 1e-6)).toBe(true);
    expect(sampleBezier(nodes, false)).toEqual(expect.arrayContaining([expect.objectContaining({ x: 5, y: 5 })]));
    expect(nodes.some(({ outHandle, inHandle }) => outHandle || inHandle)).toBe(true);
  });

  it("falls back to an ordinary Bézier path for collinear clicks", () => {
    expect(arcBezierNodes({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 })).toHaveLength(2);
  });
});
