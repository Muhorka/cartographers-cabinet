import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { createToolboxState } from "../toolbox/toolbox-state";
import { activatePreferredLayer, preferredCutoutTarget } from "./workbench-helpers";
import { emptyProject, type PlaceNode } from "../model/project-model";
import { editableOutlineTarget } from "../drawing/outline-target";

describe("preferred cutout target", () => {
  it.each(["world", "location", "building", "level", "custom", "object", "standalone-room"] as const)("uses the same outline permission for %s", (kind) => {
    const place: PlaceNode = { id: "area", name: "Area", kind, boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} };
    const project = { ...emptyProject("p", "P"), places: [place] };
    const selected = { kind: "place" as const, id: "area" };
    expect(preferredCutoutTarget(project, undefined, "area", true)).toEqual(selected);
    expect(preferredCutoutTarget(project, selected, "area", false)).toBeUndefined();
    expect(preferredCutoutTarget(project, selected, "area", true)).toEqual(selected);
    expect(preferredCutoutTarget(project, selected, "broader-map", false)).toEqual(selected);
    place.locked = true;
    expect(editableOutlineTarget(project, selected)).toBeUndefined();
    expect(preferredCutoutTarget(project, selected, "area", true)).toBeUndefined();
  });

  it("does not fabricate an outline for a clean world", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "world", name: "World", kind: "world" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }] };
    expect(preferredCutoutTarget(project, undefined, "world", true)).toBeUndefined();
  });
  it("uses the open level outline while boundary editing even when a room is selected", () => {
    const project = createStarterProject("project", "Project", "en");
    const room = project.places.find(({ kind }) => kind === "room")!;

    expect(preferredCutoutTarget(project, { kind: "place", id: room.id }, "project:level", true))
      .toEqual({ kind: "place", id: "project:level" });
  });

  it("does not silently target the level when outline editing is off", () => {
    const project = createStarterProject("project", "Project", "en");
    const room = project.places.find(({ kind }) => kind === "room")!;

    expect(preferredCutoutTarget(project, { kind: "place", id: room.id }, "project:level", false))
      .toBeUndefined();
  });
});

describe("tool memory while navigating", () => {
  it("keeps stairs selected when moving between levels of the same building", () => {
    const project = createStarterProject("project", "Project", "en");
    const ground = project.places.find(({ kind }) => kind === "level")!;
    const upper = { ...ground, id: "upper", name: "Upper floor" };
    const toolbox = createToolboxState("openings"); toolbox.byLayer.openings = { subjectId: "opening.stairs", instrumentId: "ellipse" };
    const session = new EditorSession({ ...project, places: [...project.places, upper] }, { initialPlaceId: ground.id, initialToolbox: toolbox });

    session.openPlace(upper.id); activatePreferredLayer(session, upper.id);

    expect(session.getState().toolbox.activeLayerId).toBe("openings");
    expect(session.getState().toolbox.byLayer.openings).toEqual({ subjectId: "opening.stairs", instrumentId: "ellipse" });
  });
});
