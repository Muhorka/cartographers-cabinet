import { describe, expect, it } from "vitest";
import { viewportFromTouchGesture } from "./map-sheet-touch";

const bounds = { left: 0, top: 0, width: 1000, height: 700 };
const size = { width: 1000, height: 700 };

describe("editor v2 touch navigation", () => {
  it("zooms around the gesture midpoint", () => {
    const next = viewportFromTouchGesture({ center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, [{ x: 450, y: 350 }, { x: 550, y: 350 }], [{ x: 400, y: 350 }, { x: 600, y: 350 }], bounds, size);
    expect(next.zoom).toBe(2); expect(next.center).toEqual({ x: 0, y: 0 });
  });

  it("rotates and pans without losing the map point beneath the fingers", () => {
    const next = viewportFromTouchGesture({ center: { x: 20, y: 30 }, zoom: 2, rotation: 0 }, [{ x: 450, y: 350 }, { x: 550, y: 350 }], [{ x: 550, y: 350 }, { x: 550, y: 450 }], bounds, size);
    expect(next.zoom).toBeCloseTo(2); expect(next.rotation).toBeCloseTo(90); expect(next.center).toEqual({ x: -5, y: 55 });
  });
});
