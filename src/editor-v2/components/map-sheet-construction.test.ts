import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { roomLabelLayout } from "../geometry/room-label-layout";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { createStarterProject } from "../model/starter-project";
import { MapSheetConstruction } from "./map-sheet-construction";

const copy = { ariaLabel: "Map", empty: "Empty", compass: "Compass", zoomIn: "Zoom in", zoomOut: "Zoom out", resetView: "Reset", back: "Back" };

describe("room labels", () => {
  it("keeps the complete default name when the room is tiny", () => {
    const label = roomLabelLayout("Pomieszczenie 7", { outer: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }] }, 10);
    expect(label?.text).toBe("Pomieszczenie 7");
    expect((label?.fontSize ?? 0) * 10).toBeLessThan(3.2);
  });

  it("follows a diagonal room when the complete horizontal label cannot fit", () => {
    const label = roomLabelLayout("Długa galeria", { outer: [{ x: 0, y: 0 }, { x: 18, y: 14 }, { x: 16, y: 17 }, { x: -2, y: 3 }] }, 6);
    expect(label?.text).toBe("Długa galeria");
    expect(Math.abs(label?.rotation ?? 0)).toBeGreaterThan(20);
  });

  it("clips a room label to a room with a courtyard hole", () => {
    const project = createStarterProject("project", "Project", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const document = project.constructions.find(({ id }) => id === level.constructionId)!;
    const network = buildWallNetwork(document.walls);
    const face = network.faces[0];
    const holedNetwork = { ...network, faces: [{ ...face, holes: [[{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: 2, y: 2 }, { x: -2, y: 2 }]] }] };
    const markup = renderToStaticMarkup(createElement(MapSheetConstruction, { project, document: { ...document, rooms: [{ ...document.rooms[0], faceId: face.id }] }, network: holedNetwork, owner: level, prefix: "test", copy, selectedIds: new Set<string>(), viewportZoom: 8, roomView: false, roomScope: {}, activeGesture: false, selectionEditing: false, movingIds: new Set<string>() }));
    expect(markup).toContain('clip-path="url(#test-room-');
    expect(markup).toMatch(/<g clip-path="url\(#test-room-[^"]+\)"><text/);
    expect(markup).not.toMatch(/<text[^>]*clip-path=/);
  });

  it("renders construction transitions as selectable construction features with style geometry", () => {
    const project = createStarterProject("project", "Project", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const document = project.constructions.find(({ id }) => id === level.constructionId)!;
    const network = buildWallNetwork(document.walls);
    const transition = { id: "stairs-test", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 1, y: 1, width: 5, height: 4 }, style: "u" as const, direction: 90, sourceLevelId: level.id, connectedLevelIds: [level.id] };
    const markup = renderToStaticMarkup(createElement(MapSheetConstruction, { project, document: { ...document, transitions: [transition] }, network, owner: level, prefix: "test", copy: { ...copy, transitionLabel: (_id: string, kind?: "stairs" | "elevator") => kind === "elevator" ? "Lift" : "Stairs" }, selectedIds: new Set<string>(), viewportZoom: 8, roomView: false, roomScope: {}, activeGesture: false, selectionEditing: true, selectionLayerId: "construction", movingIds: new Set<string>() }));
    expect(markup).toContain('data-selection-layer="construction"');
    expect(markup).toContain("test-stairs-stairs-test");
    expect(markup.match(/class="[^"]*_tread_/g)?.length).toBeGreaterThan(10);
    expect(markup).toMatch(/class="[^"]*_flightEdge_/);
  });
});
