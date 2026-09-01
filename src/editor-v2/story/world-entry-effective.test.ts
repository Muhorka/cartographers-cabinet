import { describe, expect, it } from "vitest";
import { effectiveWorldEntries, effectiveWorldEntry } from "./world-entry-effective";
import { emptyStoryData, type StoryData } from "./types";

function fixture(): StoryData {
  return {
    ...emptyStoryData(),
    world: [
      { id: "anna", kind: "character", name: "Anna", tags: ["local"], properties: { role: "warden", own: true } },
      { id: "staff", kind: "access-group", name: "Staff", tags: ["people"], properties: { role: "warden", uniform: "blue" } },
      { id: "guardians", kind: "access-group", name: "Guardians", tags: ["order"], properties: { duty: "watch" } },
    ],
    memberships: [
      { subjectId: "anna", groupId: "staff", kind: "member-of", source: "manual" },
      { subjectId: "staff", groupId: "guardians", kind: "member-of", source: "manual" },
    ],
  };
}

describe("effectiveWorldEntry", () => {
  it("inherits direct and transitive group traits while preserving own values", () => {
    const result = effectiveWorldEntry(fixture(), "anna");
    expect(result?.properties).toEqual({ role: "warden", own: true, uniform: "blue", duty: "watch" });
    expect(result?.tags).toEqual(["local", "people", "order"]);
    expect(result?.inheritedFrom).toEqual(["staff", "guardians"]);
    expect(result?.propertySources.role).toMatchObject({ value: "warden", sourceIds: ["anna"], inherited: false, conflict: false });
    expect(result?.propertySources.uniform).toMatchObject({ value: "blue", sourceIds: ["staff"], inherited: true, conflict: false });
  });

  it("inherits traits from a faction directly and through a group chain", () => {
    const story = fixture();
    story.world.push(
      { id: "guild", kind: "faction", name: "Guild", tags: ["faction"], properties: { rank: "member" } },
      { id: "court", kind: "faction", name: "Court", tags: [], properties: { jurisdiction: "north" } },
    );
    story.memberships.push(
      { subjectId: "anna", groupId: "guild", kind: "member-of", source: "manual" },
      { subjectId: "guardians", groupId: "court", kind: "member-of", source: "manual" },
    );
    const result = effectiveWorldEntry(story, "anna");
    expect(result?.properties).toMatchObject({ rank: "member", jurisdiction: "north" });
    expect(result?.inheritedFrom).toEqual(["staff", "guild", "guardians", "court"]);
    expect(result?.tags).toEqual(["local", "people", "faction", "order"]);
  });

  it("merges provenance for equal values inherited from multiple groups", () => {
    const story = fixture();
    story.world.push(
      { id: "night-watch", kind: "access-group", name: "Night watch", tags: [], properties: { duty: "watch" } },
    );
    story.memberships.push({ subjectId: "anna", groupId: "night-watch", kind: "member-of", source: "imported" });
    const result = effectiveWorldEntry(story, "anna");
    expect(result?.propertySources.duty).toMatchObject({ value: "watch", sourceIds: ["night-watch", "guardians"], inherited: true, conflict: false });
    expect(result?.conflicts).toEqual([]);
  });

  it("keeps disagreeing inherited values as a visible conflict without choosing one", () => {
    const story = fixture();
    story.world.push(
      { id: "east", kind: "access-group", name: "East", tags: [], properties: { color: "red" } },
      { id: "west", kind: "access-group", name: "West", tags: [], properties: { color: "blue" } },
    );
    story.memberships.push(
      { subjectId: "anna", groupId: "east", kind: "member-of", source: "manual" },
      { subjectId: "anna", groupId: "west", kind: "member-of", source: "manual" },
    );
    const result = effectiveWorldEntry(story, "anna");
    expect(result?.properties).not.toHaveProperty("color");
    expect(result?.conflicts).toEqual([{ propertyId: "color", values: [{ value: "red", sourceIds: ["east"] }, { value: "blue", sourceIds: ["west"] }] }]);
    expect(result?.propertySources.color).toMatchObject({ inherited: true, conflict: true, sourceIds: ["east", "west"] });
  });

  it("lets an own value resolve an otherwise conflicting inheritance", () => {
    const story = fixture();
    story.world.find(({ id }) => id === "anna")!.properties.color = "green";
    story.world.push(
      { id: "east", kind: "access-group", name: "East", tags: [], properties: { color: "red" } },
      { id: "west", kind: "access-group", name: "West", tags: [], properties: { color: "blue" } },
    );
    story.memberships.push(
      { subjectId: "anna", groupId: "east", kind: "member-of", source: "manual" },
      { subjectId: "anna", groupId: "west", kind: "member-of", source: "manual" },
    );
    const result = effectiveWorldEntry(story, "anna");
    expect(result?.properties.color).toBe("green");
    expect(result?.propertySources.color).toMatchObject({ value: "green", sourceIds: ["anna"], inherited: false, conflict: false });
    expect(result?.conflicts).toEqual([]);
  });

  it("terminates safely for cyclic group memberships", () => {
    const story = fixture();
    story.memberships.push(
      { subjectId: "guardians", groupId: "staff", kind: "member-of", source: "legacy" },
    );
    const result = effectiveWorldEntry(story, "anna");
    expect(result?.inheritedFrom).toEqual(["staff", "guardians"]);
    expect(result?.properties.duty).toBe("watch");
  });

  it("does not retain inheritance after membership removal and returns nothing for unknown entries", () => {
    const story = fixture();
    story.memberships = story.memberships.filter(({ subjectId, groupId }) => !(subjectId === "anna" && groupId === "staff"));
    const result = effectiveWorldEntry(story, "anna");
    expect(result?.properties).toEqual({ role: "warden", own: true });
    expect(result?.inheritedFrom).toEqual([]);
    expect(effectiveWorldEntry(story, "missing")).toBeUndefined();
  });

  it("resolves every world entry through the same non-mutating API", () => {
    const story = fixture();
    const results = effectiveWorldEntries(story);
    expect(results).toHaveLength(story.world.length);
    expect(story.world.find(({ id }) => id === "anna")?.properties).toEqual({ role: "warden", own: true });
    expect(results.find(({ id }) => id === "staff")?.properties).toMatchObject({ duty: "watch" });
  });
});
