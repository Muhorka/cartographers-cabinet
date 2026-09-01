import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrawingElement } from "../model/project-model";
import { ElementShape } from "./map-sheet-shapes";
import styles from "./map-sheet.module.css";

function render(element: DrawingElement, selected = true) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<svg><ElementShape element={element} prefix="test" viewportZoom={2} pointRadius={2.5} resizeHandleSize={2.5} opacity={1} selectable showResizeHandles={selected} selected={selected} onSelect={() => undefined}/></svg>);
  return host;
}
function element(layerId: DrawingElement["layerId"], geometry: DrawingElement["geometry"]): DrawingElement {
  return { id: "path", name: "Path", belongsToId: "world", layerId, subjectId: layerId === "roads" ? "road.paved" : "sketch.line", geometry, visible: true, locked: false, tags: [], access: [], properties: {} };
}

describe("shared path selection and handles", () => {
  it.each(["roads", "sketch", "equipment"] as const)("uses common focus styling and keeps every anchor available for %s", (layer) => {
    const points = Array.from({ length: 40 }, (_, x) => ({ x, y: 0 }));
    const host = render(element(layer, { kind: "path", points, closed: false }));
    const target = host.querySelector('[role="button"]')!;
    expect(target.classList.contains(styles.element)).toBe(true);
    expect(target.classList.contains(styles.selected)).toBe(true);
    expect(target.getAttribute("tabindex")).toBe("0");
    const anchors = host.querySelectorAll('[data-region-polygon="0"][data-region-vertex]');
    expect(anchors).toHaveLength(40);
    expect(anchors[17].getAttribute("data-region-vertex")).toBe("17");
    expect(anchors[17].getAttribute("r")).toBe("1.25");
  });
  it("renders Bezier anchors and removes them when not selected", () => {
    const curve = element("sketch", { kind: "bezier", closed: false, nodes: [{ anchor: { x: 0, y: 0 }, outHandle: { x: 2, y: 3 } }, { anchor: { x: 4, y: 0 } }] });
    expect(render(curve).querySelectorAll("[data-region-vertex]")).toHaveLength(2);
    expect(render(curve, false).querySelectorAll("[data-region-vertex]")).toHaveLength(0);
  });
});
