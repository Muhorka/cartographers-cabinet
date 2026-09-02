import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ElementShape, PlaceShape } from "./map-sheet-shapes";
import { MapSheet } from "./map-sheet";
import { MapSheetSurfaces } from "./map-sheet-surfaces";
import { emptyProject } from "../model/project-model";
import { clearRegionLabelLayoutCache } from "../geometry/region-label-layout";
import { clearRoomLabelLayoutCache } from "../geometry/room-label-layout";

const square = { kind: "compound" as const, polygons: [{ outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], holes: [[{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 }]] }] };
const baseElement = { id: "pond", belongsToId: "world", name: "Pond", layerId: "terrain" as const, subjectId: "terrain.water", visible: true, locked: false, tags: [], access: [], properties: {} };

describe("map area label rendering", () => {
  it("keeps a location label inside when free geometry remains at a zoom bucket edge", () => {
    const project = emptyProject("p", "Project");
    project.places.push(
      { id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 140, height: 80 }, tags: [], access: [], properties: {} },
      { id: "lawn", parentId: "world", name: "Teren", kind: "location", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 12 }, tags: [], access: [], properties: {} },
    );
    const copy = { ariaLabel: "Story map", empty: "Nothing here", compass: "Rotate map", zoomIn: "Zoom in", zoomOut: "Zoom out", resetView: "Reset view", back: "Back", northMark: "N", openingLabel: (kind: string) => `Opening ${kind}`, transitionLabel: () => "Stairs" };
    const markup = renderToStaticMarkup(createElement(MapSheet, { project, activePlaceId: "world", viewport: { center: { x: 50, y: 6 }, zoom: 1.04, rotation: 0 }, copy }));
    expect(markup).toContain(">Teren</text>");
    expect(markup).not.toContain("boundaryLabel");
  });

  it.each(["building", "location", "level"] as const)("keeps the %s clip fixed while retaining its complete narrow label", (kind) => {
    const place = { id: kind, parentId: "world", name: "Budynek 1", kind, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle" as const, x: 0, y: 0, width: 3, height: 12 }, tags: [], access: [], properties: {} };
    const markup = renderToStaticMarkup(createElement(PlaceShape, { place, mode: "child", prefix: "t", viewportZoom: 8 }));
    expect(markup).toContain("Budynek 1");
    expect(markup).toMatch(/<g clip-path="url\(#[^"]+\)"><text|<text class="[^"]+boundaryLabel/);
    expect(markup).not.toMatch(/<text[^>]*clip-path=/);
  });

  it.each(["terrain", "equipment"] as const)("uses the same unrotated clip for %s regions", (layerId) => {
    const element = { ...baseElement, layerId, name: "Budynek 1", geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: 0, y: 0, width: 3, height: 12 } } };
    const markup = renderToStaticMarkup(createElement(ElementShape, { element, prefix: "t", viewportZoom: 8, pointRadius: 5, resizeHandleSize: 5, opacity: 1, selectable: false, showResizeHandles: false, selected: false }));
    expect(markup).toContain("Budynek 1");
    expect(markup).not.toMatch(/<text[^>]*clip-path=/);
    expect(markup).toContain("Budynek 1</text>");
  });

  it("keeps exact markup stable between cold and warm label layout", () => {
    const element = { ...baseElement, geometry: { kind: "region" as const, shape: square } };
    clearRegionLabelLayoutCache(); clearRoomLabelLayoutCache();
    const props = { element, prefix: "stable", viewportZoom: 10, pointRadius: 5, resizeHandleSize: 5, opacity: 1, selectable: false, showResizeHandles: false, selected: false, showArea: true, units: "metric" as const };
    const cold = renderToStaticMarkup(createElement(ElementShape, props));
    const warm = renderToStaticMarkup(createElement(ElementShape, props));
    expect(warm).toBe(cold);
  });

  it("renders areas for a building and a location using their own boundary", () => {
    const place = { id: "building", parentId: "world", name: "House", kind: "building" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: square, tags: [], access: [], properties: {} };
    const location = { ...place, id: "location", name: "Garden", kind: "location" as const };
    expect(renderToStaticMarkup(createElement(PlaceShape, { place, mode: "child", prefix: "t", viewportZoom: 10, showArea: true, units: "metric" }))).toMatch(/>House<\/text>[\s\S]*>91 m²<\/text>/);
    expect(renderToStaticMarkup(createElement(PlaceShape, { place: location, mode: "child", prefix: "t", viewportZoom: 10, showArea: true, units: "metric" }))).toMatch(/>Garden<\/text>[\s\S]*>91 m²<\/text>/);
  });

  it("renders an area for closed terrain, but not for an open stroke", () => {
    const closed = { ...baseElement, geometry: { kind: "region" as const, shape: square } };
    const open = { ...baseElement, id: "stream", name: "Stream", geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false } };
    const props = { prefix: "t", viewportZoom: 10, pointRadius: 5, resizeHandleSize: 5, opacity: 1, selectable: false, showResizeHandles: false, selected: false, showArea: true, units: "metric" as const };
    expect(renderToStaticMarkup(createElement(ElementShape, { ...props, element: closed }))).toMatch(/>Pond<\/text>[\s\S]*>91 m²<\/text>/);
    expect(renderToStaticMarkup(createElement(ElementShape, { ...props, element: open }))).not.toContain("m²");
  });

  it("renders an area for a construction surface", () => {
    const project = emptyProject("p", "Project"); project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.surfaces.push({ id: "terrace", belongsToId: "world", name: "Terrace", kind: "terrace", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} });
    const markup = renderToStaticMarkup(createElement(MapSheetSurfaces, { project, activePlaceId: "world", prefix: "t", selected: new Set<string>(), movingIds: new Set<string>(), selectionEditing: false, viewportZoom: 10, showArea: true, units: "metric" }));
    expect(markup).toMatch(/>Terrace<\/text>[\s\S]*>100 m²<\/text>/);
    expect(markup).toMatch(/<g clip-path="url\(#[^"]+\)"><text/);
    expect(markup).not.toMatch(/<text[^>]*clip-path=/);
  });
});
