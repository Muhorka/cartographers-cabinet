import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MapSheet } from "./map-sheet";
import { selectionKey } from "../drawing/selection-reference";
import { pointerEvent, project } from "./map-sheet-test-fixture";

const copy = { ariaLabel: "Story map", empty: "Nothing here", compass: "Rotate map", zoomIn: "Zoom in", zoomOut: "Zoom out", resetView: "Reset view", back: "Back", northMark: "N", openingLabel: (kind: string) => `Opening ${kind}`, transitionLabel: () => "Stairs" };
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("editor v2 Story map selection", () => {
  it("supports read-only Story selection across a painting and an opening", () => {
    const source = project();
    source.elements.push({ id: "painting", belongsToId: "floor", name: "Painting", layerId: "equipment", subjectId: "equipment.painting", geometry: { kind: "region", shape: { kind: "rectangle", x: 3, y: 3, width: 2, height: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onSelect = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: source, activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, selectionOnly: true, onSelect })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    const painting = container.querySelector('[data-selection-id="painting"]')!; const door = container.querySelector('[data-selection-id="door"]')!;
    act(() => painting.dispatchEvent(pointerEvent("pointerdown", 500, 350, 31))); act(() => painting.dispatchEvent(pointerEvent("pointerup", 500, 350, 31))); act(() => painting.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => door.dispatchEvent(pointerEvent("pointerdown", 520, 350, 32, "mouse", true))); act(() => door.dispatchEvent(pointerEvent("pointerup", 520, 350, 32, "mouse", true))); act(() => door.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })));
    expect(onSelect).toHaveBeenNthCalledWith(1, { kind: "element", id: "painting" }, undefined);
    expect(onSelect).toHaveBeenNthCalledWith(2, { kind: "opening", id: "door", scopeId: "plan" }, true);
    act(() => root.render(createElement(MapSheet, { project: source, activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, selectedIds: [selectionKey({ kind: "element", id: "painting" }), selectionKey({ kind: "opening", id: "door", scopeId: "plan" })], selectionOnly: true, onSelect })));
    expect(container.querySelector('[data-selection-id="painting"]')?.getAttribute("class")).toContain("selected");
    expect(container.querySelector('[data-selection-id="door"]')?.getAttribute("class")).toContain("selected");
    act(() => root.unmount()); container.remove();
  });

  it("keeps a Ctrl building hit ahead of the unlayered active sheet in Story", () => {
    const source = project();
    source.places.push({ id: "building", parentId: "world", name: "House", kind: "building", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 10, y: 10, width: 20, height: 15 }, tags: [], access: [], properties: {} });
    source.elements.push({ id: "painting", belongsToId: "world", name: "Painting", layerId: "equipment", subjectId: "equipment.painting", geometry: { kind: "region", shape: { kind: "rectangle", x: 12, y: 12, width: 3, height: 3 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onSelect = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: source, activePlaceId: "world", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, selectedIds: [selectionKey({ kind: "element", id: "painting" })], selectionOnly: true, onSelect })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    const building = container.querySelector<SVGElement>('[data-selection-id="building"]')!;
    const activeSheet = container.querySelector<SVGElement>('[data-selection-id="world"]')!;
    const original = document.elementsFromPoint; Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: () => [building, activeSheet] });
    try {
      act(() => building.dispatchEvent(pointerEvent("pointerdown", 500, 350, 41, "mouse", true)));
      expect(onSelect).toHaveBeenCalledWith({ kind: "place", id: "building" }, true);
    } finally {
      Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: original }); act(() => root.unmount()); container.remove();
    }
  });
});
