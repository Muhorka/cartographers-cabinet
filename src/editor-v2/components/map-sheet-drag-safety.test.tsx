import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { selectionKey } from "../drawing/selection-reference";
import { MapSheet } from "./map-sheet";
import { pointerEvent, project } from "./map-sheet-test-fixture";

const copy = { ariaLabel: "Map", empty: "Empty", compass: "Rotate", zoomIn: "+", zoomOut: "-", resetView: "Reset", back: "Back" };

function mount(zoom = 1) {
  const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
  const onMoveSelection = vi.fn(); const onDeleteSelected = vi.fn();
  act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom, rotation: 0 }, copy, selectedIds: [selectionKey({ kind: "wall", id: "top", scopeId: "plan" })], selectionEditing: true, selectionLayerId: "construction", onMoveSelection, onDeleteSelected })));
  const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
  const target = container.querySelector('[data-selection-id="top"]')!;
  return { container, root, svg, target, onMoveSelection, onDeleteSelected, dispose: () => { act(() => root.unmount()); container.remove(); } };
}

describe("map selection drag safety", () => {
  it("keeps a shaky click below the screen-pixel threshold from moving at high zoom", () => {
    const view = mount(20);
    act(() => view.target.dispatchEvent(pointerEvent("pointerdown", 500, 350, 44)));
    act(() => view.svg.dispatchEvent(pointerEvent("pointermove", 504, 353, 44)));
    expect(view.target.parentElement?.getAttribute("transform")).toBeNull();
    act(() => view.svg.dispatchEvent(pointerEvent("pointerup", 504, 353, 44)));
    expect(view.onMoveSelection).not.toHaveBeenCalled(); view.dispose();
  });

  it("cancels an armed move when the mouse button is no longer pressed", () => {
    const view = mount();
    act(() => view.target.dispatchEvent(pointerEvent("pointerdown", 500, 350, 45)));
    act(() => view.svg.dispatchEvent(pointerEvent("pointermove", 540, 380, 45, "mouse", false, 0)));
    act(() => view.svg.dispatchEvent(pointerEvent("pointerup", 540, 380, 45)));
    expect(view.onMoveSelection).not.toHaveBeenCalled(); view.dispose();
  });

  it("abandons an active move when pointer capture is lost", () => {
    const view = mount();
    act(() => view.target.dispatchEvent(pointerEvent("pointerdown", 500, 350, 47)));
    act(() => view.svg.dispatchEvent(pointerEvent("pointermove", 540, 380, 47)));
    act(() => view.svg.dispatchEvent(pointerEvent("lostpointercapture", 540, 380, 47)));
    act(() => view.svg.dispatchEvent(pointerEvent("pointerup", 540, 380, 47)));
    expect(view.onMoveSelection).not.toHaveBeenCalled(); view.dispose();
  });

  it("does not delete another selection while a pointer move is armed", () => {
    const view = mount();
    act(() => view.target.dispatchEvent(pointerEvent("pointerdown", 500, 350, 46)));
    act(() => view.svg.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));
    act(() => view.svg.dispatchEvent(pointerEvent("pointerup", 500, 350, 46)));
    expect(view.onDeleteSelected).not.toHaveBeenCalled(); expect(view.onMoveSelection).not.toHaveBeenCalled(); view.dispose();
  });
});
