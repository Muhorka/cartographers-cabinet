import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MapSheet } from "./map-sheet";
import { pointerEvent, project } from "./map-sheet-test-fixture";
import { clientPointToMap } from "./map-sheet-gesture";
import { fitViewportToRegion, panViewport, visiblePlaceGroups, zoomViewport } from "./map-sheet-geometry";
import { createLevelForBuilding } from "../model/hierarchy-operations";
import { createStarterProject } from "../model/starter-project";
import { selectionKey } from "../drawing/selection-reference";

const copy = { ariaLabel: "Story map", empty: "Nothing here", compass: "Rotate map", zoomIn: "Zoom in", zoomOut: "Zoom out", resetView: "Reset view", back: "Back", northMark: "N", openingLabel: (kind: string) => `Opening ${kind}`, transitionLabel: () => "Stairs" };
const viewport = { center: { x: 50, y: 35 }, zoom: 1, rotation: 30 };
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("editor v2 map sheet", () => {
  it("fits an opened place to the parchment using its local boundary", () => {
    const fitted = fitViewportToRegion({ kind: "rectangle", x: -10, y: -5, width: 20, height: 10 });
    expect(fitted.center).toEqual({ x: 0, y: 0 }); expect(fitted.rotation).toBe(0); expect(fitted.zoom).toBeCloseTo(34);
  });
  it("shows direct contents and active-owned elements but keeps ancestor context inert", () => {
    const html = renderToStaticMarkup(createElement(MapSheet, { project: project(), activePlaceId: "estate", viewport, copy }));
    expect(html).toContain("Estate"); expect(html).toContain("Ground floor"); expect(html).toContain("Garden"); expect(html).toContain("Pond");
    expect(html).toContain('aria-hidden="true"'); expect(html.match(/<title>World<\/title>/g)).toHaveLength(1);
  });

  it("clips every region label to its own geometry and keeps the compass outside the rotating map group", () => {
    const html = renderToStaticMarkup(createElement(MapSheet, { project: project(), activePlaceId: "estate", viewport, copy }));
    expect(html).toMatch(/clip-path="url\(#.+place-floor\)"/); expect(html).toMatch(/element-pond-label-path/);
    expect(html.indexOf("rotate(30)")).toBeLessThan(html.indexOf("Ground floor"));
    expect(html.lastIndexOf("Rotate map")).toBeGreaterThan(html.indexOf("Ground floor"));
  });

  it("can hide the sketch overlay without hiding semantic map objects", () => {
    const html = renderToStaticMarkup(createElement(MapSheet, { project: project(), activePlaceId: "estate", viewport, copy, sketchVisible: false }));
    expect(html).not.toContain("Draft note"); expect(html).toContain("Pond");
  });

  it("renders a checkpoint as a read-only tracing over the current sheet", () => {
    const current = project(); const tracing = structuredClone(current);
    tracing.places.find(({ id }) => id === "estate")!.name = "Earlier estate";
    const html = renderToStaticMarkup(createElement(MapSheet, { project: current, activePlaceId: "estate", viewport, copy, tracingProject: tracing, tracingOpacity: .35 }));
    expect(html).toContain('data-tracing-overlay="true"');
    expect(html).toContain("Earlier estate");
  });

  it("renders rooms and walls from the same active construction document", () => {
    const html = renderToStaticMarkup(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport, copy, selectionEditing: true, selectionLayerId: "construction" }));
    expect(html).toContain("Hall"); expect(html).toContain('aria-label="top"'); expect(html).toContain('data-wall-role="boundary"'); expect(html).toContain('x1="0" y1="0" x2="20" y2="0"');
  });

  it("shows outline resize handles for an opened map, while a floor uses its exterior walls", () => {
    const mapHtml = renderToStaticMarkup(createElement(MapSheet, { project: project(), activePlaceId: "estate", viewport, copy, outlineEditing: true }));
    const floorHtml = renderToStaticMarkup(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport, copy, outlineEditing: true }));
    expect(mapHtml.match(/data-place-id="estate"/g)).toHaveLength(4); expect(floorHtml).not.toContain('data-place-id="floor"');
  });

  it("keeps levels in the hierarchy instead of drawing overlapping floor rectangles inside a building", () => {
    const starter = createStarterProject("starter", "Project", "en");
    const withUpper = createLevelForBuilding(starter, { id: "upper", constructionId: "upper-plan", buildingId: "starter:building", name: "Upper floor" }, { createId: (() => { let index = 0; return () => `upper-${++index}`; })() });
    const html = renderToStaticMarkup(createElement(MapSheet, { project: withUpper, activePlaceId: "starter:building", viewport, copy }));
    expect(html).not.toContain("Ground floor"); expect(html).not.toContain("Upper floor");
  });

  it("shows buildings two hierarchy steps below a world without leaking floor plans onto the world map", () => {
    const starter = createStarterProject("starter", "Project", "en");
    const groups = visiblePlaceGroups(starter, "starter:world");
    expect(groups.children.map(({ id }) => id)).toEqual(["starter:place"]);
    expect(groups.descendants.map(({ id }) => id)).toEqual(["starter:building"]);
    const html = renderToStaticMarkup(createElement(MapSheet, { project: starter, activePlaceId: "starter:world", viewport, copy }));
    expect(html).toContain("Cartographer&#x27;s house");
    expect(html).not.toContain("Ground floor");
    expect(html).not.toContain("Room 1");
  });

  it("lets a room use its own colour while an uncoloured room inherits the floor colour", () => {
    const base = project();
    const roomPlace = { id: "room", parentId: "floor", name: "Hall", kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle" as const, x: 0, y: 0, width: 20, height: 12 }, appearance: { fillColor: "#345678", fillOpacity: .61 }, tags: [], access: [], properties: {} };
    const custom = { ...base, places: [...base.places.map((place) => place.id === "floor" ? { ...place, appearance: { fillColor: "#bbaa77", fillOpacity: .4 } } : place), roomPlace] };
    const customHtml = renderToStaticMarkup(createElement(MapSheet, { project: custom, activePlaceId: "floor", viewport, copy }));
    expect(customHtml).toContain("fill:#345678;fill-opacity:0.61");
    const inherited = { ...custom, places: custom.places.map((place) => place.id === "room" ? { ...place, appearance: undefined } : place) };
    const inheritedHtml = renderToStaticMarkup(createElement(MapSheet, { project: inherited, activePlaceId: "floor", viewport, copy }));
    expect(inheritedHtml).toContain("fill:#bbaa77;fill-opacity:0.4");
  });

  it("anchors distinct opening marks to their walls and renders stair footprints", () => {
    const html = renderToStaticMarkup(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport, copy }));
    for (const kind of ["door", "window", "gate", "passage"]) expect(html).toContain(`data-opening-kind="${kind}"`);
    expect(html).toContain('data-feature-id="stairs"'); expect(html).toContain("Opening door"); expect(html).toContain("Stairs");
    expect(html).toContain("translate(5 0) rotate(0)");
  });

  it("reports opening and transition selection through the map callback", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onSelect = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport, copy, onSelect, selectionEditing: true, selectionLayerId: "openings" })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    for (const [id, pointerId] of [["door", 12], ["stairs", 13]] as const) { const target = container.querySelector(`[data-feature-id="${id}"]`)!; act(() => target.dispatchEvent(pointerEvent("pointerdown", 500, 350, pointerId))); act(() => svg.dispatchEvent(pointerEvent("pointerup", 500, 350, pointerId))); }
    expect(onSelect).toHaveBeenNthCalledWith(1, { kind: "opening", id: "door", scopeId: "plan" }, undefined); expect(onSelect).toHaveBeenNthCalledWith(2, { kind: "transition", id: "stairs", scopeId: "plan" }, undefined);
    act(() => root.unmount()); container.remove();
  });

  it("keeps Ctrl selection additive without toggling it twice on pointer down and click", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onSelect = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, selectedIds: [selectionKey({ kind: "wall", id: "right", scopeId: "plan" })], selectionEditing: true, selectionLayerId: "construction", onSelect })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    const top = container.querySelector('[data-selection-id="top"]')!;
    act(() => top.dispatchEvent(pointerEvent("pointerdown", 500, 350, 3, "mouse", true)));
    act(() => top.dispatchEvent(pointerEvent("pointerup", 500, 350, 3, "mouse", true)));
    act(() => top.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })));
    expect(onSelect).toHaveBeenCalledTimes(1); expect(onSelect).toHaveBeenCalledWith({ kind: "wall", id: "top", scopeId: "plan" }, true);
    act(() => root.unmount()); container.remove();
  });

  it("prefers the active layer and lets Ctrl reach an unselected object underneath", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onSelect = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, selectedIds: [selectionKey({ kind: "opening", id: "door", scopeId: "plan" })], selectionEditing: true, selectionLayerId: "openings", onSelect })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    const door = container.querySelector<SVGElement>('[data-selection-id="door"]')!; const room = container.querySelector<SVGElement>('[data-selection-id="room"]')!;
    const original = document.elementsFromPoint; Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: () => [room, door] });
    act(() => room.dispatchEvent(pointerEvent("pointerdown", 500, 350, 23, "mouse", true)));
    expect(onSelect).toHaveBeenCalledWith({ kind: "room", id: "room", scopeId: "plan" }, true);
    Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: original }); act(() => root.unmount()); container.remove();
  });

  it("previews a dragged selection continuously and commits it only on pointer release", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onMoveSelection = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, selectedIds: [selectionKey({ kind: "wall", id: "top", scopeId: "plan" })], selectionEditing: true, selectionLayerId: "construction", onMoveSelection })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    const top = container.querySelector('[data-selection-id="top"]')!;
    act(() => top.dispatchEvent(pointerEvent("pointerdown", 500, 350, 4)));
    act(() => svg.dispatchEvent(pointerEvent("pointermove", 525, 365, 4)));
    expect(container.querySelector('[data-selection-id="top"]')?.parentElement?.getAttribute("transform")).toBe("translate(25 15)");
    expect(onMoveSelection).not.toHaveBeenCalled();
    act(() => svg.dispatchEvent(pointerEvent("pointerup", 525, 365, 4)));
    expect(onMoveSelection).toHaveBeenCalledWith({ kind: "wall", id: "top", scopeId: "plan" }, { x: 25, y: 15 });
    act(() => root.unmount()); container.remove();
  });

  it("deletes the current selection from the keyboard without hiding the inspector action", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onDeleteSelected = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport, copy, selectedIds: [selectionKey({ kind: "opening", id: "door", scopeId: "plan" })], selectionEditing: true, selectionLayerId: "openings", onDeleteSelected })));
    act(() => container.querySelector("svg")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));
    expect(onDeleteSelected).toHaveBeenCalledOnce();
    act(() => root.unmount()); container.remove();
  });

  it("selects several same-layer objects with the visible area-selection tool", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onSelectMany = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, selectionEditing: true, selectionMode: "marquee", selectionLayerId: "construction", onSelectMany })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    const top = container.querySelector('[data-selection-id="top"]')!; const right = container.querySelector('[data-selection-id="right"]')!;
    Object.defineProperty(top, "getBoundingClientRect", { value: () => ({ left: 20, top: 20, right: 80, bottom: 30, width: 60, height: 10 }) });
    Object.defineProperty(right, "getBoundingClientRect", { value: () => ({ left: 200, top: 20, right: 210, bottom: 80, width: 10, height: 60 }) });
    act(() => svg.dispatchEvent(pointerEvent("pointerdown", 10, 10))); act(() => svg.dispatchEvent(pointerEvent("pointermove", 100, 100))); act(() => svg.dispatchEvent(pointerEvent("pointerup", 100, 100)));
    expect(onSelectMany).toHaveBeenCalledWith([{ kind: "wall", id: "top", scopeId: "plan" }]);
    act(() => root.unmount()); container.remove();
  });

  it("collects only direct editable contents while exposing siblings and ancestors as context", () => {
    const groups = visiblePlaceGroups(project(), "floor");
    expect(groups.children).toEqual([]); expect(groups.context.map(({ id }) => id)).toEqual(expect.arrayContaining(["estate", "garden", "world"]));
  });

  it("pans in map coordinates and zooms around the cursor without a narrow zoom ceiling", () => {
    expect(panViewport(viewport, { x: 10, y: 0 }).center.x).toBeLessThan(viewport.center.x);
    const zoomed = zoomViewport(viewport, 100, { x: 900, y: 350 }, { x: 500, y: 350 });
    expect(zoomed.zoom).toBe(100); expect(zoomed.center).not.toEqual(viewport.center);
  });

  it("captures the mouse wheel with a non-passive listener while zooming the map", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onViewportChange = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport, copy, onViewportChange })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) });
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: 600, clientY: 350, deltaY: 120 });
    let accepted = true; act(() => { accepted = svg.dispatchEvent(wheel); });
    expect(accepted).toBe(false); expect(wheel.defaultPrevented).toBe(true);
    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: expect.any(Number) }));
    expect(onViewportChange.mock.calls[0][0].zoom).toBeLessThan(viewport.zoom);
    act(() => root.unmount()); container.remove();
  });

  it("converts screen points through sheet fitting, zoom and rotation", () => {
    const converted = clientPointToMap({ x: 620, y: 350 }, { left: 0, top: 0, width: 1200, height: 700 }, { width: 1000, height: 700 }, { center: { x: 50, y: 35 }, zoom: 2, rotation: 90 });
    expect(converted.x).toBeCloseTo(50); expect(converted.y).toBeCloseTo(25);
  });

  it("uses two touch points to pan, zoom and rotate without leaving a drawing stroke behind", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onViewportChange = vi.fn(); const onGesture = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, interaction: { enabled: true, instrumentId: "line" }, onViewportChange, onGesture })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    act(() => svg.dispatchEvent(pointerEvent("pointerdown", 450, 350, 1, "touch"))); act(() => svg.dispatchEvent(pointerEvent("pointerdown", 550, 350, 2, "touch"))); act(() => svg.dispatchEvent(pointerEvent("pointermove", 650, 350, 2, "touch")));
    act(() => svg.dispatchEvent(pointerEvent("pointerup", 650, 350, 2, "touch"))); act(() => svg.dispatchEvent(pointerEvent("pointerup", 450, 350, 1, "touch")));
    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 2 })); expect(onGesture).not.toHaveBeenCalled();
    act(() => root.unmount()); container.remove();
  });

  it("previews and returns a two-point gesture in map coordinates", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onGesture = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, interaction: { enabled: true, instrumentId: "line" }, onGesture })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    act(() => svg.dispatchEvent(pointerEvent("pointerdown", 500, 350))); act(() => svg.dispatchEvent(pointerEvent("pointermove", 520, 370)));
    expect(container.innerHTML).toContain("M 0 0 L 20 20");
    act(() => svg.dispatchEvent(pointerEvent("pointerup", 520, 370)));
    expect(onGesture).toHaveBeenCalledWith({ instrumentId: "line", points: [{ x: 0, y: 0 }, { x: 20, y: 20 }], snapTolerance: 2.5, hitRadius: 10 });
    act(() => root.unmount()); container.remove();
  });

  it("collects polygon vertices until explicit Enter confirmation", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onGesture = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, interaction: { enabled: true, instrumentId: "polygon" }, onGesture })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) });
    for (const [x, y] of [[500, 350], [530, 350], [530, 380]]) act(() => svg.dispatchEvent(pointerEvent("pointerdown", x, y)));
    expect(onGesture).not.toHaveBeenCalled(); act(() => svg.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onGesture).toHaveBeenCalledWith({ instrumentId: "polygon", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }], snapTolerance: 2.5, hitRadius: 10 });
    act(() => root.unmount()); container.remove();
  });

  it("confirms an open wall run with Enter", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onGesture = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, interaction: { enabled: true, instrumentId: "wall-run" }, onGesture })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) });
    for (const [x, y] of [[500, 350], [530, 350], [530, 380]]) act(() => svg.dispatchEvent(pointerEvent("pointerdown", x, y)));
    act(() => svg.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onGesture).toHaveBeenCalledWith(expect.objectContaining({ instrumentId: "wall-run", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }] }));
    act(() => root.unmount()); container.remove();
  });

  it("keeps Bezier anchors as a protected draft and confirms them with Enter", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onGesture = vi.fn(); const onDraft = vi.fn();
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, interaction: { enabled: true, instrumentId: "pen" }, onGesture, onGestureDraftChange: onDraft })));
    const svg = container.querySelector("svg")!; Object.defineProperty(svg, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 700 }) }); Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    for (const [x, y] of [[500, 350], [530, 350], [530, 380]]) { act(() => svg.dispatchEvent(pointerEvent("pointerdown", x, y))); act(() => svg.dispatchEvent(pointerEvent("pointerup", x, y))); }
    const latest = onDraft.mock.calls.at(-1)?.[0];
    act(() => root.render(createElement(MapSheet, { project: project(), activePlaceId: "floor", viewport: { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 }, copy, interaction: { enabled: true, instrumentId: "pen" }, gestureDraft: latest, onGesture, onGestureDraftChange: onDraft })));
    act(() => container.querySelector("svg")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onGesture).toHaveBeenCalledWith(expect.objectContaining({ instrumentId: "pen", closed: false, points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }] }));
    act(() => root.unmount()); container.remove();
  });
});
