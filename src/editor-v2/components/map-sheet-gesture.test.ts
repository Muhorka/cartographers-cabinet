import { describe, expect, it } from "vitest";
import { completedGesture, polygonClosedByPoint } from "./map-sheet-gesture";

describe("polygon completion", () => {
  it("accepts a human-imprecise click near the first vertex", () => {
    const points = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }];
    expect(polygonClosedByPoint(points, { x: .4, y: -.3 }, 1)).toEqual(points);
  });

  it("closes at a crossing and discards the tail before the enclosed ring", () => {
    const points = [{ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }];
    const closed = polygonClosedByPoint(points, { x: 2, y: -2 }, .2)!;
    expect(closed[0].x).toBeCloseTo(10 / 7); expect(closed.slice(1)).toEqual([{ x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }]);
  });

  it("completes a three-point arc with its editable Bézier nodes", () => {
    const result = completedGesture({ instrumentId: "arc", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }], bezierNodes: [{ anchor: { x: 0, y: 0 } }, { anchor: { x: 5, y: 5 } }, { anchor: { x: 10, y: 0 } }] });
    expect(result).toMatchObject({ instrumentId: "arc", points: expect.any(Array), bezierNodes: expect.any(Array), closed: false });
    expect(completedGesture({ instrumentId: "arc", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }] })?.bezierNodes).toEqual(expect.any(Array));
  });

  it("does not complete an arc before the third point", () => {
    expect(completedGesture({ instrumentId: "arc", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] })).toBeUndefined();
  });
});
