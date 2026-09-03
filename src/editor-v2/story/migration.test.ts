import { describe, expect, it } from "vitest";
import { migrateStoryData, normalizeStoryZones, legacyStoryGroups, replaceLegacyStoryGroups } from "./migration";
import { applyStoryCommand } from "./operations";
import { evaluateLens } from "./evaluation";
import { emptyStoryData, storyRefKey, type StoryGroup } from "./types";

const room = { kind: "room" as const, id: "room", scopeId: "level" };
const metadata = { tags: ["quiet"], properties: { mood: "calm" as const } };

describe("story zone migration", () => {
  it("adds an empty notebook to projects saved before documents existed", () => {
    const legacy = { ...emptyStoryData() } as Record<string, unknown>;
    delete legacy.documents;
    expect(migrateStoryData(legacy).documents).toEqual([]);
  });

  it("moves legacy groups into zones without losing members, metadata, entry ids, or lens predicates", () => {
    const group: StoryGroup = { id: "rooms", name: "Rooms", description: "Shared rooms", memberRefs: [room], entryIds: ["staff"], metadata };
    const story = { ...emptyStoryData(), groups: [group], lenses: [{ id: "rooms-lens", name: "Rooms", color: "#123456", expression: { kind: "all" as const, items: [{ kind: "predicate" as const, predicate: { kind: "group" as const, groupId: "rooms" } }, { kind: "not" as const, item: { kind: "predicate" as const, predicate: { kind: "group" as const, groupId: "unknown" } } }] } }] };
    const migrated = migrateStoryData(story);
    expect(migrated.groups).toEqual([]);
    expect(migrated.zones).toMatchObject([{ id: "rooms", name: "Rooms", description: "Shared rooms", entryIds: ["staff"], legacyGroupId: "rooms", tags: ["quiet"], metadata }]);
    expect(migrated.zones[0]?.members).toEqual([{ ref: room, relation: "inside", partial: false }]);
    expect(migrated.lenses[0]?.expression).toMatchObject({ kind: "all", items: [{ predicate: { kind: "zone", zoneId: "rooms" } }, { kind: "not", item: { predicate: { kind: "group", groupId: "unknown" } } }] });
    expect(evaluateLens(story, "rooms-lens", room)?.match).toBe(true);
    expect(migrateStoryData(migrated)).toEqual(migrated);
  });

  it("keeps an independent zone separate when a legacy group id collides", () => {
    const group: StoryGroup = { id: "rooms", name: "Legacy rooms", memberRefs: [room], entryIds: ["staff"], metadata: {} };
    const independent = { id: "rooms", name: "Independent zone", members: [], tags: [] };
    const migrated = normalizeStoryZones({ ...emptyStoryData(), groups: [group], zones: [independent], lenses: [{ id: "legacy-lens", name: "Legacy", color: "#123456", expression: { kind: "predicate", predicate: { kind: "group", groupId: "rooms" } } }] });
    expect(migrated.zones).toHaveLength(2);
    expect(migrated.zones.find(({ name }) => name === "Independent zone")).toEqual(independent);
    expect(migrated.zones.find(({ legacyGroupId }) => legacyGroupId === "rooms")?.id).toBe("legacy-group:rooms");
    expect(migrated.lenses[0]?.expression).toEqual({ kind: "predicate", predicate: { kind: "zone", zoneId: "legacy-group:rooms" } });
  });

  it("exposes and replaces only imported groups while retaining independent zones", () => {
    const group: StoryGroup = { id: "rooms", name: "Rooms", memberRefs: [room], entryIds: ["staff"], metadata: {} };
    const independent = { id: "independent", name: "Independent", members: [], tags: [] };
    const source = { ...emptyStoryData(), zones: [independent], groups: [group] };
    const migrated = migrateStoryData(source);
    expect(legacyStoryGroups(migrated)).toEqual([group]);
    const replacement = replaceLegacyStoryGroups(migrated, [{ ...group, name: "Updated rooms" }]);
    expect(replacement.groups).toEqual([]);
    expect(replacement.zones).toEqual(expect.arrayContaining([independent, expect.objectContaining({ id: "rooms", name: "Updated rooms", legacyGroupId: "rooms" })]));
    const removed = replaceLegacyStoryGroups(replacement, []);
    expect(removed.zones).toEqual([independent]);
    expect(removed.zones.some(({ id }) => id === storyRefKey(room))).toBe(false);
  });

  it("preserves zone-owned fields and member provenance when a legacy group is renamed", () => {
    const group: StoryGroup = { id: "rooms", name: "Rooms", memberRefs: [room], entryIds: [], metadata: { properties: { shared: "yes" } } };
    const source = migrateStoryData({ ...emptyStoryData(), groups: [group] });
    source.zones[0] = { ...source.zones[0]!, ownerPlaceId: "level", shape: { kind: "rectangle", x: 1, y: 2, width: 3, height: 4 }, color: "#123456", tags: ["map-tag"], metadata: { properties: { shared: "yes" } }, members: [{ ref: room, relation: "overlaps", partial: true, note: "threshold" }] };
    const next = replaceLegacyStoryGroups(source, [{ ...group, name: "Renamed rooms" }]);
    expect(next.zones[0]).toMatchObject({ name: "Renamed rooms", ownerPlaceId: "level", shape: { kind: "rectangle", x: 1, y: 2, width: 3, height: 4 }, color: "#123456", tags: ["map-tag"], metadata: { properties: { shared: "yes" } }, members: [{ ref: room, relation: "overlaps", partial: true, note: "threshold" }] });
  });

  it("reserves retained imported ids before allocating a new colliding group", () => {
    const first: StoryGroup = { id: "first", name: "First", memberRefs: [], entryIds: [], metadata: {} };
    const second: StoryGroup = { id: "second", name: "Second", memberRefs: [], entryIds: [], metadata: {} };
    const source = { ...emptyStoryData(), zones: [{ id: "first", name: "Previously imported second", members: [], tags: [], legacyGroupId: "second" }] };
    const next = replaceLegacyStoryGroups(source, [first, second]);
    expect(next.zones.find(({ legacyGroupId }) => legacyGroupId === "second")?.id).toBe("first");
    expect(next.zones.find(({ legacyGroupId }) => legacyGroupId === "first")?.id).toBe("legacy-group:first");
  });

  it("accepts the old collection-oriented objectGroups input", () => {
    const migrated = migrateStoryData({ objectGroups: [{ id: "rooms", name: "Rooms", memberRefs: [room], entryIds: ["staff"], metadata }] });
    expect(migrated.groups).toEqual([]);
    expect(migrated.zones[0]).toMatchObject({ id: "rooms", legacyGroupId: "rooms", entryIds: ["staff"], members: [{ ref: room }] });
  });

  it("adapts legacy group commands without touching independent zones", () => {
    const group: StoryGroup = { id: "rooms", name: "Rooms", memberRefs: [room], entryIds: ["staff"], metadata: {} };
    const independent = { id: "independent", name: "Independent", members: [], tags: [] };
    const source = migrateStoryData({ ...emptyStoryData(), groups: [group], zones: [independent] });
    const added = applyStoryCommand(source, { kind: "add", collection: "groups", item: { ...group, id: "other", name: "Other" } });
    expect(added.changed).toBe(true);
    expect(added.story.groups).toEqual([]);
    expect(added.story.zones).toEqual(expect.arrayContaining([independent, expect.objectContaining({ legacyGroupId: "other" })]));
    const replaced = applyStoryCommand(added.story, { kind: "replace", collection: "groups", items: [group] });
    expect(replaced.story.zones).toEqual(expect.arrayContaining([independent, expect.objectContaining({ legacyGroupId: "rooms" })]));
    expect(replaced.story.zones.some(({ legacyGroupId }) => legacyGroupId === "other")).toBe(false);
    const removed = applyStoryCommand(replaced.story, { kind: "remove", collection: "groups", id: "rooms" });
    expect(removed.story.zones).toEqual([independent]);
    const cannotRemoveIndependent = applyStoryCommand(removed.story, { kind: "remove", collection: "groups", id: "independent" });
    expect(cannotRemoveIndependent.changed).toBe(false);
    expect(cannotRemoveIndependent.story.zones).toEqual([independent]);
  });
});
