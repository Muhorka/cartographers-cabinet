import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { createEditorAgentTools } from "./register-agent-tools";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";

function projectFixture(locked = false) {
  const project = emptyProject("planning-agent", "Planning agent");
  project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -100, y: -100, width: 300, height: 300 }, tags: [], access: [], properties: {} }, { id: "level", parentId: "world", name: "Level", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 }, tags: [], access: [], properties: {} }];
  project.elements = [{ id: "a", belongsToId: "level", name: "A", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "region", shape: { kind: "rectangle", x: 5, y: 8, width: 10, height: 5 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, { id: "b", belongsToId: "level", name: "B", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "region", shape: { kind: "rectangle", x: 30, y: 20, width: 10, height: 5 } }, visible: true, locked, tags: [], access: [], properties: {} }];
  return project;
}

function toolSet(session: EditorSession) { return createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => "level", refresh: () => undefined }); }

describe("agent planning alignment command", () => {
  it("prepares without mutation, applies once and can be undone", async () => {
    const project = projectFixture(); const session = new EditorSession(project, { initialPlaceId: "level" }); const tools = toolSet(session); const prepare = tools.find(({ name }) => name === "prepare_align_objects")!; const apply = tools.find(({ name }) => name === "apply_prepared_editor_change")!; const before = structuredClone(session.getState().project);
    const preview = await prepare.execute({ refs: [{ type: "element", id: "a" }, { type: "element", id: "b" }], axis: "vertical", edge: "start" }) as { structuredContent: { status: string; token: string } };
    expect(preview.structuredContent.status).toBe("prepared"); expect(session.getState().project).toEqual(before);
    expect((await apply.execute({ token: preview.structuredContent.token }) as { structuredContent: { status: string } }).structuredContent.status).toBe("applied"); expect(session.getState().project.elements.find(({ id }) => id === "b")?.geometry).toMatchObject({ kind: "region", shape: { y: 8 } });
    expect(session.getHistoryState().canUndo).toBe(true); expect(session.undo().changed).toBe(true); expect(session.getState().project).toEqual(before);
  });
  it("rejects a locked member before producing a prepared change", async () => {
    const session = new EditorSession(projectFixture(true), { initialPlaceId: "level" }); const prepare = toolSet(session).find(({ name }) => name === "prepare_align_objects")!;
    const result = await prepare.execute({ refs: [{ type: "element", id: "a" }, { type: "element", id: "b" }], axis: "horizontal", edge: "start" }) as { structuredContent: { status: string; reason: string } };
    expect(result.structuredContent).toMatchObject({ status: "blocked", reason: "locked" }); expect(session.getHistoryState().canUndo).toBe(false);
  });
  it("prepares, applies, serializes and undoes an open road split", async () => {
    const project = projectFixture(); project.elements.push({ id: "road", belongsToId: "level", name: "Road", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 5, y: 5 }, { x: 15, y: 10 }, { x: 25, y: 5 }, { x: 35, y: 10 }], closed: false }, widthMeters: 6, widthProfile: [{ t: 0, left: 3, right: 3 }, { t: 1, left: 5, right: 4 }], visible: true, locked: false, tags: [], access: [], properties: {} });
    const session = new EditorSession(project, { initialPlaceId: "level", createId: () => "unused" }); const tools = toolSet(session); const prepare = tools.find(({ name }) => name === "prepare_split_path")!; const apply = tools.find(({ name }) => name === "apply_prepared_editor_change")!; const before = structuredClone(session.getState().project);
    const preview = await prepare.execute({ ref: { type: "element", id: "road" }, vertexIndex: 1 }) as { structuredContent: { status: string; token: string } };
    expect(preview.structuredContent.status).toBe("prepared"); expect(session.getState().project).toEqual(before);
    expect((await apply.execute({ token: preview.structuredContent.token }) as { structuredContent: { status: string } }).structuredContent.status).toBe("applied"); const roads = session.getState().project.elements.filter(({ layerId }) => layerId === "roads"); expect(roads).toHaveLength(2); expect(roads[0]?.widthProfile?.at(-1)?.t).toBe(1); expect(roads[1]?.widthProfile?.[0]?.t).toBe(0); expect(parseProjectFile(serializeProjectFile(session.getState().project)).project).toEqual(session.getState().project); expect(session.undo().changed).toBe(true); expect(session.getState().project).toEqual(before);
  });
  it("rejects a locked path before preparing a split", async () => {
    const project = projectFixture(); project.elements.push({ id: "locked-path", belongsToId: "level", name: "Locked", layerId: "sketch", subjectId: "sketch.path", geometry: { kind: "path", points: [{ x: 5, y: 5 }, { x: 15, y: 10 }, { x: 25, y: 5 }], closed: false }, visible: true, locked: true, tags: [], access: [], properties: {} });
    const session = new EditorSession(project, { initialPlaceId: "level" }); const prepare = toolSet(session).find(({ name }) => name === "prepare_split_path")!; const result = await prepare.execute({ ref: { type: "element", id: "locked-path" }, vertexIndex: 1 }) as { structuredContent: { status: string; reason: string } };
    expect(result.structuredContent).toMatchObject({ status: "blocked", reason: "locked" }); expect(session.getHistoryState().canUndo).toBe(false);
  });
});
