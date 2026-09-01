import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { projectRevision } from "../state/project-revision";
import { emptyStoryData } from "../story/types";
import { createAgentBatchTools } from "./agent-batch-tools";
import { inspectEditorContext, type EditorLiveContext } from "./editor-context";
import { createEditorCommandTools } from "./create-editor-command-tools";

const opening = { kind: "opening" as const, id: "door", scopeId: "plan" };

function fixture(): EditorProject {
  const project = emptyProject("assignment-tools", "Story assignment tools");
  project.places = [{ id: "level", name: "Level", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {}, locked: false }];
  project.constructions = [{ id: "plan", revision: 0, walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "boundary", thickness: .2 }], rooms: [], openings: [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1 }], transitions: [] }];
  project.story = {
    ...emptyStoryData(),
    world: [
      { id: "anna", kind: "character", name: "Anna", tags: [], properties: {} },
      { id: "wardens", kind: "faction", name: "Wardens", tags: [], properties: {} },
      { id: "staff", kind: "access-group", name: "Staff", tags: [], properties: {} },
      { id: "brass-key", kind: "key", name: "Brass key", tags: [], properties: {} },
    ],
    objects: [{ ref: opening, metadata: { access: { allow: [], deny: [], permission: "restricted", physicalState: "closed", lock: "locked", keyIds: [], guardIds: [], secretKnowledge: [] } } }],
    memberships: [{ subjectId: "anna", groupId: "brass-key", kind: "holds-key", source: "imported" }],
    scenarios: [{ id: "night", name: "Night", patches: [], steps: [] }],
  };
  return project;
}

function setup() {
  const session = new EditorSession(fixture(), { initialPlaceId: "level" });
  let live: EditorLiveContext = { mode: "story", selections: [{ type: "place", id: "level" }], view: {} };
  const bridge = {
    getSession: () => session,
    getActivePlaceId: () => "level",
    refresh: () => undefined,
    getEditorContext: () => live,
    setLive: (next: EditorLiveContext) => { live = next; },
  };
  return { session, bridge, tools: createEditorCommandTools(bridge) };
}

function tool(tools: WebMcpTool[], name: string) {
  const found = tools.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
}

async function structured<T>(value: unknown) {
  return (await Promise.resolve(value) as { structuredContent: T }).structuredContent;
}

describe("Story assignment WebMCP tools", () => {
  it("prepares exact scoped assignments without mutating before apply and preserves the owner", async () => {
    const { tools, session } = setup();
    const before = structuredClone(session.getState().project);
    const prepared = await structured<{ status: string; token: string }>(tool(tools, "prepare_assign_story_entry").execute({ refs: [{ kind: "place", id: "level" }], kind: "character", name: "Alice", target: "base" }));
    expect(prepared.status).toBe("prepared");
    expect(session.getState().project).toEqual(before);
    await tool(tools, "apply_prepared_editor_change").execute({ token: prepared.token });
    const alice = session.getState().project.story.world.find(({ name }) => name === "Alice");
    expect(alice?.kind).toBe("character");
    expect(session.getState().project.story.objects.find(({ ref }) => ref.kind === "place")?.metadata.owners).toEqual([alice?.id]);
    expect(session.undo().changed).toBe(true);
    expect(session.getState().project).toEqual(before);
  });

  it("requires the opening scope and assigns a created key through one batch undo", async () => {
    const { session, bridge } = setup();
    const context = inspectEditorContext(bridge);
    const tools = createAgentBatchTools(bridge, (shadow) => createEditorCommandTools({ ...bridge, getSession: () => shadow, refresh: () => undefined }));
    const result = await structured<{ status: string }>(tools[1]!.execute({
      requestId: "assign-door-key",
      expectedRevision: projectRevision(session.getState().project),
      expectedContextVersion: context.contextVersion,
      summary: "Assign the passage key",
      operations: [{ tool: "prepare_assign_door_key", input: { ref: opening, holderIds: ["anna"], keyName: "Passage key", target: "base" } }],
    }));
    if (result.status !== "applied") throw new Error(JSON.stringify(result));
    const state = session.getState().project;
    const key = state.story.world.find(({ kind, name }) => kind === "key" && name === "Passage key");
    expect(key).toBeDefined();
    expect(state.story.objects[0]?.metadata.access?.keyIds).toEqual([key?.id]);
    expect(state.story.memberships).toEqual(expect.arrayContaining([{ subjectId: "anna", groupId: key?.id, kind: "holds-key", source: "manual" }]));
    expect(session.undo().changed).toBe(true);
    expect(session.getState().project.story.world.some(({ name }) => name === "Passage key")).toBe(false);
    await expect(tool(createEditorCommandTools(bridge), "prepare_assign_door_key").execute({ ref: { kind: "opening", id: "door" }, holderIds: ["anna"] })).rejects.toThrow();
  });

  it("uses the active scenario context by default and keeps the base opening annotation unchanged", async () => {
    const { session, bridge } = setup();
    const baseAccess = structuredClone(session.getState().project.story.objects[0]?.metadata.access);
    bridge.setLive({ mode: "story", selections: [], view: { scenarioId: "night", editTarget: "scenario" } });
    const allTools = createEditorCommandTools(bridge);
    const prepared = await structured<{ status: string; token: string }>(tool(allTools, "prepare_assign_door_key").execute({ ref: opening, holderIds: ["anna"], keyName: "Night key" }));
    if (prepared.status !== "prepared") throw new Error(JSON.stringify(prepared));
    await tool(allTools, "apply_prepared_editor_change").execute({ token: prepared.token });
    const state = session.getState().project;
    expect(state.story.objects[0]?.metadata.access).toEqual(baseAccess);
    expect(state.story.scenarios[0]?.patches[0]?.metadata?.access?.keyIds).toHaveLength(1);
    expect(state.story.memberships).toEqual(expect.arrayContaining([{ subjectId: "anna", groupId: expect.any(String), kind: "holds-key", source: "manual" }]));
  });
});
