import { describe, expect, it } from "vitest";
import { emptyStoryData, sameStoryRef, storyRefKey, type StoryObjectRef } from "./types";
import { storyDataSchema } from "./schema";

describe("story reference identity", () => {
  it("keeps colons inside scope and id from creating tuple collisions", () => {
    const first: StoryObjectRef = { kind: "wall", scopeId: "a", id: "b:c" };
    const second: StoryObjectRef = { kind: "wall", scopeId: "a:b", id: "c" };

    expect(storyRefKey(first)).not.toBe(storyRefKey(second));
    expect(sameStoryRef(first, second)).toBe(false);
  });

  it("preserves the historical key for common identifier characters", () => {
    expect(storyRefKey({ kind: "opening", scopeId: "level-1", id: "door_2" }))
      .toBe("opening:level-1:door_2");
  });

  it("does not throw or collide for arbitrary JavaScript strings", () => {
    const escaped: StoryObjectRef = { kind: "wall", scopeId: "%3A", id: "\ud800" };
    const literal: StoryObjectRef = { kind: "wall", scopeId: ":", id: "\ud800" };

    expect(() => storyRefKey(escaped)).not.toThrow();
    expect(storyRefKey(escaped)).not.toBe(storyRefKey(literal));
  });

  it("does not report distinct colon-bearing object or membership tuples as duplicates", () => {
    const story = emptyStoryData();
    story.objects = [
      { ref: { kind: "wall", scopeId: "a", id: "b:c" }, metadata: {} },
      { ref: { kind: "wall", scopeId: "a:b", id: "c" }, metadata: {} },
    ];
    story.memberships = [
      { subjectId: "a", groupId: "b:c", kind: "member-of", source: "manual" },
      { subjectId: "a:b", groupId: "c", kind: "member-of", source: "manual" },
    ];
    expect(storyDataSchema.safeParse(story).success).toBe(true);
  });
});
