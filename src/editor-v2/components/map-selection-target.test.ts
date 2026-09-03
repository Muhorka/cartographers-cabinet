import { describe, expect, it } from "vitest";
import { chooseSelectableCandidate, type SelectableCandidate } from "./map-selection-target";
import { selectionKey } from "../drawing/selection-reference";

function candidate(id: string, kind: string, layer?: string) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "g");
  element.dataset.selectable = "true";
  element.dataset.selectionId = id;
  element.dataset.selectionKind = kind;
  if (layer) element.dataset.selectionLayer = layer;
  return element as SelectableCandidate;
}

describe("common map selection target policy", () => {
  it("prefers the active layer for replacement selection", () => {
    const building = candidate("building", "place", "buildings");
    const object = candidate("painting", "element", "equipment");
    expect(chooseSelectableCandidate([object, building], { selectionLayerId: "buildings", selected: new Set(), additive: false })).toBe(building);
  });

  it("uses the next unselected mixed-kind hit for additive selection", () => {
    const building = candidate("building", "place", "buildings");
    const object = candidate("painting", "element", "equipment");
    expect(chooseSelectableCandidate([object, building], { selectionLayerId: "buildings", selected: new Set([selectionKey({ kind: "place", id: "building" })]), additive: true })).toBe(object);
  });

  it("keeps Story's no-active-layer order while adding a building and another object", () => {
    const building = candidate("building", "place", "buildings");
    const object = candidate("painting", "element", "equipment");
    expect(chooseSelectableCandidate([object, building], { selected: new Set(), additive: false })).toBe(object);
    expect(chooseSelectableCandidate([building, object], { selected: new Set([selectionKey({ kind: "place", id: "building" })]), additive: true })).toBe(object);
  });

  it("does not treat an unlayered active sheet as Story's active layer", () => {
    const building = candidate("building", "place", "buildings");
    const activeSheet = candidate("floor", "place");
    expect(chooseSelectableCandidate([building, activeSheet], { selected: new Set(["painting"]), additive: true })).toBe(building);
  });
});
