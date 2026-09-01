import { describe, expect, it } from "vitest";
import type { CanonicalWall, RoomFace } from "../../geometry/geometry-types";
import { faceAnchor } from "./portal-geometry";

const wall = (start: CanonicalWall["start"], end: CanonicalWall["end"]): CanonicalWall => ({ id: "wall", start, end, role: "partition", thickness: .2 });

describe("route portal geometry", () => {
  it("uses the inward normal for an off-centre internal door", () => {
    const face: Pick<RoomFace, "outer" | "holes"> = { outer: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }, { x: 0, y: 10 }], holes: [] };
    const anchor = faceAnchor(face, { x: 5, y: 2 }, wall({ x: 5, y: 0 }, { x: 5, y: 10 }), .35);
    expect(anchor).toEqual({ x: 4.6, y: 2 });
  });

  it("uses the inward normal for an off-centre door on a rotated wall", () => {
    const face: Pick<RoomFace, "outer" | "holes"> = { outer: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 14, y: 6 }, { x: 4, y: -4 }], holes: [] };
    const anchor = faceAnchor(face, { x: 5, y: 5 }, wall({ x: 0, y: 0 }, { x: 10, y: 10 }), .35);
    expect(anchor?.x).toBeCloseTo(5.2828427, 6);
    expect(anchor?.y).toBeCloseTo(4.7171573, 6);
  });
});
