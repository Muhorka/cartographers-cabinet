import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { MapSheet } from "./map-sheet";
import { MapGesturePreview } from "./map-gesture-preview";

const copy = { ariaLabel: "Map", empty: "Empty", compass: "Rotate", zoomIn: "+", zoomOut: "-", resetView: "Reset", back: "Back" };
const viewport = { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 };
function pointer(type: string, x: number, y: number, buttons = type === "pointerup" || type === "pointercancel" ? 0 : 1) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: "mouse" }, button: { value: 0 }, buttons: { value: buttons }, clientX: { value: x }, clientY: { value: y } }); return event;
}
function mount(props: Partial<Parameters<typeof MapSheet>[0]> = {}) {
  const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
  const project = createStarterProject("p", "Test", "en");
  act(() => root.render(createElement(MapSheet, { project, activePlaceId: "p:world", viewport, copy, ...props })));
  const svg = container.querySelector("svg")!;
  Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) });
  Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
  return { container, root, svg, dispose: () => { act(() => root.unmount()); container.remove(); } };
}
describe("shared pointer feedback", () => {
  it("focuses the drawing canvas without allowing page scroll before mapping a gesture", () => {
    const onGesture = vi.fn();
    const view = mount({ interaction: { enabled: true, instrumentId: "line" }, onGesture });
    const focus = vi.spyOn(view.svg, "focus");
    act(() => view.svg.dispatchEvent(pointer("pointerdown", 503, 352)));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    act(() => view.svg.dispatchEvent(pointer("pointerup", 507, 356)));
    expect(onGesture).toHaveBeenCalledOnce();
    view.dispose();
  });

  it("rotates from one shared handle without starting movement or drawing", () => {
    const onPreview = vi.fn(); const onCommit = vi.fn(); const onCancel = vi.fn(); const onMoveSelection = vi.fn();
    const view = mount({ selectionEditing: true, onMoveSelection, rotationControl: { center: { x: 0, y: 0 }, top: -20, label: "Rotate selection", onPreview, onCommit, onCancel } });
    const handle = view.container.querySelector('[data-selection-rotation="true"]')!;
    const focus = vi.fn();
    Object.defineProperties(handle, { focus: { value: focus }, setPointerCapture: { value: vi.fn() }, hasPointerCapture: { value: () => true }, releasePointerCapture: { value: vi.fn() } });
    act(() => handle.dispatchEvent(pointer("pointerdown", 500, 308)));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    act(() => handle.dispatchEvent(pointer("pointermove", 542, 350)));
    expect(onPreview).toHaveBeenLastCalledWith(90);
    act(() => handle.dispatchEvent(pointer("pointerup", 542, 350)));
    expect(onCommit).toHaveBeenCalledWith(90); expect(onMoveSelection).not.toHaveBeenCalled();
    act(() => handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onCancel).toHaveBeenCalled(); view.dispose();
  });

  it("keeps eraser preview and committed trace under the pointer even when grid snapping is enabled", () => {
    const project = createStarterProject("p", "Test", "en"); project.measureSettings.snapToGrid = true; project.measureSettings.gridSpacingMeters = 10;
    const onGesture = vi.fn(); const view = mount({ project, interaction: { enabled: true, instrumentId: "erase" }, onGesture });
    act(() => view.svg.dispatchEvent(pointer("pointerdown", 503, 352)));
    act(() => view.svg.dispatchEvent(pointer("pointermove", 507, 356)));
    const tip = view.container.querySelector('circle[cx="7"][cy="6"]'); expect(tip).not.toBeNull();
    expect(view.container.querySelector('[data-drawing="true"]')).not.toBeNull();
    act(() => view.svg.dispatchEvent(pointer("pointerup", 507, 356)));
    expect(onGesture).toHaveBeenCalledWith(expect.objectContaining({ points: [{ x: 3, y: 2 }, { x: 7, y: 6 }] })); view.dispose();
  });
  it("previews insertion at the line, intercepts selection and ignores distant clicks", () => {
    const insertAt = vi.fn(); const cancel = vi.fn(); const onSelect = vi.fn();
    const view = mount({ selectionEditing: true, onSelect, nodeInsertion: { active: true, previewAt: (p) => ({ x: p.x, y: 0 }), insertAt, cancel } });
    const focus = vi.spyOn(view.svg, "focus");
    act(() => view.svg.dispatchEvent(pointer("pointermove", 537, 353)));
    expect(view.container.querySelector('[data-node-insertion-preview]')?.getAttribute("cx")).toBe("37");
    act(() => view.svg.dispatchEvent(pointer("pointerdown", 537, 353)));
    expect(insertAt).toHaveBeenCalledWith({ x: 37, y: 3 }); expect(onSelect).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    act(() => view.svg.dispatchEvent(pointer("pointerdown", 537, 420))); expect(insertAt).toHaveBeenCalledTimes(1);
    act(() => view.svg.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(cancel).toHaveBeenCalledOnce(); view.dispose();
  });
  it("reuses the pencil tip DOM node and avoids a cloud of markers on every sample", () => {
    const container = document.createElement("div"); const root = createRoot(container);
    const render = (y: number) => act(() => root.render(createElement("svg", null, createElement(MapGesturePreview, { draft: { instrumentId: "pencil", points: [{ x: 0, y: 0 }, { x: 2, y: 4 }, { x: 4, y }] }, viewportZoom: 1, eraserSize: 10 }))));
    render(3); const tip = container.querySelectorAll("circle")[1]; render(6);
    expect(container.querySelectorAll("circle")).toHaveLength(2); expect(container.querySelectorAll("circle")[1]).toBe(tip);
    expect(container.querySelector("path")?.style.fill).toBe("none"); act(() => root.unmount());
  });
});
