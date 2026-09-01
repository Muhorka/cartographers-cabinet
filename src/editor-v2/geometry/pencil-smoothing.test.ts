import { describe, expect, it } from "vitest";
import { smoothPencilPoints } from "./pencil-smoothing";

describe("pencil smoothing", () => {
  it("keeps endpoints exact, leaves input untouched, and reduces a sharp interior deviation", () => {
    const source = [{ x: 0, y: 0 }, { x: 1, y: 4 }, { x: 2, y: 0 }];
    const smoothed = smoothPencilPoints(source, 0.5);
    expect(smoothed[0]).toEqual(source[0]);
    expect(smoothed.at(-1)).toEqual(source.at(-1));
    expect(smoothed[1]!.y).toBeLessThan(4);
    expect(source[1]).toEqual({ x: 1, y: 4 });
  });

  it("does not change short strokes or a disabled smoothing setting", () => {
    const source = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(smoothPencilPoints(source, 0)).toEqual(source);
    expect(smoothPencilPoints(source, 1)).toEqual(source);
  });
});
