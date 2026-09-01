import { describe, expect, it } from "vitest";
import { applyOutlineGesture } from "../components/drawing-outline-gesture";
import { applyMapGesture, savePendingDraftAsPath } from "../drawing/map-gesture-command";
import type { SemanticDraft } from "../draft/semantic-draft";
import { createStarterProject } from "../model/starter-project";
import { buildDrawingChange } from "../webmcp/agent-drawing-command";

const points = [{ x: 0, y: 0 }, { x: 5, y: 4 }, { x: 10, y: 0 }];

function projectWithSmoothing(strength: number) {
  const project = createStarterProject("project", "Project", "en");
  return { ...project, measureSettings: { ...project.measureSettings, pencilSmoothing: strength } };
}

function identity() {
  let id = 0;
  return { createId: () => `pencil-${++id}`, createRoomName: (index: number) => `Room ${index}` };
}

const naming = { nameFor: (subject: string, index: number) => `${subject} ${index}`, levelName: () => "Ground floor" };

function road(project: ReturnType<typeof projectWithSmoothing>) {
  const result = applyMapGesture(project, { activePlaceId: "project:world", layerId: "roads", subjectId: "road.paved", boundaryEditing: false, gesture: { instrumentId: "pencil", points } }, identity(), naming);
  expect(result.state).toBe("applied");
  if (result.state !== "applied") throw new Error("road was not created");
  const element = result.project.elements.at(-1);
  expect(element?.geometry.kind).toBe("path");
  if (element?.geometry.kind !== "path") throw new Error("road did not use a path");
  return element.geometry.points;
}

describe("shared pencil smoothing ingress", () => {
  it("uses one setting for UI-command and WebMCP roads and keeps endpoints", () => {
    const project = projectWithSmoothing(.8);
    const ui = road(project);
    const agent = buildDrawingChange(project, "project:world", { ownerId: "project:world", layerId: "roads", subjectId: "road.paved", instrumentId: "pencil", points, widthMeters: 6 }).project.elements.at(-1)!;
    expect(agent.geometry).toEqual({ kind: "path", points: ui, closed: false });
    expect(ui[0]).toEqual(points[0]);
    expect(ui.at(-1)).toEqual(points.at(-1));
    expect(ui[1]).not.toEqual(points[1]);
  });

  it("applies smoothing to an open terrain path before either UI save or WebMCP commit", () => {
    const project = projectWithSmoothing(.8);
    const input = { activePlaceId: "project:world" as const, layerId: "terrain" as const, subjectId: "terrain.water", boundaryEditing: false, gesture: { instrumentId: "pencil" as const, points } };
    const result = applyMapGesture(project, input, identity(), naming);
    expect(result.state).toBe("draft-updated");
    if (result.state !== "draft-updated") throw new Error("terrain draft was not retained");
    const uiProject = savePendingDraftAsPath(project, result.pendingDraft as SemanticDraft, identity(), naming);
    const agentProject = buildDrawingChange(project, "project:world", { ownerId: "project:world", layerId: "terrain", subjectId: "terrain.water", instrumentId: "pencil", points }).project;
    expect(uiProject.elements.at(-1)?.geometry).toEqual(agentProject.elements.at(-1)?.geometry);
  });

  it("uses the setting for freehand construction walls and outline additions", () => {
    const project = projectWithSmoothing(.8);
    const construction = applyMapGesture(project, { activePlaceId: "project:level", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "pencil", points: [{ x: 0, y: -9 }, { x: 5, y: 0 }, { x: 0, y: 9 }] } }, identity(), naming);
    expect(construction.state).toBe("applied");
    if (construction.state !== "applied") throw new Error("construction was not created");
    const walls = construction.project.constructions[0].walls;
    expect(walls.at(-2)?.end.x).not.toBe(5);
    expect(walls.at(-2)?.end.y).toBe(0);

    const target = { kind: "place" as const, id: "project:building" };
    const outline = applyOutlineGesture(project, "project:building", target, { instrumentId: "pencil", points: [{ x: 14, y: -2 }, { x: 18, y: -2 }, { x: 18, y: 2 }, { x: 14, y: 2 }] }, identity(), "add");
    expect(outline.state).toBe("applied");
  });
});
