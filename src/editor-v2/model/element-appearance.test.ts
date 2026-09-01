import { describe, expect, it } from "vitest";
import { defaultElementColor } from "./element-appearance";

describe("element appearance defaults", () => {
  it("uses green for vegetation while retaining layer fallbacks", () => {
    expect(defaultElementColor("equipment.vegetation")).toBe("#63835f");
    expect(defaultElementColor("equipment.monument")).toBe("#a99362");
    expect(defaultElementColor("terrain.custom", "#829664")).toBe("#829664");
  });
});
