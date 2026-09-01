import { describe, expect, it } from "vitest";
import { assessPathConstraint } from "./path-constraints";

const boundary = { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 8 };

describe("path constraints", () => {
  it("keeps a path that is already inside the enclosing outline", () => {
    expect(assessPathConstraint([{ x: 1, y: 2 }, { x: 8, y: 2 }], boundary).state).toBe("inside");
  });

  it("offers the part inside the outline instead of silently dropping an overshoot", () => {
    const result = assessPathConstraint([{ x: -4, y: 4 }, { x: 14, y: 4 }], boundary);
    expect(result.state).toBe("clip-available");
    expect(result.state === "clip-available" ? result.paths[0] : []).toEqual([{ x: 0, y: 4 }, { x: 10, y: 4 }]);
  });

  it("rejects a path that never enters the outline", () => {
    expect(assessPathConstraint([{ x: -4, y: -2 }, { x: 14, y: -2 }], boundary).state).toBe("outside");
  });
});
