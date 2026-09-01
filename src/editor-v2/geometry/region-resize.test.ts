import { describe, expect, it } from "vitest";
import { resizeRegionFromCorner } from "./region-resize";

describe("region resize", () => {
  it("resizes a rectangle from one corner while keeping the opposite corner fixed", () => {
    expect(resizeRegionFromCorner({ kind: "rectangle", x: 2, y: 3, width: 8, height: 5 }, "south-east", { x: 14, y: 11 })).toEqual({ kind: "rectangle", x: 2, y: 3, width: 12, height: 8 });
  });

  it("turns a non-uniformly resized circle into an ellipse", () => {
    expect(resizeRegionFromCorner({ kind: "circle", cx: 5, cy: 5, radius: 3 }, "south-east", { x: 11, y: 9 })).toMatchObject({ kind: "ellipse", cx: 6.5, cy: 5.5, rx: 4.5, ry: 3.5 });
  });

  it("rejects a corner dragged through the fixed corner", () => {
    expect(resizeRegionFromCorner({ kind: "rectangle", x: 0, y: 0, width: 10, height: 8 }, "south-east", { x: -1, y: 4 })).toBeUndefined();
  });
});
