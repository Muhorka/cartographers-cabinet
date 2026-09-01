import { describe, expect, it } from "vitest";
import { stairGlyphMarkup, stairGlyphPrimitives, type StairStyle } from "./stair-glyph";

describe("shared stair glyph geometry", () => {
  const bounds = { minX: 1, maxX: 11, minY: 2, maxY: 18 };

  it("keeps every canonical stair style in the shared primitive set", () => {
    const styles: StairStyle[] = ["straight", "l", "u", "spiral", "curved"];
    for (const style of styles) {
      const primitives = stairGlyphPrimitives(style, bounds);
      expect(primitives.length).toBeGreaterThan(0);
      expect(primitives.every((primitive) => primitive.kind === "line" || primitive.kind === "circle" || primitive.kind === "path")).toBe(true);
    }
  });

  it("renders the spiral core and direction with viewport-scaled strokes", () => {
    const markup = stairGlyphMarkup("spiral", bounds, 4);
    expect(markup).toContain("<circle");
    expect(markup).toContain('stroke-width="0.2"');
    expect(markup).toContain("A ");
  });
});
