import { describe, expect, it } from "vitest";
import { clearRegionLabelLayoutCache, regionLabelLayout, regionLabelLayoutCacheSize } from "./region-label-layout";
import { conservativeQuantizedLabelLayoutZoom, quantizedLabelLayoutZoom } from "./label-layout-zoom";
import { labelObstacleForLayout, roomLabelLayout, clearRoomLabelLayoutCache, roomLabelLayoutCacheSize } from "./room-label-layout";

describe("region label layout", () => {
  it("stacks a smaller readable area below a complete name when the shape has room", () => {
    const label = regionLabelLayout({ name: "Sala balowa", area: "100 m²" }, { kind: "rectangle", x: 0, y: 0, width: 20, height: 15 }, 10);
    expect(label?.kind).toBe("inside"); if (label?.kind !== "inside") return;
    expect(label.text).toBe("Sala balowa"); expect(label.secondaryLine?.text).toBe("100 m²");
    expect(label.secondaryLine!.fontSize).toBeLessThan(label.fontSize);
    expect(label.secondaryLine!.fontSize * 10).toBeGreaterThanOrEqual(3.2);
    expect(label.secondaryLine!.offsetY).toBeGreaterThan(label.nameOffsetY!);
  });

  it("keeps authored text intact when areas are disabled", () => {
    const label = regionLabelLayout("Sala · 100 m²", { kind: "rectangle", x: 0, y: 0, width: 20, height: 15 }, 10);
    expect(label?.text).toBe("Sala · 100 m²");
    expect(label?.kind === "inside" && label.secondaryLine).toBeUndefined();
  });
  it("keeps large terrain names readable while zooming out", () => {
    const label = regionLabelLayout("Jezioro Długich Trzcin", { kind: "ellipse", cx: 40, cy: 30, rx: 36, ry: 7 }, .75, true);
    expect(label?.text).toBe("Jezioro Długich Trzcin");
    expect((label?.fontSize ?? 0) * .75).toBeGreaterThanOrEqual(3.2);
  });

  it("keeps a location inside across lower zoom buckets while the full label remains readable", () => {
    const shape = { kind: "rectangle" as const, x: 0, y: 0, width: 100, height: 12 };
    const liveZoom = 1.04;
    const bucketZoom = quantizedLabelLayoutZoom(liveZoom);
    expect(regionLabelLayout("Teren", shape, bucketZoom, true)?.kind).toBe("inside");
    expect(regionLabelLayout("Teren", shape, conservativeQuantizedLabelLayoutZoom(liveZoom), true)?.kind).toBe("inside");
    expect(regionLabelLayout("Teren", shape, conservativeQuantizedLabelLayoutZoom(.91), true)?.kind).toBe("inside");
  });

  it("uses a boundary fallback only when the shape has no usable interior", () => {
    const label = regionLabelLayout("Teren bez głębokości", { kind: "rectangle", x: 0, y: 0, width: 20, height: 0 }, 1, true);
    expect(label?.kind).toBe("boundary");
  });

  it("keeps the readable name inside when the optional area no longer fits", () => {
    const label = regionLabelLayout({ name: "Parter bukszpanowy zachodni", area: "600 m²" }, { kind: "rectangle", x: 0, y: 0, width: 50, height: 5 }, 2, true);
    expect(label?.kind).toBe("inside");
    if (label?.kind !== "inside") return;
    expect(label.text).toBe("Parter bukszpanowy zachodni");
    expect(label.secondaryLine).toBeUndefined();
    expect(label.fontSize * 2).toBeGreaterThanOrEqual(3.2);
  });

  it("uses the boundary instead of colliding with an obstacle that fills the interior", () => {
    const shape = { kind: "rectangle" as const, x: 0, y: 0, width: 20, height: 10 };
    const label = regionLabelLayout("Dziedziniec", shape, 1, true, { obstacles: [{ outer: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }] }] });
    expect(label?.kind).toBe("boundary");
  });

  it("keeps a complete readable label inside a broad ellipse", () => {
    const label = regionLabelLayout("Dolina Brzasku", { kind: "ellipse", cx: 40, cy: 30, rx: 36, ry: 7 }, 1, true);
    expect(label?.kind).toBe("inside");
    if (label?.kind === "inside") expect(label.fontSize).toBeGreaterThanOrEqual(3.2);
  });

  it("keeps a terrain label out of a palace obstacle when free space exists", () => {
    const label = regionLabelLayout("Trawniki parkowe", { kind: "rectangle", x: -50, y: -30, width: 100, height: 60 }, 1, false, { obstacles: [{ outer: [{ x: -20, y: -15 }, { x: 20, y: -15 }, { x: 20, y: 15 }, { x: -20, y: 15 }] }] });
    expect(label?.kind).toBe("inside");
    if (label?.kind !== "inside") return;
    expect(label.x < -20 || label.x > 20 || label.y < -15 || label.y > 15).toBe(true);
  });

  it("prefers a smaller free lawn label when palace and terrace occupy the centre", () => {
    const label = regionLabelLayout("Trawniki parkowe", { kind: "rectangle", x: -50, y: -30, width: 100, height: 60 }, 1, false, { obstacles: [
      { outer: [{ x: -20, y: -15 }, { x: 20, y: -15 }, { x: 20, y: 15 }, { x: -20, y: 15 }] },
      { outer: [{ x: -32, y: -5 }, { x: 32, y: -5 }, { x: 32, y: 5 }, { x: -32, y: 5 }] },
    ] });
    expect(label?.kind).toBe("inside");
    if (label?.kind !== "inside") return;
    expect(label.x < -32 || label.x > 32 || label.y < -5 || label.y > 5).toBe(true);
    expect(label.fontSize).toBeLessThan(15);
  });

  it("retains the complete text in a miniature canvas", () => {
    const label = regionLabelLayout("Szatnia gości Łazienka", { kind: "rectangle", x: 0, y: 0, width: 1, height: 1 }, 20);
    expect(label?.kind).toBe("inside");
    expect(label?.text).toBe("Szatnia gości Łazienka");
    expect((label?.fontSize ?? 0) * 20).toBeLessThan(3.2);
  });

  it("moves a furniture label away from a room label when the furniture has free space", () => {
    const room = roomLabelLayout("Salon", { outer: [{ x: -10, y: -5 }, { x: 10, y: -5 }, { x: 10, y: 5 }, { x: -10, y: 5 }] }, 1);
    const furniture = roomLabelLayout("Fortepian", { outer: [{ x: -10, y: -2 }, { x: 10, y: -2 }, { x: 10, y: 2 }, { x: -10, y: 2 }] }, 1, { obstacles: room ? [labelObstacleForLayout(room)] : [] });
    expect(room && furniture).toBeTruthy();
    expect(Math.abs(furniture!.x - room!.x)).toBeGreaterThan(2);
  });

  it("chooses a safe anchor for a concave room face", () => {
    const label = roomLabelLayout("Biblioteka", { outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }] }, 1);
    expect(label).toBeTruthy();
    // The upper right quadrant is outside the L-shaped face and must never be the anchor.
    expect(label!.x > 4 && label!.y > 4).toBe(false);
  });

  it("rotates a two-line label obstacle around the label anchor", () => {
    const obstacle = labelObstacleForLayout({ text: "Sala", x: 10, y: 20, fontSize: 4, rotation: 90, textLength: 12, nameOffsetY: -1, secondaryLine: { text: "100 m²", offsetY: 5, fontSize: 2, textLength: 8 } });
    const center = obstacle.outer.reduce((sum, point) => ({ x: sum.x + point.x / obstacle.outer.length, y: sum.y + point.y / obstacle.outer.length }), { x: 0, y: 0 });
    expect(center.x).toBeCloseTo(8.525, 3);
    expect(center.y).toBeCloseTo(20, 3);
  });

  it("reuses unchanged room layout and invalidates it for geometry, zoom, text, and obstacles", () => {
    clearRoomLabelLayoutCache();
    const face = { outer: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }] };
    const obstacle = { outer: [{ x: 7, y: 3 }, { x: 13, y: 3 }, { x: 13, y: 9 }, { x: 7, y: 9 }] };
    const first = roomLabelLayout("Salon", face, 1, { obstacles: [obstacle] });
    expect(roomLabelLayout("Salon", face, 1, { obstacles: [obstacle] })).toBe(first);
    expect(roomLabelLayout("Salon", face, 1.1, { obstacles: [obstacle] })).not.toBe(first);
    expect(roomLabelLayout("Salon większy", face, 1, { obstacles: [obstacle] })).not.toBe(first);
    expect(roomLabelLayout("Salon", { ...face, outer: [...face.outer, { x: 0, y: 6 }] }, 1, { obstacles: [obstacle] })).not.toBe(first);
    expect(roomLabelLayout("Salon", face, 1, { obstacles: [{ ...obstacle, outer: obstacle.outer.map((point) => ({ ...point, x: point.x + 1 })) }] })).not.toBe(first);
  });

  it("freezes cached layouts so a caller cannot poison the next render", () => {
    clearRoomLabelLayoutCache();
    const face = { outer: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 15 }, { x: 0, y: 15 }] };
    const first = roomLabelLayout({ name: "Sala", area: "100 m²" }, face, 10);
    expect(first).toBeTruthy();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first?.secondaryLine)).toBe(true);
    expect(() => { (first as { fontSize: number }).fontSize = 999; }).toThrow();
    expect(roomLabelLayout({ name: "Sala", area: "100 m²" }, face, 10)).toEqual(first);
    expect(roomLabelLayout({ name: "Sala", area: "100 m²" }, face, 10)?.fontSize).not.toBe(999);
  });

  it("bounds label cache growth while retaining complete layouts", () => {
    clearRoomLabelLayoutCache();
    const face = { outer: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }] };
    for (let index = 0; index < 520; index += 1) roomLabelLayout(`Sala ${index}`, face, 1);
    expect(roomLabelLayoutCacheSize()).toBeLessThanOrEqual(512);
    expect(roomLabelLayout("Sala 519", face, 1)?.text).toBe("Sala 519");
  });

  it("reuses regions and invalidates changed region inputs", () => {
    clearRegionLabelLayoutCache();
    const shape = { kind: "rectangle" as const, x: 0, y: 0, width: 20, height: 12 };
    const first = regionLabelLayout("Trawnik", shape, 1, false);
    expect(regionLabelLayout("Trawnik", shape, 1, false)).toBe(first);
    expect(regionLabelLayout("Trawnik", shape, 1.1, false)).not.toBe(first);
    expect(regionLabelLayout("Trawnik zmieniony", shape, 1, false)).not.toBe(first);
    expect(regionLabelLayout("Trawnik", { ...shape, width: 21 }, 1, false)).not.toBe(first);
    expect(regionLabelLayoutCacheSize()).toBeLessThanOrEqual(512);
  });
});
