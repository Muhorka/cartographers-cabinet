import { describe, expect, it } from "vitest";
import { regionArea } from "../geometry/region-constraints";
import { connectedFaceShapes } from "./connected-face-shapes";

describe("connected face shapes", () => {
  it("preserves holes when turning faces into regions", () => {
    const [shape] = connectedFaceShapes([{
      id: "face",
      outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      holes: [[{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 4 }]],
      area: 96,
      wallIds: ["wall"],
    }]);
    expect(shape).toBeDefined();
    expect(regionArea(shape!)).toBeCloseTo(96);
  });
});
