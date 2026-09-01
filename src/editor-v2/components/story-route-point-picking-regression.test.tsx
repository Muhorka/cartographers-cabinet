import { act, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureMapPoint, capturePointPointer } from "./map-point-picker";
import { useStoryRouteInteraction } from "./use-story-route-interaction";
import { reviewFixture } from "../story/review/review-test-fixture";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

function pointerDown() {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  const target = document.createElementNS("http://www.w3.org/2000/svg", "path");
  Object.defineProperties(event, { button: { value: 0 }, pointerId: { value: 1 }, target: { value: target } });
  return event;
}

describe("route point-picking lifecycle regression", () => {
  it("keeps map-coordinate zero valid through the click capture adapter", () => {
    const onPick = vi.fn();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700, x: 0, y: 0, toJSON: () => ({}) });
    const target = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const event = { button: 0, clientX: 500, clientY: 350, target, currentTarget: svg, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as ReactMouseEvent<SVGSVGElement>;

    expect(captureMapPoint(event, { onPick, cancel: vi.fn() }, { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, { width: 1000, height: 700 })).toBe(true);
    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick.mock.calls[0][0]).toEqual({ x: 0, y: 0 });
  });

  it("shows the browser boundary: pointerdown is cancelled before click-only delivery", () => {
    const picker = { onPick: vi.fn(), cancel: vi.fn() };
    const down = pointerDown();

    expect(capturePointPointer(down as unknown as ReactPointerEvent<SVGSVGElement>, picker)).toBe(true);
    expect(down.defaultPrevented).toBe(true);
    expect(picker.onPick).not.toHaveBeenCalled();
  });

  it("keeps the live active level in the callback and accepts zero endpoints", () => {
    const project = reviewFixture();
    const props: Parameters<typeof useStoryRouteInteraction>[0] = { project, context: {}, mode: "story", owner: "route-editor", activePlaceId: "level" };
    let value!: ReturnType<typeof useStoryRouteInteraction>;
    function Harness() { value = useStoryRouteInteraction(props); return null; }
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host); mounted.push({ root, host });
    act(() => root.render(<Harness />));
    const accept = vi.fn();
    act(() => value.requestPoint("from", accept));
    act(() => value.pointPicker?.onPick({ x: 0, y: 0 }));

    expect(accept).toHaveBeenCalledExactlyOnceWith({ placeId: "level", point: { x: 0, y: 0 } });
  });
});
