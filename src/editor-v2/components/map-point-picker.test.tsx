import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureMapPoint, capturePointPointer, type MapPointPicker } from "./map-point-picker";

const mounted: Array<{ root: Root; container: HTMLElement }> = [];
afterEach(() => { for (const { root, container } of mounted.splice(0)) { act(() => root.unmount()); container.remove(); } });
function fixture(picker?: MapPointPicker) {
  const select = vi.fn(); const draw = vi.fn();
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); mounted.push({ root, container });
  act(() => root.render(<svg aria-label="Map" role="img" onPointerDownCapture={(event) => capturePointPointer(event, picker)} onPointerDown={draw}
    onClickCapture={(event) => captureMapPoint(event, picker, { center: { x: 3, y: 4 }, rotation: 90, zoom: 2 }, { width: 100, height: 100 })}>
    <rect aria-label="Room" role="button" onClick={select}/><g data-viewport-dial="true" role="slider" aria-label="Rotate" onClick={select}/>
  </svg>));
  vi.spyOn(container.querySelector("svg")!, "getBoundingClientRect").mockReturnValue({ x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 120, width: 100, height: 100, toJSON: () => ({}) });
  const dispatch = (selector: string, type: string, options: MouseEventInit = {}) => act(() => { container.querySelector(selector)!.dispatchEvent(new MouseEvent(type, { bubbles: true, ...options })); });
  return { select, draw, dispatch };
}

describe("read-only map point picking", () => {
  it("converts zoomed rotated map coordinates without selecting or drawing an object", () => {
    const onPick = vi.fn(); const { select, draw, dispatch } = fixture({ onPick, cancel: vi.fn() });
    dispatch("rect", "pointerdown", { button: 0 });
    dispatch("rect", "click", { clientX: 80, clientY: 70, button: 0 });
    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick.mock.calls[0][0].x).toBeCloseTo(3); expect(onPick.mock.calls[0][0].y).toBeCloseTo(-6);
    expect(select).not.toHaveBeenCalled(); expect(draw).not.toHaveBeenCalled();
  });
  it("does not intercept normal editor input when no point was requested", () => {
    const { select, dispatch } = fixture(); dispatch("rect", "click"); expect(select).toHaveBeenCalledOnce();
  });
  it("leaves the compass available while picking a point", () => {
    const onPick = vi.fn(); const { select, dispatch } = fixture({ onPick, cancel: vi.fn() });
    dispatch("g", "click"); expect(onPick).not.toHaveBeenCalled(); expect(select).toHaveBeenCalledOnce();
  });
});
