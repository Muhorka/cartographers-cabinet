import { describe, expect, it } from "vitest";
import { conservativeQuantizedLabelLayoutZoom, labelLayoutZoomRatio, quantizedLabelLayoutZoom } from "./label-layout-zoom";

describe("quantized label layout zoom", () => {
  it("reuses one layout throughout a stable scale interval", () => {
    expect(quantizedLabelLayoutZoom(.96)).toBe(1);
    expect(quantizedLabelLayoutZoom(1)).toBe(1);
    expect(quantizedLabelLayoutZoom(1.04)).toBe(1);
  });

  it("moves between layout scales in ten-percent steps", () => {
    const current = quantizedLabelLayoutZoom(1.05);
    const next = quantizedLabelLayoutZoom(1.16);
    expect(current).toBe(labelLayoutZoomRatio);
    expect(next / current).toBeCloseTo(labelLayoutZoomRatio);
  });

  it("keeps the heavy layout zoom at or above the live zoom", () => {
    const current = conservativeQuantizedLabelLayoutZoom(1.04);
    expect(current).toBeCloseTo(Math.sqrt(labelLayoutZoomRatio), 10);
    expect(current).toBeGreaterThanOrEqual(1.04);
    expect(conservativeQuantizedLabelLayoutZoom(.96)).toBe(current);
  });

  it.each([3.2, 6.5, 15])("keeps the effective scale within five percent near the existing %s px label threshold", (zoom) => {
    expect(Math.abs(quantizedLabelLayoutZoom(zoom) / zoom - 1)).toBeLessThan(.05);
  });

  it("returns a safe scale for invalid values", () => {
    expect(quantizedLabelLayoutZoom(0)).toBe(1);
    expect(quantizedLabelLayoutZoom(Number.NaN)).toBe(1);
  });
});
