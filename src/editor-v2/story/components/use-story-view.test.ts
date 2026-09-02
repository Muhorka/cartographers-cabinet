import { describe, expect, it } from "vitest";
import { emptyStoryData, storyRefKey } from "../types";
import { storyDataSchema } from "../schema";
import { collectionItems } from "./story-types";
import { replaceStoryCollection } from "./use-story-view";

describe("story view typed collection adapter", () => {
  it("preserves authored world properties while renaming", () => {
    const story = { ...emptyStoryData(), world: [{ id: "keeper", kind: "character" as const, name: "Keeper", tags: ["quiet"], properties: { rank: 2 } }], memberships: [{ subjectId: "keeper", groupId: "staff", kind: "member-of" as const, source: "imported" as const, note: "archive" }] };
    const item = collectionItems(story, "characters")[0]!;
    const next = replaceStoryCollection(story, "characters", [{ ...item, name: "Archivist" }]);
    expect(next.world[0]).toMatchObject({ name: "Archivist", tags: ["quiet"], properties: { rank: 2 } });
    expect(next.memberships[0]).toMatchObject({ source: "imported", note: "archive" });
  });

  it("preserves hidden legacy knowledge data when the visible profile description changes", () => {
    const story = { ...emptyStoryData(), world: [{ id: "keeper", kind: "character" as const, name: "Keeper", tags: [], properties: {} }, { id: "staff", kind: "access-group" as const, name: "Staff", tags: [], properties: {} }], memberships: [{ subjectId: "keeper", groupId: "staff", kind: "knows" as const, source: "legacy" as const }] };
    const item = collectionItems(story, "characters")[0]!;
    const next = replaceStoryCollection(story, "characters", [{ ...item, description: "Knows every important detail." }]);
    expect(next.memberships).toContainEqual({ subjectId: "keeper", groupId: "staff", kind: "knows", source: "legacy" });
  });

  it("preserves group metadata and scenario patches on ordinary edits", () => {
    const target = { kind: "room" as const, id: "room-1", scopeId: "level-1" };
    const story = { ...emptyStoryData(), objects: [{ ref: target, metadata: {} }], groups: [{ id: "group", name: "Wardens", memberRefs: [target], entryIds: [], metadata: { tags: ["trusted"], properties: { priority: 1 } } }], scenarios: [{ id: "night", name: "Night", patches: [{ id: "patch", target, description: "Lights out" }], steps: [{ id: "step", name: "Lock", patches: [{ id: "step-patch", target, description: "Close door" }] }] }] };
    const group = collectionItems(story, "objectGroups")[0]!;
    const scenario = collectionItems(story, "scenarios")[0]!;
    const withGroup = replaceStoryCollection(story, "objectGroups", [{ ...group, name: "Night wardens" }]);
    const next = replaceStoryCollection(withGroup, "scenarios", [{ ...scenario, name: "After dark" }]);
    expect(next.groups[0]).toMatchObject({ name: "Night wardens", memberRefs: [target], metadata: { tags: ["trusted"], properties: { priority: 1 } } });
    expect(next.scenarios[0]?.patches[0]).toMatchObject({ description: "Lights out" });
    expect(next.scenarios[0]?.steps[0]?.patches[0]).toMatchObject({ description: "Close door" });
  });

  it("keeps a relation source and target refs when its label changes", () => {
    const story = { ...emptyStoryData(), relations: [{ id: "r", from: { entryId: "keeper" }, to: { entryId: "gate" }, kind: "guards" as const, label: "old" }] };
    const relation = collectionItems(story, "relations")[0]!;
    const next = replaceStoryCollection(story, "relations", [{ ...relation, name: "new" }]);
    expect(next.relations[0]).toMatchObject({ from: { entryId: "keeper" }, to: { entryId: "gate" }, label: "new" });
  });

  it("preserves a canonical lens favorite while editing its name", () => {
    const story = { ...emptyStoryData(), lenses: [{ id: "lens", name: "Quiet", color: "#123456", favorite: true, expression: { kind: "all" as const, items: [] } }] };
    const item = collectionItems(story, "lenses")[0]!;
    const next = replaceStoryCollection(story, "lenses", [{ ...item, name: "Very quiet" }]);
    expect(next.lenses[0]).toMatchObject({ name: "Very quiet", favorite: true });
  });

  it("round-trips unannotated project refs without collapsing scoped room ids", () => {
    const place = { kind: "place" as const, id: "courtyard" };
    const eastRoom = { kind: "room" as const, id: "hall", scopeId: "east" };
    const westRoom = { kind: "room" as const, id: "hall", scopeId: "west" };
    const story = { ...emptyStoryData(), groups: [{ id: "group", name: "All", memberRefs: [], entryIds: [], metadata: {} }] };
    const item = { ...collectionItems(story, "objectGroups")[0]!, memberRefs: [storyRefKey(place), storyRefKey(eastRoom), storyRefKey(westRoom)] };
    const next = replaceStoryCollection(story, "objectGroups", [item], [place, eastRoom, westRoom].map((ref) => ({ ref, name: ref.id })));
    expect(next.groups[0]?.memberRefs).toEqual([place, eastRoom, westRoom]);
  });

  it("round-trips group metadata, access and member refs through the editor record", () => {
    const room = { kind: "room" as const, id: "hall", scopeId: "east" };
    const story = { ...emptyStoryData(), objects: [{ ref: room, metadata: {} }], groups: [{ id: "group", name: "Wardens", memberRefs: [room], entryIds: ["keeper"], metadata: { owners: ["keeper"], tags: ["trusted"], properties: { rank: 2 }, access: { allow: ["guards"], deny: ["intruders"], permission: "restricted" as const, physicalState: "closed" as const, lock: "locked" as const, keyIds: ["iron-key"], guardIds: ["guard"], secretKnowledge: ["keeper"] } } }] };
    const item = collectionItems(story, "objectGroups")[0]!;
    const metadata = story.groups[0]!.metadata;
    const next = replaceStoryCollection(story, "objectGroups", [{ ...item, name: "Night wardens", metadata: { ...metadata, tags: ["trusted", "night"], properties: { rank: 3 } } }]);
    expect(next.groups[0]).toMatchObject({ name: "Night wardens", memberRefs: [room], entryIds: ["keeper"], metadata: { owners: ["keeper"], tags: ["trusted", "night"], properties: { rank: 3 }, access: { permission: "restricted", physicalState: "closed", lock: "locked", keyIds: ["iron-key"] } } });
  });

  it("preserves zone relation, partial flag and note when its name is edited", () => {
    const room = { kind: "room" as const, id: "hall", scopeId: "east" };
    const story = { ...emptyStoryData(), zones: [{ id: "zone", name: "Old zone", members: [{ ref: room, relation: "overlaps" as const, partial: true, note: "threshold only" }], tags: ["public"] }] };
    const item = collectionItems(story, "zones")[0]!;
    const next = replaceStoryCollection(story, "zones", [{ ...item, name: "New zone" }]);
    expect(next.zones[0]).toMatchObject({ name: "New zone", tags: ["public"], members: [{ ref: room, relation: "overlaps", partial: true, note: "threshold only" }] });
  });

  it("preserves zone-owned metadata and color when editing the collection record", () => {
    const room = { kind: "room" as const, id: "hall", scopeId: "east" };
    const story = { ...emptyStoryData(), zones: [{ id: "zone", name: "Old zone", members: [{ ref: room, relation: "inside" as const, partial: false }], tags: [], color: "#123456", metadata: { narrativeDescription: "A private court", properties: { mood: "quiet" } } }] };
    const item = collectionItems(story, "zones")[0]!;
    const next = replaceStoryCollection(story, "zones", [{ ...item, name: "Renamed zone" }]);
    expect(next.zones[0]).toMatchObject({ name: "Renamed zone", color: "#123456", metadata: { narrativeDescription: "A private court", properties: { mood: "quiet" } } });
  });

  it("does not silently remove a legacy wall member when only the zone name changes", () => {
    const wall = { kind: "wall" as const, id: "technical-wall", scopeId: "plan" };
    const story = { ...emptyStoryData(), zones: [{ id: "zone", name: "Old zone", members: [{ ref: wall, relation: "inside" as const, partial: false }], tags: [] }] };
    const item = collectionItems(story, "zones")[0]!;
    const next = replaceStoryCollection(story, "zones", [{ ...item, name: "Renamed zone" }]);
    expect(next.zones[0]?.members).toEqual([{ ref: wall, relation: "inside", partial: false }]);
  });

  it("round-trips relation canonical refs, kind and source", () => {
    const from = { kind: "place" as const, id: "courtyard" };
    const to = { kind: "room" as const, id: "hall", scopeId: "east" };
    const story = { ...emptyStoryData(), objects: [{ ref: from, metadata: {} }, { ref: to, metadata: {} }], relations: [{ id: "r", from, to, kind: "guards" as const, source: "chronicle", label: "Watch" }] };
    const item = collectionItems(story, "relations")[0]!;
    const next = replaceStoryCollection(story, "relations", [{ ...item, name: "Night watch", kind: "visits", source: "map note" }]);
    expect(next.relations[0]).toMatchObject({ from, to, kind: "visits", source: "map note", label: "Night watch" });
  });

  it("round-trips a relation description", () => {
    const story = { ...emptyStoryData(), relations: [{ id: "r", from: { entryId: "keeper" }, to: { entryId: "gate" }, kind: "visits" as const, label: "Visit", description: "Only at dusk." }] };
    const item = collectionItems(story, "relations")[0]!;
    const next = replaceStoryCollection(story, "relations", [{ ...item, description: "Only after the bell." }]);
    expect(next.relations[0]?.description).toBe("Only after the bell.");
  });

  it("round-trips every intention field using canonical object references", () => {
    const subject = { kind: "place" as const, id: "courtyard" };
    const target = { kind: "room" as const, id: "hall", scopeId: "east" };
    const through = { kind: "opening" as const, id: "gate", scopeId: "east" };
    const story = { ...emptyStoryData(), objects: [{ ref: subject, metadata: {} }, { ref: target, metadata: {} }, { ref: through, metadata: {} }], zones: [{ id: "forbidden", name: "Forbidden", members: [], tags: [] }], world: [{ id: "guard", kind: "access-group" as const, name: "Guard", tags: [], properties: {} }], intentions: [{ id: "i", authorId: "scribe", subject, kind: "reachability" as const, text: "Reach the hall", status: "draft" as const, target, through: [through], avoidZoneId: "forbidden", accessEntryId: "guard" }] };
    const item = collectionItems(story, "intentions")[0]!;
    const next = replaceStoryCollection(story, "intentions", [{ ...item, kind: "avoid-zone", text: "Do not cross", status: "accepted", authorId: "captain", avoidZoneId: "forbidden", accessEntryId: "guard" }]);
    expect(next.intentions[0]).toMatchObject({ authorId: "captain", subject, kind: "avoid-zone", text: "Do not cross", status: "accepted", target, through: [through], avoidZoneId: "forbidden", accessEntryId: "guard" });
  });

  it("clears optional intention references instead of copying stale values", () => {
    const subject = { kind: "place" as const, id: "courtyard" };
    const target = { kind: "room" as const, id: "hall", scopeId: "east" };
    const story = { ...emptyStoryData(), objects: [{ ref: subject, metadata: {} }, { ref: target, metadata: {} }], intentions: [{ id: "i", subject, kind: "reachability" as const, text: "Reach", status: "draft" as const, target, through: [target], avoidZoneId: "zone", accessEntryId: "gate" }] };
    const item = collectionItems(story, "intentions")[0]!;
    const next = replaceStoryCollection(story, "intentions", [{ ...item, targetRef: "", throughRefs: [], avoidZoneId: "", accessEntryId: "" }]);
    expect(next.intentions[0]).not.toHaveProperty("target");
    expect(next.intentions[0]).toMatchObject({ subject, through: [], text: "Reach", status: "draft" });
    expect(next.intentions[0]).not.toHaveProperty("avoidZoneId");
    expect(next.intentions[0]).not.toHaveProperty("accessEntryId");
  });

  it("removes memberships owned by deleted world entries without leaving dangling ids", () => {
    const story = { ...emptyStoryData(), world: [{ id: "keeper", kind: "character" as const, name: "Keeper", tags: [], properties: {} }, { id: "guards", kind: "access-group" as const, name: "Guards", tags: [], properties: {} }], memberships: [{ subjectId: "keeper", groupId: "guards", kind: "member-of" as const, source: "manual" as const }, { subjectId: "other", groupId: "keeper", kind: "knows" as const, source: "manual" as const }] };
    const next = replaceStoryCollection(story, "characters", []);
    expect(next.memberships).toEqual([]);
  });

  it("creates a relation with selected endpoints that passes the canonical schema", () => {
    const story = emptyStoryData();
    const next = replaceStoryCollection(story, "relations", [{ id: "r", name: "Watch", fromRefs: "entryId:keeper", toRefs: "entryId:gate", kind: "guards", source: "chronicle" }]);
    expect(next.relations[0]).toMatchObject({ id: "r", from: { entryId: "keeper" }, to: { entryId: "gate" }, kind: "guards", source: "chronicle", label: "Watch" });
    expect(storyDataSchema.safeParse(next).success).toBe(true);
  });

  it("round-trips scenario description and step text without dropping patches", () => {
    const target = { kind: "room" as const, id: "hall", scopeId: "east" };
    const story = { ...emptyStoryData(), objects: [{ ref: target, metadata: {} }], scenarios: [{ id: "night", name: "Night", description: "Base", patches: [{ id: "p", target, description: "Close" }], steps: [{ id: "step", name: "Lock", description: "Secure the door", patches: [{ id: "sp", target, description: "Close door" }] }] }] };
    const item = collectionItems(story, "scenarios")[0]!;
    const steps = item.steps as Array<Record<string, unknown>>;
    const next = replaceStoryCollection(story, "scenarios", [{ ...item, description: "Updated", steps: [{ ...(steps[0] ?? {}), name: "Secure", description: "Latch the door" }] }]);
    expect(next.scenarios[0]).toMatchObject({ description: "Updated", patches: [{ id: "p", description: "Close" }], steps: [{ id: "step", name: "Secure", description: "Latch the door", patches: [{ id: "sp" }] }] });
  });
});
