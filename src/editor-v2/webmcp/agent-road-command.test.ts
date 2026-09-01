import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { createEditorAgentTools } from "./register-agent-tools";

function roadProject(points: [{ x: number; y: number }, { x: number; y: number }], locked = false) {
  const project = emptyProject("road-agent", "Road agent");
  project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -100, y: -100, width: 300, height: 300 }, tags: [], access: [], properties: {} }, { id: "level", parentId: "world", name: "Level", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 100 }, tags: [], access: [], properties: {} }];
  project.elements = [{ id: "road-a", belongsToId: "level", name: "A", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points, closed: false }, widthMeters: 4, widthProfile: [{ t: 0, left: 2, right: 2 }, { t: 1, left: 3, right: 3 }], ribbonCutouts: [{ kind: "rectangle", x: 4, y: -1, width: 1, height: 2 }], visible: true, locked, tags: [], access: [], properties: {} }, { id: "road-b", belongsToId: "level", name: "B", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 10, y: 0 }, { x: 20, y: 0 }], closed: false }, widthMeters: 4, visible: true, locked: false, tags: [], access: [], properties: {} }];
  return project;
}

function toolSet(session: EditorSession) { return createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => "level", refresh: () => undefined }); }

describe("agent road joining command", () => {
  it("prepares, applies once, preserves road data and can be undone", async () => {
    const session = new EditorSession(roadProject([{ x: 0, y: 0 }, { x: 10, y: 0 }]), { initialPlaceId: "level" }); const tools = toolSet(session); const prepare = tools.find(({ name }) => name === "prepare_join_roads")!; const apply = tools.find(({ name }) => name === "apply_prepared_editor_change")!; const before = structuredClone(session.getState().project);
    const preview = await prepare.execute({ refs: [{ type: "element", id: "road-a" }, { type: "element", id: "road-b" }] }) as { structuredContent: { status: string; token: string } };
    expect(preview.structuredContent.status).toBe("prepared"); expect(session.getState().project).toEqual(before);
    expect((await apply.execute({ token: preview.structuredContent.token }) as { structuredContent: { status: string } }).structuredContent.status).toBe("applied");
    const joined = session.getState().project.elements.find(({ id }) => id === "road-a")!; expect(session.getState().project.elements).toHaveLength(1); expect(joined.widthProfile).toHaveLength(4); expect(joined.ribbonCutouts).toEqual(before.elements[0]!.ribbonCutouts); expect(session.getHistoryState().canUndo).toBe(true); expect(session.undo().changed).toBe(true); expect(session.getState().project).toEqual(before);
  });

  it("does not prepare a locked road join", async () => {
    const session = new EditorSession(roadProject([{ x: 0, y: 0 }, { x: 10, y: 0 }], true), { initialPlaceId: "level" }); const prepare = toolSet(session).find(({ name }) => name === "prepare_join_roads")!;
    const result = await prepare.execute({ refs: [{ type: "element", id: "road-a" }, { type: "element", id: "road-b" }] }) as { structuredContent: { status: string; reason: string } };
    expect(result.structuredContent).toMatchObject({ status: "blocked", reason: "locked" }); expect(session.getHistoryState().canUndo).toBe(false);
  });
});
