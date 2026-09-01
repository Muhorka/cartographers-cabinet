import { describe, expect, it } from "vitest";
import { formatMapArea, mapLabelWithArea, mapRegionArea, mapRoomArea } from "./map-area";

describe("map area labels", () => {
  it("subtracts holes from a filled region", () => {
    expect(mapRoomArea({ outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], holes: [[{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 }]] })).toBeCloseTo(91);
  });
  it("does not invent an area for invalid geometry", () => {
    expect(mapRegionArea({ kind: "polygon", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).toBeUndefined();
  });
  it("formats labels in both unit systems", () => {
    expect(formatMapArea(12.4, "metric")).toBe("12 m²"); expect(formatMapArea(12.4, "imperial")).toBe("133 ft²");
    expect(mapLabelWithArea("Hall", 12.4, "metric", true)).toEqual({ name: "Hall", area: "12 m²" }); expect(mapLabelWithArea("Hall", undefined, "metric", true)).toBe("Hall");
  });
});
