import { describe, expect, it } from "vitest";
import { storyCollectionEntryId } from "./collection-identity";

describe("Story collection identity", () => {
  it("does not depend on JSON property order", () => {
    expect(storyCollectionEntryId({ ref: { kind: "room", id: "r", scopeId: "f" } })).toBe(storyCollectionEntryId({ ref: { scopeId: "f", id: "r", kind: "room" } }));
  });
  it("keeps identical room ids on different floors distinct", () => {
    expect(storyCollectionEntryId({ ref: { kind: "room", id: "r", scopeId: "f" } })).not.toBe(storyCollectionEntryId({ ref: { kind: "room", id: "r", scopeId: "g" } }));
  });
  it("keeps memberships stable across list reorderings and kinds", () => {
    expect(storyCollectionEntryId({ groupId: "g", subjectId: "a", kind: "knows" })).toBe('["a","g","knows"]');
    expect(storyCollectionEntryId({ groupId: "g", subjectId: "a", kind: "knows" })).not.toBe(storyCollectionEntryId({ groupId: "g", subjectId: "a", kind: "holds-key" }));
  });
});
