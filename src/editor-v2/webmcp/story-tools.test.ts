import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { evaluateLens, storyAccess } from "../story/evaluation";
import { emptyStoryData, type StoryData } from "../story/types";
import { createAgentBatchTools } from "./agent-batch-tools";
import { inspectEditorContext, type EditorLiveContext, type StoryViewUpdateResult } from "./editor-context";
import { createEditorCommandTools } from "./create-editor-command-tools";

function setup() {
  const story: StoryData = { ...emptyStoryData(), world: [{ id: "staff", kind: "access-group", name: "Staff", tags: [], properties: {} }, { id: "brass", kind: "key", name: "Brass key", tags: [], properties: {} }], memberships: [{ subjectId: "alice", groupId: "brass", kind: "holds-key", source: "manual" }], objects: [{ ref: { kind: "place", id: "room" }, metadata: { access: { allow: [], deny: [], permission: "restricted", physicalState: "open", lock: "locked", keyIds: ["brass"], guardIds: [], secretKnowledge: [] } } }], lenses: [{ id: "locked", name: "Locked", color: "#123456", expression: { kind: "predicate", predicate: { kind: "access", entryId: "staff", state: "allowed" } } }] };
  const project = { ...emptyProject("story-tools", "Story tools"), places: [{ id: "room", name: "Room", description: "Description", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], story: { ...story, scenarios: [{ id: "night", name: "Night", patches: [], steps: [] }] } };
  const session = new EditorSession(project, { initialPlaceId: "room" }); let live: EditorLiveContext = { mode: "story", selections: [{ type: "place", id: "room" }], view: {} }; let viewResult: StoryViewUpdateResult | void;
  const bridge = { getSession: () => session, getActivePlaceId: () => "room", refresh: () => undefined, getEditorContext: () => live, setStoryView: (view: EditorLiveContext["view"]) => { live = { ...live, view }; return viewResult; } };
  const tools = createEditorCommandTools(bridge);
  return { session, bridge, tools, context: () => inspectEditorContext(bridge), setLive: (next: EditorLiveContext) => { live = next; }, setViewResult: (next: StoryViewUpdateResult | void) => { viewResult = next; } };
}
function tool(tools: WebMcpTool[], name: string) { const found = tools.find((candidate) => candidate.name === name); if (!found) throw new Error(`missing tool ${name}`); return found; }
async function structured<T>(value: unknown) { return (await Promise.resolve(value) as { structuredContent: T }).structuredContent; }

describe("Story WebMCP integration", () => {
  it("returns authored and effective group traits without adding another tool", async () => {
    const { tools, session } = setup();
    session.executeTransaction({ id: "fixture-effective-world", apply: (project) => ({ ...project, story: { ...project.story, world: [...project.story.world, { id: "alice", kind: "character", name: "Alice", tags: [], properties: {} }, { id: "watch", kind: "access-group", name: "Watch", tags: [], properties: { duty: "guard" } }], memberships: [...project.story.memberships, { subjectId: "alice", groupId: "watch", kind: "member-of", source: "manual" }] } }) });
    const read = await structured<{ entries: { id: string }[]; effectiveEntries: { id: string; properties: Record<string, unknown> }[] }>(tool(tools, "inspect_story_catalog").execute({ collection: "world" }));
    expect(read.entries.find(({ id }) => id === "alice")).toBeDefined();
    expect(read.effectiveEntries.find(({ id }) => id === "alice")?.properties).toMatchObject({ duty: "guard" });
  });

  it("shows a temporary lens beside saved lenses without saving or changing project history", async () => {
    const { tools, session, context } = setup();
    const before = session.getState().project;
    const history = session.getHistoryState();
    const revision = context().projectRevision;
    const previewLens = { id: "temporary-lens", name: "Preview", color: "#abcdef", expression: { kind: "predicate", predicate: { kind: "object", ref: { kind: "place", id: "room" } } } };
    await tool(tools, "set_story_view").execute({ lensIds: ["locked"], previewLens });
    expect(context().view).toMatchObject({ lensIds: ["locked"], previewLens });
    const read = await structured<{ objects: { lenses: { lensId: string; match: boolean; color: string }[] }[] }>(tool(tools, "inspect_story_objects").execute({ refs: [{ kind: "place", id: "room" }] }));
    expect(read.objects[0].lenses).toEqual(expect.arrayContaining([expect.objectContaining({ lensId: "locked", match: false }), expect.objectContaining({ lensId: "temporary-lens", match: true, color: "#abcdef" })]));
    expect(session.getState().project).toEqual(before);
    expect(context().projectRevision).toBe(revision);
    expect(session.getHistoryState()).toEqual(history);
    await tool(tools, "set_story_view").execute({ neutral: true });
    expect(context().view).toMatchObject({ lensIds: [], previewLens: null, editTarget: "base" });
    expect(session.getState().project).toEqual(before);
    expect(session.getHistoryState()).toEqual(history);
  });

  it("validates temporary expressions with the saved-lens schema before touching the view", async () => {
    const { tools, context } = setup();
    const view = context().view;
    await expect(tool(tools, "set_story_view").execute({ previewLens: { id: "bad", name: "Bad", color: "#123456", expression: { kind: "unknown" } } })).rejects.toThrow();
    await expect(tool(tools, "set_story_view").execute({ lensIds: ["missing"] })).rejects.toThrow("Lens not found");
    await expect(tool(tools, "set_story_view").execute({ lensId: "locked", lensIds: [] })).rejects.toThrow("conflicting");
    expect(context().view).toEqual(view);
  });

  it("accepts hidden passage knowledge and nobody access through the shared metadata command", async () => {
    const { tools, session } = setup();
    const access = { ...session.getState().project.story.objects[0].metadata.access!, permission: "nobody", hidden: true, knownBy: ["staff"] };
    const prepared = await structured<{ status: string; token: string }>(tool(tools, "prepare_set_story_metadata").execute({ refs: [{ type: "place", id: "room" }], metadata: { access }, accessFields: ["permission", "hidden", "knownBy"], target: "base" }));
    expect(prepared.status).toBe("prepared");
    await tool(tools, "apply_prepared_editor_change").execute({ token: prepared.token });
    expect(session.getState().project.story.objects[0].metadata.access).toMatchObject({ permission: "nobody", hidden: true, knownBy: ["staff"], keyIds: ["brass"] });
  });

  it("returns deferred when the host guards a Story view transition", async () => {
    const { tools, setViewResult } = setup(); setViewResult({ status: "deferred", reason: "draft" });
    const result = await structured<{ status: string; reason: string }>(tool(tools, "set_story_view").execute({ scenarioId: "night" }));
    expect(result).toEqual({ status: "deferred", reason: "draft" });
  });

  it("uses the same scenario lock validation for collection edits as the UI", async () => {
    const { tools, session } = setup();
    session.executeTransaction({ id: "fixture-lock", apply: (project) => ({ ...project, places: project.places.map((place) => ({ ...place, locked: true })), story: { ...project.story, scenarios: [{ id: "night", name: "Night", patches: [{ id: "effect", target: { kind: "place", id: "room" }, description: "After dark" }], steps: [] }] } }) });
    const before = session.getState().project.story;
    const blocked = await structured<{ status: string }>(tool(tools, "prepare_edit_story").execute({ collection: "scenarios", action: "upsert", entries: [{ id: "night", patches: [] }] }));
    expect(blocked.status).not.toBe("prepared");
    expect(session.getState().project.story).toEqual(before);
    const rename = await structured<{ status: string; token: string }>(tool(tools, "prepare_edit_story").execute({ collection: "scenarios", action: "upsert", entries: [{ id: "night", name: "Renamed night" }] }));
    expect(rename.status).toBe("prepared");
    await tool(tools, "apply_prepared_editor_change").execute({ token: rename.token });
    expect(session.getState().project.story.scenarios[0].name).toBe("Renamed night");
    expect(session.getState().project.story.scenarios[0].patches).toEqual(before.scenarios[0].patches);
  });

  it("uses the shared prepared-token apply boundary for metadata", async () => {
    const { tools, session } = setup(); const prepare = await structured<{ status: string; token: string }>(tool(tools, "prepare_set_story_metadata").execute({ refs: [{ type: "place", id: "room" }], metadata: { tags: ["secret"] }, action: "add", target: "base" }));
    expect(prepare.status).toBe("prepared"); expect(session.getState().project.story.objects[0]?.metadata.tags).toBeUndefined();
    expect((await structured<{ status: string }>(tool(tools, "apply_prepared_editor_change").execute({ token: prepare.token }))).status).toBe("applied"); expect(session.getState().project.story.objects[0]?.metadata.tags).toEqual(["secret"]);
  });

  it("keeps zone metadata and color through the prepared Story collection tool", async () => {
    const { tools, session } = setup();
    const create = await structured<{ status: string; token: string }>(tool(tools, "prepare_edit_story").execute({ collection: "zones", action: "upsert", entries: [{ id: "zone", name: "Quiet court", members: [], tags: [], color: "#445566", metadata: { narrativeLabel: "Court", properties: { mood: "quiet" } } }] }));
    expect(create.status).toBe("prepared");
    await tool(tools, "apply_prepared_editor_change").execute({ token: create.token });
    expect(session.getState().project.story.zones[0]).toMatchObject({ color: "#445566", metadata: { narrativeLabel: "Court", properties: { mood: "quiet" } } });
    const edit = await structured<{ status: string; token: string }>(tool(tools, "prepare_edit_story").execute({ collection: "zones", action: "upsert", entries: [{ id: "zone", name: "Renamed court" }] }));
    expect(edit.status).toBe("prepared");
    await tool(tools, "apply_prepared_editor_change").execute({ token: edit.token });
    expect(session.getState().project.story.zones[0]).toMatchObject({ name: "Renamed court", color: "#445566", metadata: { narrativeLabel: "Court", properties: { mood: "quiet" } } });
  });

  it("commits worldbook, scenario and metadata as one atomic batch", async () => {
    const { session, bridge, context } = setup();
    const input = { requestId: "batch-story", expectedRevision: context().projectRevision, summary: "Record a scene", operations: [
      { tool: "prepare_edit_story", input: { collection: "world", action: "upsert", entries: [{ id: "guard", kind: "character", name: "Guard", tags: [], properties: {} }] } },
      { tool: "prepare_edit_story", input: { collection: "scenarios", action: "upsert", entries: [{ id: "night", name: "Night", patches: [], steps: [] }] } },
      { tool: "prepare_set_story_metadata", input: { metadata: { tags: ["night"] }, action: "add", target: "base" }, useSelection: true },
    ] };
    const result = await structured<{ status: string }>(createAgentBatchTools(bridge, (shadow) => createEditorCommandTools({ ...bridge, getSession: () => shadow, refresh: () => undefined }))[1].execute({ ...input, expectedContextVersion: context().contextVersion }));
    expect(result.status).toBe("applied"); expect(session.getState().project.story.world.some(({ id }) => id === "guard")).toBe(true); expect(session.getState().project.story.scenarios.some(({ id }) => id === "night")).toBe(true); expect(session.getState().project.story.objects[0]?.metadata.tags).toEqual(["night"]);
  });

  it("rolls back earlier worldbook edits when a later Story operation fails", async () => {
    const { session, bridge, context } = setup(); const tools = createAgentBatchTools(bridge, (shadow) => createEditorCommandTools({ ...bridge, getSession: () => shadow, refresh: () => undefined }));
    const result = await structured<{ status: string }>(tools[1].execute({ requestId: "failed-story", expectedRevision: context().projectRevision, summary: "Should not partially commit", operations: [
      { tool: "prepare_edit_story", input: { collection: "world", action: "upsert", entries: [{ id: "discarded", kind: "character", name: "Discarded", tags: [], properties: {} }] } },
      { tool: "prepare_set_story_metadata", input: { refs: [{ type: "place", id: "missing" }], metadata: { tags: ["never"] }, action: "add" } },
    ] }));
    expect(result.status).toBe("blocked"); expect(session.getState().project.story.world.some(({ id }) => id === "discarded")).toBe(false);
  });

  it("binds useSelection to the live inspected selection", async () => {
    const { session, bridge, context, setLive } = setup(); setLive({ mode: "story", selections: [{ type: "place", id: "room" }], view: {} }); const tools = createAgentBatchTools(bridge, (shadow) => createEditorCommandTools({ ...bridge, getSession: () => shadow, refresh: () => undefined }));
    const result = await structured<{ status: string }>(tools[1].execute({ requestId: "selection-story", expectedRevision: context().projectRevision, expectedContextVersion: context().contextVersion, summary: "Tag selection", operations: [{ tool: "prepare_set_story_metadata", input: { metadata: { tags: ["selected"] }, action: "add" }, useSelection: true }] }));
    expect(result.status).toBe("applied"); expect(session.getState().project.story.objects[0]?.metadata.tags).toEqual(["selected"]);
  });

  it("keeps keys separate from permission and uses the same authored lens result", () => {
    const { session } = setup(); const story = session.getState().project.story; const ref = { kind: "place" as const, id: "room" }; expect(storyAccess(story, ref, "alice").allowed).toBe(false); expect(evaluateLens(story, "locked", ref)?.color).toBe("#123456"); expect(evaluateLens(story, "locked", ref)?.match).toBe(false);
  });

  it("removes optional native descriptions without removing required names", async () => {
    const { tools, session } = setup(); const prepared = await structured<{ status: string; token: string }>(tool(tools, "prepare_set_story_metadata").execute({ refs: [{ type: "place", id: "room" }], metadata: { narrativeDescription: "Description" }, action: "remove", target: "base" }));
    expect(prepared.status).toBe("prepared"); await tool(tools, "apply_prepared_editor_change").execute({ token: prepared.token }); expect(session.getState().project.places[0]?.description).toBeUndefined(); expect(session.getState().project.places[0]?.name).toBe("Room");
  });

  it("serializes every registered Story tool schema as valid JSON", () => {
    const { bridge } = setup(); const tools = createEditorCommandTools(bridge); for (const candidate of tools.filter(({ name }) => name.includes("story"))) expect(() => JSON.parse(JSON.stringify(candidate.inputSchema))).not.toThrow();
  });
});
