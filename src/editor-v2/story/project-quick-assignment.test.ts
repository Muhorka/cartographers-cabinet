import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { storyDataSchema } from "./schema";
import { emptyStoryData } from "./types";
import { createAndAssignStoryEntry } from "./project-quick-assignment";
import { effectiveProjectStoryObject } from "./project-effective";

function fixture() {
  const project = emptyProject("quick", "Quick assignment");
  project.places.push({ id: "level", name: "Level", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {}, locked: false });
  project.story = { ...emptyStoryData(), objects: [{ ref: { kind: "place", id: "level" }, metadata: { owners: ["old-owner"], properties: { note: "keep" } } }], propertyDefinitions: [{ id: "existing-flag", name: "Is Ready", type: "boolean" }] };
  return project;
}

describe("createAndAssignStoryEntry", () => {
  it("creates Anna and preserves existing owners and metadata", () => {
    const project = fixture(); const next = createAndAssignStoryEntry(project, { refs: [{ kind: "place", id: "level" }], kind: "character", name: " Anna ", target: "base" });
    const anna = next.story.world.find(({ kind, name }) => kind === "character" && name === "Anna");
    expect(anna?.id).toMatch(/^[0-9a-f-]{36}$/); expect(next.story.objects[0]?.metadata).toMatchObject({ owners: ["old-owner", anna?.id], properties: { note: "keep" } }); expect(storyDataSchema.safeParse(next.story).success).toBe(true);
  });

  it("reuses a boolean property case-insensitively and changes only its key", () => {
    const project = fixture(); const next = createAndAssignStoryEntry(project, { refs: [{ kind: "place", id: "level" }], kind: "boolean-property", name: " is ready ", target: "base" });
    expect(next.story.propertyDefinitions.filter(({ type }) => type === "boolean")).toHaveLength(1); expect(next.story.objects[0]?.metadata.properties).toEqual({ note: "keep", "existing-flag": true });
  });

  it("assigns a new faction in a scenario without changing base metadata", () => {
    const project = fixture(); project.story.scenarios = [{ id: "night", name: "Night", patches: [], steps: [] }]; const before = structuredClone(project.story.objects);
    const next = createAndAssignStoryEntry(project, { refs: [{ kind: "place", id: "level" }], kind: "faction", name: "Night Watch", target: "scenario", context: { scenarioId: "night" } });
    const entry = next.story.world.find(({ name }) => name === "Night Watch"); const patch = next.story.scenarios[0]?.patches[0];
    expect(next.story.objects).toEqual(before); expect(patch).toMatchObject({ target: { kind: "place", id: "level" }, metadata: { owners: ["old-owner", entry?.id] } });
    expect(effectiveProjectStoryObject(next, { kind: "place", id: "level" }, { scenarioId: "night" })?.metadata.owners).toEqual(["old-owner", entry?.id]);
    expect(effectiveProjectStoryObject(next, { kind: "place", id: "level" })?.metadata.owners).toEqual(["old-owner"]);
  });

  it("is all-or-nothing for locks, unknown refs, and ambiguous names", () => {
    const locked = fixture(); locked.places[0]!.locked = true; const before = structuredClone(locked);
    expect(() => createAndAssignStoryEntry(locked, { refs: [{ kind: "place", id: "level" }], kind: "character", name: "Anna", target: "base" })).toThrow(/locked/); expect(locked).toEqual(before);
    const project = fixture(); const snapshot = structuredClone(project); expect(() => createAndAssignStoryEntry(project, { refs: [{ kind: "place", id: "missing" }], kind: "character", name: "Anna", target: "base" })).toThrow(/missing/); expect(project).toEqual(snapshot);
    project.story.world.push({ id: "a", kind: "character", name: "Anna", tags: [], properties: {} }, { id: "b", kind: "character", name: " anna ", tags: [], properties: {} }); expect(() => createAndAssignStoryEntry(project, { refs: [{ kind: "place", id: "level" }], kind: "character", name: "ANNA", target: "base" })).toThrow(/ambiguous/);
  });

  it("does not create an entry when the name is blank and can be undone as one session transaction", () => {
    const project = fixture(); expect(() => createAndAssignStoryEntry(project, { refs: [{ kind: "place", id: "level" }], kind: "character", name: "  ", target: "base" })).toThrow(/blank/);
    const session = new EditorSession(project, { initialPlaceId: "level" }); const before = session.getState().project;
    expect(session.executeTransaction({ id: "quick-assignment", apply: (value) => createAndAssignStoryEntry(value, { refs: [{ kind: "place", id: "level" }], kind: "character", name: "Anna", target: "base" }) }).changed).toBe(true); expect(session.undo().changed).toBe(true); expect(session.getState().project.story).toEqual(before.story);
  });
});
