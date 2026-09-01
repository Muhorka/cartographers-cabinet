import { describe, expect, it } from "vitest";
import { nextMapSelection } from "./workbench-helpers";
import type { MapSelection } from "./map-sheet-types";

describe("shared workbench selection policy", () => {
  const room: MapSelection = { kind: "room", id: "one" };
  const element: MapSelection = { kind: "element", id: "one" };
  it("keeps mixed-kind selection, toggles only the exact object and never mutates input", () => {
    const selected = [room, element];
    expect(nextMapSelection(selected, room)).toBe(selected);
    expect(nextMapSelection(selected, room, true)).toEqual([element]);
    expect(nextMapSelection([room], element, true)).toEqual(selected);
    expect(selected).toEqual([room, element]);
  });
  it("supports replacement and deselection without changing the original array", () => {
    const selected = [room];
    expect(nextMapSelection(selected, element)).toEqual([element]);
    expect(nextMapSelection(selected)).toEqual([]);
    expect(selected).toEqual([room]);
  });
});
