import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { storyDataSchema } from "./schema";
import { assignProjectKeyHolders } from "./project-key-holders";
import { storyAccessDecision } from "./routes/access";

const opening = { kind: "opening" as const, id: "door", scopeId: "plan" };

function fixture(): EditorProject {
  const project = emptyProject("keys", "Key holder tests");
  project.story.world = [
    { id: "anna", kind: "character", name: "Anna", tags: [], properties: {} },
    { id: "wardens", kind: "faction", name: "Wardens", tags: [], properties: {} },
    { id: "access", kind: "access-group", name: "Access group", tags: [], properties: {} },
    { id: "other-key", kind: "key", name: "Other key", tags: [], properties: {} },
  ];
  project.constructions = [{ id: "plan", revision: 0, walls: [], rooms: [], openings: [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1 }], transitions: [] }];
  project.story.objects = [{ ref: opening, metadata: { access: { allow: ["access"], deny: ["intruder"], permission: "restricted", physicalState: "closed", lock: "locked", keyIds: [], guardIds: ["wardens"], secretKnowledge: ["anna"] }, tags: ["front"] } }];
  project.story.memberships = [{ subjectId: "anna", groupId: "other-key", kind: "holds-key", source: "imported", note: "archive" }, { subjectId: "anna", groupId: "access", kind: "member-of", source: "manual" }];
  const parsed = storyDataSchema.safeParse(project.story); if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
  return project;
}

describe("assignProjectKeyHolders", () => {
  it("creates one key when needed, attaches it to the opening and assigns existing holders", () => {
    const next = assignProjectKeyHolders(fixture(), { ref: opening, holderIds: ["anna", "wardens"], keyName: "Front passage key" });
    const key = next.story.world.find(({ kind, name }) => kind === "key" && name === "Front passage key");
    expect(key).toBeDefined();
    expect(next.story.objects[0]?.metadata).toMatchObject({ tags: ["front"], access: { allow: ["access"], deny: ["intruder"], permission: "restricted", physicalState: "closed", lock: "locked", guardIds: ["wardens"], secretKnowledge: ["anna"] } });
    expect(next.story.objects[0]?.metadata.access?.keyIds).toEqual([key?.id]);
    expect(next.story.memberships).toEqual(expect.arrayContaining([
      { subjectId: "anna", groupId: key?.id, kind: "holds-key", source: "manual" },
      { subjectId: "wardens", groupId: key?.id, kind: "holds-key", source: "manual" },
      { subjectId: "anna", groupId: "other-key", kind: "holds-key", source: "imported", note: "archive" },
      { subjectId: "anna", groupId: "access", kind: "member-of", source: "manual" },
    ]));
    expect(storyDataSchema.safeParse(next.story).success).toBe(true);
  });

  it("uses the sole opening key without duplicating it and edits only that key's holders", () => {
    const project = fixture();
    project.story.world.push({ id: "second-key", kind: "key", name: "Second", tags: [], properties: {} });
    project.story.objects[0]!.metadata.access!.keyIds = ["other-key"];
    project.story.memberships.push({ subjectId: "wardens", groupId: "second-key", kind: "holds-key", source: "imported", note: "keep provenance" });
    const next = assignProjectKeyHolders(project, { ref: opening, holderIds: ["access"] });
    expect(next.story.world.filter(({ kind }) => kind === "key")).toHaveLength(2);
    expect(next.story.objects[0]?.metadata.access?.keyIds).toEqual(["other-key"]);
    expect(next.story.memberships).toEqual(expect.arrayContaining([{ subjectId: "wardens", groupId: "second-key", kind: "holds-key", source: "imported", note: "keep provenance" }]));
    expect(next.story.memberships).toEqual(expect.arrayContaining([{ subjectId: "access", groupId: "other-key", kind: "holds-key", source: "manual" }]));
    expect(next.story.memberships).not.toEqual(expect.arrayContaining([{ subjectId: "anna", groupId: "other-key", kind: "holds-key", source: "imported", note: "archive" }]));
  });

  it("requires an explicit key when the opening has multiple keys", () => {
    const project = fixture();
    project.story.world.push({ id: "second-key", kind: "key", name: "Second", tags: [], properties: {} });
    project.story.objects[0]!.metadata.access!.keyIds = ["other-key", "second-key"];
    expect(() => assignProjectKeyHolders(project, { ref: opening, holderIds: ["anna"] })).toThrow(/keyId is required/);
  });

  it("rejects key holders and unknown ids, and never creates an orphan key for an empty assignment", () => {
    const project = fixture();
    expect(() => assignProjectKeyHolders(project, { ref: opening, holderIds: ["other-key"] })).toThrow(/character, faction or access group/);
    expect(() => assignProjectKeyHolders(project, { ref: opening, holderIds: ["missing"] })).toThrow(/does not exist/);
    const before = structuredClone(project);
    const next = assignProjectKeyHolders(project, { ref: opening, holderIds: [] });
    expect(next).toEqual(before);
    expect(next.story.world.filter(({ kind }) => kind === "key")).toHaveLength(1);
  });

  it("clears only the selected key's holder memberships when holders become empty", () => {
    const project = fixture();
    project.story.objects[0]!.metadata.access!.keyIds = ["other-key"];
    project.story.memberships.push({ subjectId: "wardens", groupId: "other-key", kind: "holds-key", source: "manual" });
    const next = assignProjectKeyHolders(project, { ref: opening, keyId: "other-key", holderIds: [] });
    expect(next.story.objects[0]?.metadata.access?.keyIds).toEqual(["other-key"]);
    expect(next.story.memberships.filter(({ kind, groupId }) => kind === "holds-key" && groupId === "other-key")).toEqual([]);
    expect(next.story.memberships).toEqual(expect.arrayContaining([{ subjectId: "anna", groupId: "access", kind: "member-of", source: "manual" }]));
  });

  it("writes scenario door keys to the scenario patch while route access sees the holder", () => {
    const project = fixture();
    project.story.world.push({ id: "night-key", kind: "key", name: "Night key", tags: [], properties: {} });
    project.story.objects[0]!.metadata.access!.keyIds = ["other-key"];
    project.story.scenarios = [{ id: "night", name: "Night", patches: [{ id: "door-night", target: opening, metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "open", lock: "locked", keyIds: [], guardIds: [], secretKnowledge: [] } } }], steps: [] }];
    const next = assignProjectKeyHolders(project, { ref: opening, keyId: "night-key", holderIds: ["anna"], target: "scenario", context: { scenarioId: "night" } });
    expect(next.story.objects[0]?.metadata.access?.keyIds).toEqual(["other-key"]);
    expect(next.story.scenarios[0]?.patches[0]?.metadata?.access?.keyIds).toEqual(["night-key"]);
    expect(next.story.memberships).toEqual(expect.arrayContaining([{ subjectId: "anna", groupId: "night-key", kind: "holds-key", source: "manual" }]));
    expect(storyAccessDecision(next, { kind: "opening", id: "door", scopeId: "plan" }, { actorId: "anna", scenarioId: "night" })).toBe(true);
  });

  it("reads scenario keys before choosing a key and preserves the other scenario key", () => {
    const project = fixture();
    project.story.world.push({ id: "night-a", kind: "key", name: "Night A", tags: [], properties: {} }, { id: "night-b", kind: "key", name: "Night B", tags: [], properties: {} });
    project.story.scenarios = [{ id: "night", name: "Night", patches: [{ id: "night-door", target: opening, metadata: { access: { allow: [], deny: [], permission: "restricted", physicalState: "closed", lock: "locked", keyIds: ["night-a", "night-b"], guardIds: [], secretKnowledge: [] } } }], steps: [] }];
    expect(() => assignProjectKeyHolders(project, { ref: opening, holderIds: ["anna"], target: "scenario", context: { scenarioId: "night" } })).toThrow(/keyId is required/);
    const next = assignProjectKeyHolders(project, { ref: opening, keyId: "night-a", holderIds: ["anna"], target: "scenario", context: { scenarioId: "night" } });
    expect(next.story.scenarios[0]?.patches[0]?.metadata?.access?.keyIds).toEqual(["night-a", "night-b"]);
  });

  it("gives newly created keys distinct names while respecting an explicit base name", () => {
    const project = fixture();
    project.constructions[0]!.openings.push({ id: "second-door", kind: "door", wallId: "wall", position: .8, width: 1 });
    const first = assignProjectKeyHolders(project, { ref: opening, holderIds: ["anna"], keyName: "Klucz do przejścia" });
    const second = assignProjectKeyHolders(first, { ref: { ...opening, id: "second-door" }, holderIds: ["anna"], keyName: "Klucz do przejścia" });
    expect(second.story.world.filter(({ kind }) => kind === "key").map(({ name }) => name)).toEqual(["Other key", "Klucz do przejścia", "Klucz do przejścia 2"]);
  });
});
