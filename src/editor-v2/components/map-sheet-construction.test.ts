import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { roomLabelLayout } from "../geometry/room-label-layout";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { workbenchCopy } from "../i18n/workbench-copy";
import { createStarterProject } from "../model/starter-project";
import { MapSheetConstruction } from "./map-sheet-construction";
import { svgId } from "../geometry/svg-id";
import { selectionKey } from "../drawing/selection-reference";

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

  it("renders a scoped agent focus independently from the user's selection", () => {
    const project = createStarterProject("project", "Project", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const document = project.constructions.find(({ id }) => id === level.constructionId)!;
    const network = buildWallNetwork(document.walls);
    const room = document.rooms[0]!;
    const focusKey = selectionKey({ kind: "room", id: room.id, scopeId: document.id });
    const markup = renderToStaticMarkup(createElement(MapSheetConstruction, { project, document, network, owner: level, prefix: "test", copy, selectedIds: new Set<string>(), agentFocusedIds: new Set([focusKey]), viewportZoom: 8, roomView: false, roomScope: {}, activeGesture: false, selectionEditing: false, movingIds: new Set<string>() }));
    expect(markup).toContain('data-agent-focus-highlight="room"');
    expect(markup).not.toContain('data-selection-highlight="room"');
  });

  it("renders construction transitions as selectable construction features with style geometry", () => {
    const project = createStarterProject("project", "Project", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const document = project.constructions.find(({ id }) => id === level.constructionId)!;
    const network = buildWallNetwork(document.walls);
    const transition = { id: "stairs-test", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 1, y: 1, width: 5, height: 4 }, style: "u" as const, direction: 90, sourceLevelId: level.id, connectedLevelIds: [level.id] };
    const markup = renderToStaticMarkup(createElement(MapSheetConstruction, { project, document: { ...document, transitions: [transition] }, network, owner: level, prefix: "test", copy: { ...copy, transitionLabel: (_id: string, kind?: "stairs" | "elevator") => kind === "elevator" ? "Lift" : "Stairs" }, selectedIds: new Set<string>(), viewportZoom: 8, roomView: false, roomScope: {}, activeGesture: false, selectionEditing: true, selectionLayerId: "construction", movingIds: new Set<string>() }));
    expect(markup).toContain('data-selection-layer="construction"');
    expect(markup).toContain(`test-${svgId(document.id)}-stairs-${svgId(transition.id)}`);
    expect(markup.match(/class="[^"]*_tread_/g)?.length).toBeGreaterThan(10);
    expect(markup).toMatch(/class="[^"]*_flightEdge_/);
  });

  it("numbers unnamed doors and keeps one stair number across connected level landings", () => {
    const project = createStarterProject("numbered-map-features", "Numbered map features", "en");
    const groundLevel = project.places.find(({ kind }) => kind === "level")!;
    const source = project.constructions.find(({ id }) => id === groundLevel.constructionId)!;
    const upperLevel = { ...groundLevel, id: "upper-level", name: "Upper level", constructionId: "upper-plan" };
    const levels = [groundLevel.id, upperLevel.id];
    const groundStair = { id: "ground-stair", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 1, y: 1, width: 5, height: 4 }, sourceLevelId: groundLevel.id, connectedLevelIds: levels };
    const upperStair = { ...groundStair, id: "upper-stair", sourceLevelId: upperLevel.id };
    const groundDocument = {
      ...source,
      openings: [
        { id: "window-first", kind: "window" as const, wallId: source.walls[0]!.id, position: .25, width: 1 },
        { id: "door-second", kind: "door" as const, wallId: source.walls[0]!.id, position: .75, width: 1 },
      ],
      transitions: [
        { id: "other-stair", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 10, y: 1, width: 2, height: 2 }, sameLevelRise: true },
        groundStair,
      ],
    };
    const upperDocument = { ...source, id: "upper-plan", rooms: [], openings: [], transitions: [upperStair] };
    project.constructions = [groundDocument, upperDocument]; project.places.push(upperLevel);
    const network = buildWallNetwork(groundDocument.walls);
    const numberedCopy = workbenchCopy.en.map;
    const markup = renderToStaticMarkup(createElement(MapSheetConstruction, { project, document: groundDocument, network, owner: groundLevel, prefix: "test", copy: numberedCopy, selectedIds: new Set<string>(), viewportZoom: 8, roomView: false, roomScope: {}, activeGesture: false, selectionEditing: true, selectionLayerId: "construction", movingIds: new Set<string>(), contextTransitions: [{ transition: upperStair, scopeId: upperDocument.id, index: 0, transform: [1, 0, 0, 1, 0, 0] }] }));

    expect(markup).toContain('aria-label="Door 2"');
    expect(markup).toContain("<title>Door 2</title>");
    expect(markup).toContain('aria-label="Stairs 2"');
    expect(markup.match(/<title>Stairs 2<\/title>/g)).toHaveLength(2);
  });

  it("uses scoped Story names for door and stair map titles without changing their ids", () => {
    const project = createStarterProject("project", "Project", "en");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const source = project.constructions.find(({ id }) => id === level.constructionId)!;
    const opening = { id: "door-id", kind: "door" as const, wallId: source.walls[0]!.id, position: .5, width: 1 };
    const transition = { id: "stairs-id", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 1, y: 1, width: 5, height: 4 }, sourceLevelId: level.id, connectedLevelIds: [level.id] };
    const document = { ...source, openings: [opening], transitions: [transition] };
    project.constructions = project.constructions.map((candidate) => candidate.id === document.id ? document : candidate);
    project.story.objects = [
      { ref: { kind: "opening", id: opening.id, scopeId: level.id }, metadata: { narrativeLabel: "Library threshold" } },
      { ref: { kind: "transition", id: transition.id, scopeId: document.id }, metadata: { narrativeLabel: "Servants' stair" } },
    ];
    const network = buildWallNetwork(document.walls);
    const markup = renderToStaticMarkup(createElement(MapSheetConstruction, { project, document, network, owner: level, prefix: "test", copy: workbenchCopy.en.map, selectedIds: new Set<string>(), viewportZoom: 8, roomView: false, roomScope: {}, activeGesture: false, selectionEditing: true, selectionLayerId: "construction", movingIds: new Set<string>() }));

    expect(markup).toContain("Library threshold");
    expect(markup).toContain("Servants&#x27; stair");
    expect(markup).not.toContain("Door 1");
    expect(markup).not.toContain("Stairs 1");
    expect(markup).toContain('data-feature-id="door-id"');
    expect(markup).toContain('data-feature-id="stairs-id"');
  });
});
