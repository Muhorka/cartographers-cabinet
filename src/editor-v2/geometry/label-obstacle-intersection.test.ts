import { describe, expect, it } from "vitest";
import { labelObstacleIntersectsBox } from "./label-obstacle-intersection";
import { prepareLabelFace } from "./label-prepared-geometry";

describe("label obstacle intersection", () => {
  it("detects crossing a concave hole edge when every box corner lies inside the hole", () => {
    const obstacle = prepareLabelFace({
      outer: [{ x: -1, y: -1 }, { x: 11, y: -1 }, { x: 11, y: 11 }, { x: -1, y: 11 }],
      holes: [[
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 7, y: 10 },
        { x: 7, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 10 }, { x: 0, y: 10 },
      ]],
    });

    expect(labelObstacleIntersectsBox({ center: { x: 5, y: 5.5 }, width: 8, height: 1, rotation: 0 }, obstacle)).toBe(true);
  });

  it("does not report an intersection for a box wholly inside a hole", () => {
    const obstacle = prepareLabelFace({
      outer: [{ x: -1, y: -1 }, { x: 11, y: -1 }, { x: 11, y: 11 }, { x: -1, y: 11 }],
      holes: [[
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 7, y: 10 },
        { x: 7, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 10 }, { x: 0, y: 10 },
      ]],
    });

    expect(labelObstacleIntersectsBox({ center: { x: 1.5, y: 5.5 }, width: 1, height: 1, rotation: 0 }, obstacle)).toBe(false);
  });
});
