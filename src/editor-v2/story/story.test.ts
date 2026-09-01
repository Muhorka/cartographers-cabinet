import { describe, expect, it } from "vitest";
import { storyDataSchema, storyObjectRefSchema } from "./schema";
import { applyStoryCommand, danglingStoryReferences } from "./operations";
import { effectiveStoryMetadata, effectiveStoryObject, evaluateLens, evaluateProjectLens, searchStory, storyAccess } from "./evaluation";
import { emptyProject } from "../model/project-model";
import { effectiveProjectStoryObject, projectStoryAccess, projectStoryData } from "./project-effective";
import { allStoryObjectRefs, resolveStoryObject, storyObjectRefs } from "./project-adapter";
import { applyProjectStoryMetadata } from "./project-commands";
import { assignProjectKeyHolders } from "./project-key-holders";
import { emptyStoryData, type StoryData } from "./types";

const ref = { kind: "room" as const, id: "room-1", scopeId: "level-1" };
function fixture(): StoryData {
  return storyDataSchema.parse({ ...emptyStoryData(), objects: [{ ref, metadata: { owners: ["alice"], access: { allow: ["staff"], deny: [], permission: "restricted", physicalState: "closed", lock: "locked", keyIds: ["brass"], guardIds: [], secretKnowledge: [] }, tags: ["quiet"], properties: { mood: "quiet" } } }], world: [{ id: "staff", kind: "access-group", name: "Staff", tags: [], properties: {} }, { id: "brass", kind: "key", name: "Brass key", tags: [], properties: {} }] });
}

describe("story domain", () => {
  it("validates typed data and stable scoped room references", () => {
    const story = fixture(); expect(story.objects[0]?.ref.scopeId).toBe("level-1");
    expect(storyObjectRefSchema.parse(ref)).toEqual(ref);
    expect(() => storyDataSchema.parse({ ...story, objects: [...story.objects, story.objects[0]] })).toThrow();
  });

  it("evaluates authored lens color and access predicates", () => {
    const story = fixture();
    const lens = applyStoryCommand(story, { kind: "add", collection: "lenses", item: { id: "restricted", name: "Restricted", color: "#ab2233", expression: { kind: "predicate", predicate: { kind: "access", entryId: "staff", state: "allowed" } } } }).story;
    expect(evaluateLens(lens, "restricted", ref)).toMatchObject({ match: true, color: "#ab2233" });
  });

  it("keeps key possession separate from permission and derives only member-of groups", () => {
    const story = storyDataSchema.parse({ ...fixture(), memberships: [{ subjectId: "bob", groupId: "brass", kind: "holds-key", source: "manual" }] });
    expect(storyAccess(story, ref, "bob").allowed).toBe(false);
    const memberStory = storyDataSchema.parse({ ...story, memberships: [{ subjectId: "bob", groupId: "staff", kind: "member-of", source: "manual" }] });
    expect(storyAccess(memberStory, ref, "bob").allowed).toBe(true);
  });

  it("applies scenario then step patches and reports conflicts", () => {
    const base = fixture();
    const story = applyStoryCommand(base, { kind: "add", collection: "scenarios", item: { id: "night", name: "Night", patches: [{ id: "s", target: ref, properties: { mood: "dark" } }], steps: [{ id: "alarm", name: "Alarm", patches: [{ id: "t", target: ref, properties: { mood: "red" } }] }] } }).story;
    const result = effectiveStoryObject(story, ref, { scenarioId: "night", stepId: "alarm" });
    expect(result?.effectiveProperties).toContainEqual({ propertyId: "mood", value: "red", source: "step", patchIds: ["s", "t"], conflict: false });
  });

  it("keeps deleted references unresolved and never retargets them", () => {
    const story = applyStoryCommand(fixture(), { kind: "add", collection: "groups", item: { id: "all-rooms", name: "Rooms", memberRefs: [ref], entryIds: [], metadata: { tags: [], properties: {} } } }).story;
    const after = applyStoryCommand(story, { kind: "delete-object", ref });
    expect(after.story.zones[0]?.members[0]?.ref).toEqual(ref);
    expect(after.story.zones[0]?.legacyGroupId).toBe("all-rooms");
    expect(danglingStoryReferences(after.story).some(({ code }) => code === "unresolved-reference")).toBe(true);
  });

  it("searches only local object, world and evidence records", () => {
    const story = fixture(); const result = searchStory(story, "room-1");
    expect(result[0]).toMatchObject({ kind: "object", label: "room-1" });
  });

  it("rolls back the whole bulk command when one operation is invalid", () => {
    const story = fixture(); const group = { id: "g", name: "G", memberRefs: [], entryIds: [], metadata: { tags: [], properties: {} } }; const result = applyStoryCommand(story, { kind: "bulk", commands: [{ kind: "add", collection: "groups", item: group }, { kind: "add", collection: "groups", item: { ...group, name: "G2" } }] });
    expect(result.changed).toBe(false); expect(result.story.groups).toHaveLength(0); expect(result.diagnostics[0]?.code).toBe("duplicate");
  });

  it("inherits group properties and lets explicit local values win", () => {
    const story = applyStoryCommand(fixture(), { kind: "add", collection: "groups", item: { id: "quiet", name: "Quiet", memberRefs: [ref], entryIds: [], metadata: { properties: { mood: "group" }, tags: ["group-tag"] } } }).story;
    const result = effectiveStoryObject(story, ref);
    expect(result?.metadata.properties?.mood).toBe("quiet");
    expect(result?.metadata.tags).toEqual(["group-tag", "quiet"]);
  });

  it("does not choose an arbitrary value for conflicting groups, regardless of order", () => {
    const first = { id: "first", name: "First", memberRefs: [ref], entryIds: [], metadata: { properties: { climate: "red" } } };
    const second = { id: "second", name: "Second", memberRefs: [ref], entryIds: [], metadata: { properties: { climate: "blue" } } };
    const forward = storyDataSchema.parse({ ...fixture(), groups: [first, second] }); const reverse = storyDataSchema.parse({ ...fixture(), groups: [second, first] });
    expect(effectiveStoryMetadata(forward, ref).metadata.properties).not.toHaveProperty("climate");
    expect(effectiveStoryMetadata(reverse, ref).metadata.properties).not.toHaveProperty("climate");
    expect(effectiveStoryMetadata(forward, ref).conflicts).toContain("zone:climate");
    const lens = { id: "climate", name: "Climate", color: "#123456", expression: { kind: "predicate" as const, predicate: { kind: "property" as const, propertyId: "climate", equals: "red" } } };
    const withLens = storyDataSchema.parse({ ...forward, lenses: [lens] });
    expect(evaluateLens(withLens, "climate", ref)?.match).toBe(false);
    const explicit = storyDataSchema.parse({ ...forward, objects: [{ ref, metadata: { properties: { mood: "quiet", climate: "green" } } }] });
    expect(effectiveStoryMetadata(explicit, ref)).toMatchObject({ metadata: { properties: { mood: "quiet", climate: "green" } }, conflicts: [] });
  });

  it("uses exact local geometry for spatial zone lens predicates", () => {
    const story = storyDataSchema.parse({ ...emptyStoryData(), objects: [{ ref: { kind: "place", id: "courtyard" }, metadata: {} }], zones: [{ id: "north", name: "North", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, members: [], tags: [] }], lenses: [{ id: "zone", name: "Zone", color: "#112233", expression: { kind: "predicate", predicate: { kind: "zone", zoneId: "north" } } }] });
    const project = { ...emptyProject("p", "P"), places: [{ id: "courtyard", name: "Courtyard", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle" as const, x: 2, y: 2, width: 3, height: 3 }, tags: [], access: [], properties: {} }], story };
    expect(evaluateProjectLens(project, story, "zone", { kind: "place", id: "courtyard" })?.match).toBe(true);
  });

  it("canonicalizes a hierarchy room to one owning construction scope", () => {
    const story = storyDataSchema.parse({ ...emptyStoryData(), objects: [{ ref: { kind: "room", id: "room", scopeId: "construction" }, metadata: { narrativeLabel: "Narrative room" } }] });
    const project = { ...emptyProject("p", "P"), places: [{ id: "level", name: "Level", kind: "level" as const, constructionId: "construction", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, { id: "room", name: "Native room", kind: "room" as const, parentId: "level", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: ["staff"], properties: { legacy: true } }], constructions: [{ id: "construction", revision: 0, walls: [], rooms: [{ id: "room", faceId: "face", name: "Construction room", tags: [], access: [], properties: {} }], openings: [], transitions: [] }], story } as ReturnType<typeof emptyProject>;
    expect(allStoryObjectRefs(project).filter((ref) => ref.kind === "room" && ref.id === "room")).toHaveLength(1);
    expect(storyObjectRefs(project, story).filter(({ ref }) => ref.kind === "room" && ref.id === "room")).toHaveLength(1);
    const resolved = effectiveProjectStoryObject(project, { kind: "room", id: "room" }); expect(resolved?.name).toBe("Native room");
    expect(resolved?.metadata.properties?.legacy).toBe(true); expect(resolved?.metadata.access?.allow).toEqual(["staff"]);
  });

  it("edits native text and sparse narrative metadata transactionally", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "place", name: "Old", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }] };
    const next = applyProjectStoryMetadata(project, { refs: [{ kind: "place", id: "place" }], metadata: { narrativeLabel: "New", properties: { mood: "quiet" } }, action: "add" });
    expect(next.places[0]?.name).toBe("New"); expect(next.story.objects[0]?.metadata.properties?.mood).toBe("quiet"); expect(project.places[0]?.name).toBe("Old");
  });

  it("uses the active scenario step for text-only edits and respects locks", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "place", name: "Old", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, locked: true, tags: [], access: [], properties: {} }] };
    expect(() => applyProjectStoryMetadata(project, { refs: [{ kind: "place", id: "place" }], metadata: { narrativeLabel: "Nope" }, action: "replace" })).toThrow(/locked/);
    const unlocked = { ...project, places: project.places.map((place) => ({ ...place, locked: false })), story: { ...emptyStoryData(), scenarios: [{ id: "s", name: "Scene", patches: [], steps: [{ id: "step", name: "Moment", patches: [] }] }] } };
    const next = applyProjectStoryMetadata(unlocked, { refs: [{ kind: "place", id: "place" }], metadata: { narrativeLabel: "Scene" }, action: "replace", context: { scenarioId: "s", stepId: "step" } });
    expect(next.places[0]?.name).toBe("Old"); expect(next.story.scenarios[0]?.steps[0]?.patches[0]?.title).toBe("Scene");
  });

  it("inherits native parent permissions and lets scenario access patches participate", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "level", name: "Level", kind: "level" as const, access: [], transform: { x: 0, y: 0, rotation: 0 }, tags: [], properties: {} }, { id: "child", name: "Child", parentId: "level", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, access: [], tags: [], properties: {} }], story: { ...emptyStoryData(), world: [{ id: "staff", kind: "access-group" as const, name: "Staff", tags: [], properties: {} }, { id: "guest", kind: "access-group" as const, name: "Guest", tags: [], properties: {} }], memberships: [{ subjectId: "alice", groupId: "staff", kind: "member-of" as const, source: "manual" as const }], objects: [{ ref: { kind: "place" as const, id: "level" }, metadata: { access: { allow: ["staff"], deny: [], permission: "restricted" as const, physicalState: "open" as const, keyIds: [], guardIds: [], secretKnowledge: [] } } }], scenarios: [{ id: "s", name: "Scene", patches: [{ id: "p", target: { kind: "place" as const, id: "child" }, metadata: { access: { allow: ["guest"], deny: [], permission: "restricted" as const, physicalState: "open" as const, keyIds: [], guardIds: [], secretKnowledge: [] } } }], steps: [] }] } as StoryData };
    expect(projectStoryAccess(project, { kind: "place", id: "child" }, "alice").allowed).toBe(true);
    expect(projectStoryAccess(project, { kind: "place", id: "child" }, "bob", { scenarioId: "s" }).allowed).toBe(false);
  });

  it("inherits an explicit nobody permission through native parent places", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "world", name: "World", kind: "world" as const, access: [], transform: { x: 0, y: 0, rotation: 0 }, tags: [], properties: {} }, { id: "child", name: "Child", parentId: "world", kind: "custom" as const, access: [], transform: { x: 0, y: 0, rotation: 0 }, tags: [], properties: {} }], story: { ...emptyStoryData(), world: [{ id: "alice", kind: "character" as const, name: "Alice", tags: [], properties: {} }], objects: [{ ref: { kind: "place" as const, id: "world" }, metadata: { access: { allow: [], deny: [], permission: "nobody" as const, physicalState: "open" as const, lock: "none" as const, keyIds: [], guardIds: [], secretKnowledge: [] } } }] } as StoryData };
    expect(projectStoryAccess(project, { kind: "place", id: "child" }, "alice")).toMatchObject({ allowed: false, reason: "nobody" });
  });

  it("applies parent scenario metadata to descendants and lets the nearest parent win scalars", () => {
    const project = { ...emptyProject("p", "P"), places: [
      { id: "world", name: "World", kind: "world" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      { id: "building", name: "Building", parentId: "world", kind: "building" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      { id: "child", name: "Child", parentId: "building", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
    ], story: { ...emptyStoryData(), objects: [
      { ref: { kind: "place" as const, id: "world" }, metadata: { properties: { climate: "temperate", inherited: "outer" } } },
      { ref: { kind: "place" as const, id: "building" }, metadata: { properties: { inherited: "nearest", buildingOnly: true } } },
    ], scenarios: [{ id: "winter", name: "Winter", patches: [{ id: "weather", target: { kind: "place" as const, id: "world" }, properties: { season: "winter" } }], steps: [] }] } as StoryData };
    const result = effectiveProjectStoryObject(project, { kind: "place", id: "child" }, { scenarioId: "winter" });
    expect(result?.metadata.properties).toMatchObject({ climate: "temperate", inherited: "nearest", buildingOnly: true, season: "winter" });
    expect(result?.effectiveProperties).toEqual(expect.arrayContaining([
      expect.objectContaining({ propertyId: "inherited", value: "nearest", source: "parent:building:base" }),
      expect.objectContaining({ propertyId: "season", value: "winter", source: "parent:world:scenario" }),
    ]));
  });

  it("uses hydrated parent metadata for project lens predicates", () => {
    const project = { ...emptyProject("lens-project", "Lens"), places: [
      { id: "floor", name: "Floor", kind: "level" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      { id: "room", name: "Room", parentId: "floor", kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
    ], story: { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }], objects: [{ ref: { kind: "place" as const, id: "floor" }, metadata: { owners: ["anna"] } }], scenarios: [{ id: "night", name: "Night", patches: [{ id: "owner", target: { kind: "place" as const, id: "floor" }, metadata: { owners: ["anna"] } }], steps: [] }], lenses: [{ id: "owner", name: "Anna", color: "#123456", expression: { kind: "predicate" as const, predicate: { kind: "owner" as const, entryId: "anna" } } }] } as StoryData };
    const roomRef = { kind: "room" as const, id: "room", scopeId: "floor" };
    expect(evaluateProjectLens(project, project.story, "owner", roomRef)?.match).toBe(true);
    expect(evaluateProjectLens(project, project.story, "owner", roomRef, { scenarioId: "night" })?.match).toBe(true);
  });

  it("rejects duplicate refs after canonical scope resolution", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "level", name: "Level", kind: "level" as const, constructionId: "plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, { id: "room", name: "Room", parentId: "level", kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], constructions: [{ id: "plan", revision: 0, walls: [], rooms: [{ id: "room", faceId: "face", name: "Room", tags: [], access: [], properties: {} }], openings: [], transitions: [] }] };
    expect(() => applyProjectStoryMetadata(project, { refs: [{ kind: "room", id: "room" }, { kind: "room", id: "room", scopeId: "level" }], metadata: { tags: ["x"] }, action: "add" })).toThrow(/duplicate canonical/);
  });

  it("normalizes owner-place scopes for structural objects in groups and scenarios", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "level", name: "Level", kind: "level" as const, constructionId: "construction", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], constructions: [{ id: "construction", revision: 0, walls: [], rooms: [], openings: [{ id: "door", kind: "door" as const, wallId: "wall", position: .5, width: 1 }], transitions: [] }], story: { ...emptyStoryData(), objects: [{ ref: { kind: "opening" as const, id: "door", scopeId: "level" }, metadata: {} }], groups: [{ id: "doors", name: "Doors", memberRefs: [{ kind: "opening" as const, id: "door", scopeId: "level" }], entryIds: [], metadata: {} }], scenarios: [{ id: "night", name: "Night", patches: [{ id: "close", target: { kind: "opening" as const, id: "door", scopeId: "level" }, properties: { mood: "night" } }], steps: [] }] } } as ReturnType<typeof emptyProject>;
    const canonical = projectStoryData(project);
    expect(canonical.objects[0]?.ref.scopeId).toBe("construction");
    expect(canonical.zones[0]?.members[0]?.ref.scopeId).toBe("construction");
    expect(canonical.zones[0]).toMatchObject({ id: "doors", legacyGroupId: "doors", name: "Doors" });
    expect(canonical.scenarios[0]?.patches[0]?.target.scopeId).toBe("construction");
    expect(effectiveProjectStoryObject(project, { kind: "opening", id: "door", scopeId: "level" })?.ref.scopeId).toBe("construction");
    expect(effectiveProjectStoryObject(project, { kind: "opening", id: "door", scopeId: "level" }, { scenarioId: "night" })?.metadata.properties?.mood).toBe("night");
    const withLens = { ...project, story: { ...project.story, lenses: [{ id: "doors", name: "Doors", color: "#123456", expression: { kind: "predicate" as const, predicate: { kind: "group" as const, groupId: "doors" } } }] } };
    expect(evaluateProjectLens(withLens, withLens.story, "doors", { kind: "opening", id: "door", scopeId: "level" })?.match).toBe(true);
  });

  it("updates only the scoped native room mirror when room ids repeat", () => {
    const room = (id: string, parentId: string, name: string) => ({ id, name, parentId, kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    const project = { ...emptyProject("p", "P"), places: [
      { id: "level-a", name: "A", kind: "level" as const, constructionId: "plan-a", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      { id: "level-b", name: "B", kind: "level" as const, constructionId: "plan-b", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      room("room", "level-a", "Room A"), room("room", "level-b", "Room B"),
    ], constructions: [{ id: "plan-a", revision: 0, walls: [], rooms: [], openings: [], transitions: [] }, { id: "plan-b", revision: 0, walls: [], rooms: [], openings: [], transitions: [] }] } as ReturnType<typeof emptyProject>;
    const next = applyProjectStoryMetadata(project, { refs: [{ kind: "room", id: "room", scopeId: "plan-a" }], metadata: { narrativeLabel: "Changed" }, action: "replace" });
    expect(next.places.filter(({ kind, name }) => kind === "room" && name === "Changed")).toHaveLength(1);
    expect(next.places.find(({ parentId }) => parentId === "level-b")?.name).toBe("Room B");
  });

  it("rejects a typed property when a mixed selection contains an incompatible kind", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "place", name: "Place", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, { id: "room", name: "Room", kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], story: { ...emptyStoryData(), propertyDefinitions: [{ id: "mood", name: "Mood", type: "text" as const, targetKinds: ["room" as const] }] } } as ReturnType<typeof emptyProject>;
    expect(() => applyProjectStoryMetadata(project, { refs: [{ kind: "place", id: "place" }, { kind: "room", id: "room" }], metadata: { properties: { mood: "quiet" } }, action: "add" })).toThrow(/not applicable/);
  });

  it("accepts an owner-place opening scope for key assignment", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "level", name: "Level", kind: "level" as const, constructionId: "construction", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], constructions: [{ id: "construction", revision: 0, walls: [], rooms: [], openings: [{ id: "door", kind: "door" as const, wallId: "wall", position: .5, width: 1 }], transitions: [] }], story: { ...emptyStoryData(), world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }], objects: [{ ref: { kind: "opening" as const, id: "door", scopeId: "construction" }, metadata: {} }] } } as ReturnType<typeof emptyProject>;
    const next = assignProjectKeyHolders(project, { ref: { kind: "opening", id: "door", scopeId: "level" }, holderIds: ["anna"] });
    expect(next.story.objects[0]?.metadata.access?.keyIds).toHaveLength(1);
  });

  it("treats a room-shaped place selection as its canonical room reference", () => {
    const project = { ...emptyProject("p", "P"), places: [{ id: "level", name: "Level", kind: "level" as const, constructionId: "plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, { id: "room", name: "Room", parentId: "level", kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], constructions: [{ id: "plan", revision: 0, walls: [], rooms: [], openings: [], transitions: [] }] } as ReturnType<typeof emptyProject>;
    expect(resolveStoryObject(project, emptyStoryData(), { kind: "place", id: "room" })?.ref).toEqual({ kind: "room", id: "room", scopeId: "plan" });
  });
});
