import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { emptyStoryData } from "./types";
import { displayProject } from "./project-view";

function fixture(): EditorProject {
  const project = emptyProject("view", "Display view");
  project.places.push(
    { id: "level", name: "Ground", description: "Base ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: "plan", tags: [], access: [], properties: {} },
    { id: "room", name: "Native room", description: "Native description", parentId: "level", kind: "room", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
  );
  project.constructions.push({ id: "plan", revision: 0, walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "boundary", thickness: .2 }], rooms: [{ id: "room", faceId: "face", name: "Native room", description: "Native description", tags: [], access: [], properties: {} }], openings: [], transitions: [] });
  project.story = { ...emptyStoryData(), scenarios: [{ id: "night", name: "Night", patches: [
    { id: "level-text", target: { kind: "place", id: "level" }, title: "Night level", description: "Night description" },
    { id: "room-text", target: { kind: "room", id: "room", scopeId: "level" }, title: "Night room" },
  ], steps: [{ id: "dawn", name: "Dawn", patches: [{ id: "room-step", target: { kind: "room", id: "room", scopeId: "level" }, title: "Dawn room", description: "" }] }] }] };
  return project;
}

describe("display-only Story project view", () => {
  it("leaves the base project unchanged and keeps neutral display text native", () => {
    const project = fixture(); const display = displayProject(project);
    expect(display).toBe(project); expect(display.places.find(({ id }) => id === "level")?.name).toBe("Ground"); expect(project.places.find(({ id }) => id === "level")?.name).toBe("Ground");
  });

  it("materializes scenario text on canonical room scopes without touching geometry", () => {
    const project = fixture(); const display = displayProject(project, { scenarioId: "night" });
    expect(display.places.find(({ id }) => id === "level")).toMatchObject({ name: "Night level", description: "Night description" });
    expect(display.places.find(({ id }) => id === "room")?.name).toBe("Night room"); expect(display.constructions[0]?.rooms[0]?.name).toBe("Night room");
    expect(display.constructions[0]?.walls).toBe(project.constructions[0]?.walls);
    expect(display.constructions[0]?.walls).toEqual(project.constructions[0]?.walls); expect(project.constructions[0]?.rooms[0]?.name).toBe("Native room");
    const stepDisplay = displayProject(project, { scenarioId: "night", stepId: "dawn" });
    expect(stepDisplay.constructions[0]?.rooms[0]).toMatchObject({ name: "Dawn room", description: "" });
  });
});
