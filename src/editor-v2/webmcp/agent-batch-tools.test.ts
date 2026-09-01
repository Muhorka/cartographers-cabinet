import { describe, expect, it, vi } from "vitest";
import { EditorSession } from "../state/editor-session";
import { createProjectAtScale } from "../model/starter-project";
import { createAgentBatchTools } from "./agent-batch-tools";
import { createEditorAgentTools } from "./register-agent-tools";
import { createEditorCommandTools } from "./create-editor-command-tools";
import type { RouteCalculationOutcome, StoryRouteCalculationService } from "../story/routes/route-service";
import { inspectEditorContext, type EditorLiveContext } from "./editor-context";
import { emptyProject, type EditorProject } from "../model/project-model";
import { createConstructionDocument } from "../construction/construction-document";
import { createProjectCheckpoint, assertProposalCurrent, restoreCheckpointSnapshot } from "../persistence/project-checkpoint";

function setup(routeService?: StoryRouteCalculationService) {
  const project = createProjectAtScale("batch-test", "Test atlas", "en", "world");
  for (let index = 0; index < 5; index += 1) project.elements.push({ id: `note-${index}`, name: "Note", belongsToId: project.places[0].id, layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: index, y: 0 }, text: "draft" }, visible: true, locked: false, access: [], tags: [], properties: {} });
  const session = new EditorSession(project, { initialPlaceId: project.places[0].id });
  let liveSession = session;
  let live: EditorLiveContext = { mode: "story", selections: [{ type: "element", id: "note-0" }], view: {} };
  const preserved: { before: EditorProject; after: EditorProject; kind: string }[] = [];
  const bridge = { getSession: () => liveSession, getActivePlaceId: () => project.places[0].id, refresh: () => undefined, getEditorContext: () => live,
    preserveAgentChange: async (before: EditorProject, after: EditorProject, _summary: string, kind: "safety" | "proposal") => { preserved.push({ before, after, kind }); return `trace-${preserved.length}`; } };
  const tools = createAgentBatchTools(bridge, (shadow) => {
    const shadowBridge = { getSession: () => shadow, getActivePlaceId: bridge.getActivePlaceId, getEditorContext: () => live, refresh: () => undefined };
    return routeService ? createEditorCommandTools(shadowBridge, undefined, routeService) : createEditorAgentTools(shadowBridge);
  });
  const context = () => inspectEditorContext(bridge);
  const execute = async (input: object) => ((await tools[1].execute(input as Record<string, unknown>)) as { structuredContent: { status: string; reason?: string; alreadyApplied?: boolean; operationIndex?: number; tool?: string; ref?: unknown } }).structuredContent;
  const args = () => ({ requestId: crypto.randomUUID(), expectedRevision: context().projectRevision, summary: "Update test notes", operations: [{ tool: "prepare_update_project_object", input: { ref: { type: "element", id: "note-0" }, description: "A quiet corner" } }] });
  return { session, bridge, context, execute, args, preserved, setLive: (next: EditorLiveContext) => { live = next; },
    replaceSession: () => { liveSession = new EditorSession(session.getState().project, { initialPlaceId: project.places[0].id }); return liveSession; } };
}

describe("atomic external agent tasks", () => {
  it("updates two objects in one undo step and retries idempotently", async () => {
    const { session, args, execute } = setup(); const request = args();
    request.operations.push({ tool: "prepare_update_project_object", input: { ref: { type: "element", id: "note-1" }, description: "Matching style" } });
    const before = session.getState().project;
    expect((await execute(request)).status).toBe("applied");
    expect((await execute(request)).alreadyApplied).toBe(true);
    expect(session.getState().project.elements[1].description).toBe("Matching style");
    session.undo(); expect(session.getState().project).toEqual(before);
    expect(session.getHistoryState().canUndo).toBe(false);
  });
  it("does not partially apply a failing batch", async () => {
    const { session, args, execute } = setup(); const request = args(); const before = session.getState().project;
    request.operations.push({ tool: "prepare_delete_project", input: {} } as typeof request.operations[number]);
    expect(await execute(request)).toMatchObject({ status: "blocked", operationIndex: 1, tool: "prepare_delete_project" }); expect(session.getState().project).toEqual(before);
  });

  it("reports the failing operation reference without breaking atomic rollback", async () => {
    const { session, args, execute } = setup(); const request = args(); const before = session.getState().project;
    request.operations.push({ tool: "prepare_update_project_object", input: { ref: { type: "element", id: "missing" }, description: "Should fail" } });
    expect(await execute(request)).toMatchObject({ status: "blocked", operationIndex: 1, tool: "prepare_update_project_object", ref: { type: "element", id: "missing" } });
    expect(session.getState().project).toEqual(before);
  });
  it("does not retarget an inspected selection after a user click", async () => {
    const { args, context, execute, setLive, session } = setup();
    const request = { ...args(), expectedContextVersion: context().contextVersion };
    setLive({ mode: "story", selections: [{ type: "element", id: "note-1" }], view: {} });
    expect((await execute(request)).status).toBe("stale-context"); expect(session.getHistoryState().canUndo).toBe(false);
  });
  it("preserves a before-state tracing for five explicit targets", async () => {
    const { args, execute, preserved } = setup(); const request = args();
    request.operations = Array.from({ length: 5 }, (_, index) => ({ tool: "prepare_update_project_object", input: { ref: { type: "element", id: `note-${index}` }, description: "Set together" } }));
    expect((await execute(request)).status).toBe("applied"); expect(preserved).toHaveLength(1);
    expect(preserved[0].kind).toBe("safety"); expect(preserved[0].before.elements[0].description).toBeUndefined();
  });
  it("keeps exploratory changes unapplied and rejects stale proposal adoption", async () => {
    const { args, execute, session, preserved } = setup(); const before = session.getState().project;
    expect((await execute({ ...args(), mode: "propose" })).status).toBe("proposed");
    expect(session.getState().project).toEqual(before); expect(preserved[0].kind).toBe("proposal");
    const proposal = createProjectCheckpoint(preserved[0].after, { id: "variant", name: "Possibility", kind: "proposal", baseSnapshot: before });
    expect(() => assertProposalCurrent(proposal, { ...before, updatedAt: new Date().toISOString() })).not.toThrow();
    expect(() => assertProposalCurrent(proposal, { ...before, name: "Newer work" })).toThrow("proposal-stale");
    expect(restoreCheckpointSnapshot(proposal).elements[0].description).toBe("A quiet corner");
  });
  it("does not edit locked objects", async () => {
    const { args, session, execute } = setup();
    session.executeTransaction({ id: "lock", apply: (project) => ({ ...project, elements: project.elements.map((value) => value.id === "note-0" ? { ...value, locked: true } : value) }) });
    expect((await execute(args())).status).toBe("blocked");
    expect(session.getState().project.elements[0].description).toBeUndefined();
  });
  it("rejects a conflicting singular ref and rolls back earlier shadow edits", async () => {
    const { session, args, context, execute, setLive } = setup(); const before = session.getState().project;
    setLive({ mode: "story", selections: [{ type: "element", id: "note-1" }], view: {} });
    const conflict = { tool: "prepare_update_project_object", useSelection: true, input: { ref: { type: "element", id: "note-0" }, description: "Wrong target" } };
    const request = { ...args(), expectedContextVersion: context().contextVersion, operations: [args().operations[0], conflict] };
    expect(await execute(request)).toMatchObject({ status: "blocked", operationIndex: 1, tool: conflict.tool, ref: conflict.input.ref, reason: "The explicit ref is outside the inspected selection." });
    expect(session.getState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

  it("accepts a matching singular ref without changing unselected objects", async () => {
    const { session, args, context, execute } = setup(); const before = session.getState().project;
    const request = { ...args(), expectedContextVersion: context().contextVersion, operations: [{ ...args().operations[0], useSelection: true }] };
    expect(await execute(request)).toMatchObject({ status: "applied" });
    expect(session.getState().project.elements[0].description).toBe("A quiet corner");
    expect(session.getState().project.elements.slice(1)).toEqual(before.elements.slice(1));
    session.undo(); expect(session.getState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

  it("rejects explicit refs outside the inspected selection", async () => {
    const { session, args, context, execute } = setup(); const before = session.getState().project;
    const operation = { tool: "prepare_transform_project_objects", useSelection: true, input: { refs: [{ type: "element", id: "note-1" }], transformation: { kind: "move", dx: 1, dy: 0 } } };
    expect(await execute({ ...args(), expectedContextVersion: context().contextVersion, operations: [operation] })).toMatchObject({ status: "blocked", operationIndex: 0, reason: "Explicit refs conflict with the inspected selection." });
    expect(session.getState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

  it("still injects the inspected selection for multi-ref tools", async () => {
    const { session, args, context, execute, setLive } = setup(); const before = session.getState().project;
    setLive({ mode: "story", selections: [{ type: "element", id: "note-0" }, { type: "element", id: "note-1" }], view: {} });
    const operation = { tool: "prepare_transform_project_objects", useSelection: true, input: { transformation: { kind: "move", dx: 2, dy: 0 } } };
    expect(await execute({ ...args(), expectedContextVersion: context().contextVersion, operations: [operation] })).toMatchObject({ status: "applied" });
    expect(session.getState().project.elements[0].geometry).toMatchObject({ at: { x: 2, y: 0 } });
    expect(session.getState().project.elements[1].geometry).toMatchObject({ at: { x: 3, y: 0 } });
    expect(session.getState().project.elements.slice(2)).toEqual(before.elements.slice(2));
    session.undo(); expect(session.getState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

  it.each([false, true])("binds a pending route batch to its original session (replaced=%s)", async (replaced) => {
    let resolve!: (outcome: RouteCalculationOutcome) => void;
    const service: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((done) => { resolve = done; })), cancel: vi.fn(), dispose: vi.fn() };
    const { session, args, context, execute, replaceSession } = setup(service); const before = session.getState().project; const inspected = context();
    const placeId = before.places[0].id; const query = { from: { placeId, point: { x: 0, y: 0 } }, to: { placeId, point: { x: 1, y: 1 } } };
    const pending = execute({ ...args(), expectedContextVersion: inspected.contextVersion, operations: [{ tool: "prepare_save_story_route", input: { id: "saved-route", name: "Synthetic route", query } }] });
    expect(service.calculate).toHaveBeenCalledOnce();
    const current = replaced ? replaceSession() : session;
    expect(context().projectRevision).toBe(inspected.projectRevision); expect(context().contextVersion).toBe(inspected.contextVersion);
    resolve({ status: "ready", attemptId: 1, result: { status: "unreachable", revision: 0, sourceRevision: "synthetic-source", routes: [], missingFacts: [], reasons: [] } });
    expect(await pending).toMatchObject({ status: replaced ? "stale" : "applied" });
    if (replaced) {
      expect(current.getState().project).toEqual(before); expect(session.getState().project).toEqual(before);
      expect(current.getHistoryState().canUndo).toBe(false); expect(session.getHistoryState().canUndo).toBe(false);
    } else {
      expect(current.getState().project.story.routes).toHaveLength(1);
      current.undo(); expect(current.getState().project).toEqual(before); expect(current.getHistoryState().canUndo).toBe(false);
    }
  });

  it.each(["level-b", "plan-a"])("checks construction scope and accepts its canonical alias (%s)", async (scopeId) => {
    const project = emptyProject("scope-batch", "Synthetic scopes");
    for (const suffix of ["a", "b"]) {
      const document = createConstructionDocument(`plan-${suffix}`, [{ id: "same-wall", start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, role: "partition", thickness: .2 }], { createId: () => crypto.randomUUID(), createName: () => "Room" });
      document.openings.push({ id: "same-door", wallId: "same-wall", kind: "door", position: .5, width: 1 });
      project.constructions.push(document);
      project.places.push({ id: `level-${suffix}`, name: suffix, kind: "level", constructionId: document.id, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    }
    const session = new EditorSession(project, { initialPlaceId: "level-a" }); const before = session.getState().project;
    const live: EditorLiveContext = { mode: "story", selections: [{ type: "opening", id: "same-door", scopeId: "level-a" }], view: {} };
    const bridge = { getSession: () => session, getActivePlaceId: () => "level-a", refresh: () => undefined, getEditorContext: () => live };
    const tools = createAgentBatchTools(bridge, (shadow) => createEditorAgentTools({ ...bridge, getSession: () => shadow }));
    const context = inspectEditorContext(bridge);
    const response = await tools[1].execute({ requestId: crypto.randomUUID(), expectedRevision: context.projectRevision, expectedContextVersion: context.contextVersion, summary: "Resize selected door", operations: [{ tool: "prepare_update_project_object", useSelection: true, input: { ref: { type: "opening", id: "same-door", scopeId }, openingWidth: .8 } }] }) as { structuredContent: { status: string } };
    expect(response.structuredContent.status).toBe(scopeId === "plan-a" ? "applied" : "blocked");
    expect(session.getState().project.constructions[1].openings[0].width).toBe(1);
    if (scopeId === "plan-a") {
      expect(session.getState().project.constructions[0].openings[0].width).toBe(.8);
      session.undo();
    }
    expect(session.getState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

  it("rejects useSelection for id-only tools before they can target another object", async () => {
    const { session, args, context, execute } = setup(); const before = session.getState().project;
    const operation = { tool: "prepare_edit_road", useSelection: true, input: { id: "unselected-road", widthMeters: 2 } };
    expect(await execute({ ...args(), expectedContextVersion: context().contextVersion, operations: [operation] })).toMatchObject({ status: "blocked", operationIndex: 0, tool: "prepare_edit_road", reason: "This command does not support useSelection." });
    expect(session.getState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

  it.each([undefined, {}])("rejects useSelection when the tool has no usable schema (%s)", async (inputSchema) => {
    const { session, bridge, args, context } = setup(); const before = session.getState().project;
    const tools = createAgentBatchTools(bridge, (shadow) => createEditorAgentTools({ ...bridge, getSession: () => shadow }).map((tool) => ({ ...tool, inputSchema })));
    const response = await tools[1].execute({ ...args(), expectedContextVersion: context().contextVersion, operations: [{ ...args().operations[0], useSelection: true }] }) as { structuredContent: { status: string; reason?: string } };
    expect(response.structuredContent).toMatchObject({ status: "blocked", reason: "This command does not support useSelection." });
    expect(session.getState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

});
