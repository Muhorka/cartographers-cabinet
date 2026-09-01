import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { MapSheet } from "./map-sheet";

const copy = { ariaLabel: "Story map", empty: "Nothing here", compass: "Rotate map", zoomIn: "Zoom in", zoomOut: "Zoom out", resetView: "Reset view", back: "Back", northMark: "N" };

describe("map sheet arc interaction", () => {
  it("commits start, bend and end as an ordinary Bézier gesture", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onGesture = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: createStarterProject("project", "Project", "en"), activePlaceId: "project:world", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, interaction: { enabled: true, instrumentId: "arc" }, onGesture })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) });
    for (const [x, y] of [[500, 350], [520, 330], [540, 350]]) act(() => svg.dispatchEvent(pointerEvent("pointerdown", x, y)));
    expect(onGesture).toHaveBeenCalledWith(expect.objectContaining({ instrumentId: "arc", points: expect.any(Array), bezierNodes: expect.any(Array), closed: false }));
    expect(onGesture.mock.calls[0][0].bezierNodes.length).toBeGreaterThanOrEqual(3);
    act(() => root.unmount()); container.remove();
  });
});

function pointerEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true }); Object.defineProperties(event, { pointerId: { value: 9 }, pointerType: { value: "mouse" }, clientX: { value: clientX }, clientY: { value: clientY }, ctrlKey: { value: false }, metaKey: { value: false }, shiftKey: { value: false } }); return event;
}
