import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";
import { EditorSession } from "../state/editor-session";
import { effectiveProjectStoryObject } from "../story/project-effective";
import type { StoryObjectMetadata, StoryObjectRef } from "../story/types";
import { createEditorCommandTools } from "./create-editor-command-tools";

function fixture() {
  const project = createStarterProject("zone-tools", "Synthetic zone inheritance", "pl");
  const construction = project.constructions[0];
  const room: StoryObjectRef = { kind: "room", id: construction.rooms[0].id, scopeId: construction.id };
  const building: StoryObjectRef = { kind: "place", id: "zone-tools:building" };
  const session = new EditorSession(project, { initialPlaceId: "zone-tools:level" });
  const tools = createEditorCommandTools({ getSession: () => session, getActivePlaceId: () => "zone-tools:level", refresh() {} });
  async function run<T>(name: string, input: Record<string, unknown>): Promise<T> {
    const tool = tools.find((candidate) => candidate.name === name)!;
    return (await tool.execute(input) as { structuredContent: T }).structuredContent;
  }
  async function apply(name: string, input: Record<string, unknown>) {
    const prepared = await run<{ status: string; token: string }>(name, input);
    expect(prepared.status).toBe("prepared");
    expect((await run<{ status: string }>("apply_prepared_editor_change", { token: prepared.token })).status).toBe("applied");
  }
  return { session, room, building, run, apply };
}

describe("one zone inheritance path for the editor, agent and saved projects", () => {
  it("adds shared traits without baking them into local objects, including undo and import", async () => {
    const { session, room, building, run, apply } = fixture();
    await apply("prepare_set_story_metadata", { refs: [room], metadata: { properties: { personal: "books", mood: "quiet" } }, target: "base" });
    const before = structuredClone(session.getState().project);
    await apply("prepare_edit_story", { collection: "zones", action: "upsert", entries: [{ id: "apartment", name: "Apartament", members: [room, building].map((ref) => ({ ref, relation: "inside", partial: false })), tags: [], metadata: { properties: { shared: "sunny", mood: "festive" } } }] });
    const inspect = await run<{ objects: Array<{ metadata: StoryObjectMetadata }> }>("inspect_story_objects", { refs: [room] });
    expect(inspect.objects[0].metadata.properties).toMatchObject({ personal: "books", mood: "quiet", shared: "sunny" });
    const saved = session.getState().project;
    expect(saved.story.objects).toEqual(before.story.objects);
    expect(saved.places).toEqual(before.places);
    expect(saved.constructions).toEqual(before.constructions);
    expect(saved.elements).toEqual(before.elements);
    const imported = parseProjectFile(serializeProjectFile(saved)).project;
    expect(effectiveProjectStoryObject(imported, room)?.metadata.properties).toMatchObject({ personal: "books", mood: "quiet", shared: "sunny" });
    session.undo();
    expect(effectiveProjectStoryObject(session.getState().project, room)?.metadata.properties?.shared).toBeUndefined();
    session.redo();
    expect(effectiveProjectStoryObject(session.getState().project, room)?.metadata.properties?.shared).toBe("sunny");
    await apply("prepare_edit_story", { collection: "zones", action: "remove", ids: ["apartment"] });
    expect(effectiveProjectStoryObject(session.getState().project, room)?.metadata.properties).toMatchObject({ personal: "books", mood: "quiet" });
    expect(effectiveProjectStoryObject(session.getState().project, room)?.metadata.properties?.shared).toBeUndefined();
  });

  it("keeps legacy group commands as an adapter without deleting independent zones", async () => {
    const { session, room, run, apply } = fixture();
    await apply("prepare_edit_story", { collection: "zones", action: "upsert", entries: [{ id: "shared-id", name: "Original zone", members: [], tags: [], metadata: { properties: { original: true } } }] });
    await apply("prepare_edit_story", { collection: "groups", action: "upsert", entries: [{ id: "shared-id", name: "Old apartment", memberRefs: [room], entryIds: [], metadata: { properties: { inherited: "first" } } }] });
    expect(session.getState().project.story.groups).toEqual([]);
    expect(session.getState().project.story.zones).toHaveLength(2);
    expect(effectiveProjectStoryObject(session.getState().project, room)?.metadata.properties?.inherited).toBe("first");
    const catalog = await run<{ entries: Array<{ id: string; name: string }> }>("inspect_story_catalog", { collection: "groups" });
    expect(catalog.entries).toMatchObject([{ id: "shared-id", name: "Old apartment" }]);
    await apply("prepare_edit_story", { collection: "groups", action: "upsert", entries: [{ id: "shared-id", name: "Renamed apartment" }] });
    expect(session.getState().project.story.zones).toHaveLength(2);
    expect(effectiveProjectStoryObject(session.getState().project, room)?.metadata.properties?.inherited).toBe("first");
    await apply("prepare_edit_story", { collection: "groups", action: "remove", ids: ["shared-id"] });
    expect(session.getState().project.story.zones).toMatchObject([{ id: "shared-id", name: "Original zone" }]);
    expect(effectiveProjectStoryObject(session.getState().project, room)?.metadata.properties?.inherited).toBeUndefined();
  });

  it("updates every zone member and keeps scene overrides temporary", async () => {
    const { session, room, building, run, apply } = fixture();
    await apply("prepare_edit_story", { collection: "zones", action: "upsert", entries: [{ id: "shared", name: "Shared traits", members: [room, building].map((ref) => ({ ref, relation: "inside", partial: false })), tags: [], metadata: { properties: { mood: "quiet" } } }] });
    await apply("prepare_edit_story", { collection: "scenarios", action: "upsert", entries: [{ id: "party", name: "Celebration", patches: [{ id: "party-room", target: room, properties: { mood: "lively" } }], steps: [] }] });
    await apply("prepare_edit_story", { collection: "zones", action: "upsert", entries: [{ id: "shared", metadata: { properties: { mood: "calm" } } }] });
    const base = await run<{ objects: Array<{ metadata: StoryObjectMetadata }> }>("inspect_story_objects", { refs: [room, building], context: {} });
    expect(base.objects.map(({ metadata }) => metadata.properties?.mood)).toEqual(["calm", "calm"]);
    const scene = await run<{ objects: Array<{ metadata: StoryObjectMetadata }> }>("inspect_story_objects", { refs: [room, building], context: { scenarioId: "party" } });
    expect(scene.objects.map(({ metadata }) => metadata.properties?.mood)).toEqual(["lively", "calm"]);
    expect(session.getState().project.story.zones[0].metadata?.properties?.mood).toBe("calm");
  });
});
