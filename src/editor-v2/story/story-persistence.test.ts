import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { assertProposalCurrent, createProjectCheckpoint, restoreCheckpointSnapshot } from "../persistence/project-checkpoint";
import { parseProjectFile, PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION, serializeProjectFile } from "../persistence/project-file";
import { storyDataSchema } from "./schema";
import { migrateStoryData } from "./migration";
import { emptyStoryData, type StoryData } from "./types";
import { normalizeEditorProject } from "../model/project-model";

function projectFixture() {
  const story: StoryData = storyDataSchema.parse({ ...emptyStoryData(), world: [{ id: "guild", kind: "faction", name: "Guild", tags: ["local"], properties: { rank: 2 } }, { id: "brass", kind: "key", name: "Brass", tags: [], properties: {} }], memberships: [{ subjectId: "alice", groupId: "guild", kind: "member-of", source: "manual" }, { subjectId: "alice", groupId: "brass", kind: "holds-key", source: "manual" }], propertyDefinitions: [{ id: "mood", name: "Mood", type: "text", group: "Narrative" }], objects: [{ ref: { kind: "place", id: "room" }, metadata: { narrativeDescription: "A hidden room", owners: ["guild"], access: { allow: ["guild"], deny: [], permission: "restricted", physicalState: "closed", lock: "locked", keyIds: ["brass"], guardIds: [], secretKnowledge: [] }, tags: ["hidden"], properties: { mood: "quiet" } } }], groups: [{ id: "hidden", name: "Hidden places", memberRefs: [{ kind: "place", id: "room" }], entryIds: ["guild"], metadata: { tags: ["secret"], properties: {}, access: { allow: ["guild"], deny: [], permission: "restricted", physicalState: "closed", lock: "locked", keyIds: [], guardIds: [], secretKnowledge: [] } } }], scenarios: [{ id: "night", name: "Night", patches: [{ id: "night-room", target: { kind: "place", id: "room" }, title: "Night room", properties: { mood: "dark" } }], steps: [{ id: "after", name: "After", patches: [{ id: "after-room", target: { kind: "place", id: "room" }, description: "The room is empty." }] }] }], routes: [{ id: "route-1", name: "Saved route", query: { from: { placeId: "room", point: { x: 0, y: 0 } }, to: { placeId: "room", point: { x: 1, y: 1 } } }, result: { status: "unreachable", revision: 0, sourceRevision: "0", routes: [], missingFacts: ["no-door"], reasons: ["closed"] }, sourceRevision: "0" }] });
  const project = emptyProject("persistence-story", "Story persistence"); project.places = [{ id: "room", name: "Room", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }]; return { ...project, story };
}

describe("Story persistence boundary", () => {
  it("round-trips zones, memberships, keys, scenarios, steps and saved routes", () => {
    const project = projectFixture(); const loaded = parseProjectFile(serializeProjectFile(project, "2026-08-30T10:00:00.000Z")).project;
    expect(loaded.story).toEqual(migrateStoryData(project.story)); expect(loaded.schemaVersion).toBe(9);
  });

  it("migrates v7/v8 envelopes to required v9 StoryData without erasing supplied story", () => {
    const project = projectFixture();
    const v8 = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: { ...project, schemaVersion: 8 } }).project;
    const v7 = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: { ...project, schemaVersion: 7, story: undefined } }).project;
    expect(v8.story.scenarios[0]?.steps[0]?.id).toBe("after"); expect(v7.schemaVersion).toBe(9); expect(v7.story).toEqual(emptyStoryData());
  });

  it("defaults a pre-route v9 StoryData while preserving its authored collections", () => {
    const project = projectFixture(); const legacy = structuredClone(project) as unknown as { story: Record<string, unknown> }; delete legacy.story.routes;
    const loaded = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: legacy }).project;
    expect(loaded.story.routes).toEqual([]); expect(loaded.story.scenarios).toEqual(project.story.scenarios); expect(loaded.story.groups).toEqual([]); expect(loaded.story.zones[0]).toMatchObject({ legacyGroupId: "hidden", entryIds: ["guild"], name: "Hidden places" });
  });

  it("rejects unknown geometry fields inside text-only scenario patches", () => {
    const project = projectFixture(); const invalid = structuredClone(project) as unknown as { story: { scenarios: Array<{ patches: Array<Record<string, unknown>> }> } };
    invalid.story.scenarios[0]!.patches[0]!.geometry = { kind: "rectangle", x: 0, y: 0, width: 1, height: 1 };
    expect(() => parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: project.updatedAt, project: invalid })).toThrow();
  });

  it("keeps proposal/checkpoint restore schema-safe and detects stale base state", () => {
    const project = normalizeEditorProject(projectFixture()); const proposal = createProjectCheckpoint(project, { id: "proposal", name: "Alternative", kind: "proposal", baseSnapshot: project }); const restored = restoreCheckpointSnapshot(proposal, "2026-08-30T11:00:00.000Z");
    expect(restored.story).toEqual(migrateStoryData(project.story)); expect(() => assertProposalCurrent(proposal, project)).not.toThrow();
    expect(() => assertProposalCurrent(proposal, { ...project, name: "Changed" })).toThrow("proposal-stale");
  });
});
