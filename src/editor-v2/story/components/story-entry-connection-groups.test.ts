import { describe, expect, it } from "vitest";
import type { StoryResolvedObject } from "./story-types";
import { ownershipDisplayGroups } from "./story-entry-connection-groups";

function object(id: string, kind: StoryResolvedObject["ref"]["kind"], ownerPlaceId: string | undefined, owners: string[], name = id): StoryResolvedObject {
  return { ref: { kind, id }, name, ownerPlaceId, metadata: { owners } };
}

describe("ownership display groups", () => {
  it("shows an owned parent once, retains details, and collapses excluded branches into exceptions", () => {
    const objects = [
      object("estate", "place", undefined, ["helena"], "Estate"),
      object("ground", "place", "estate", ["helena"], "Ground Floor"),
      object("salon", "room", "ground", ["helena"], "Salon"),
      object("desk", "element", "salon", ["helena"], "Desk"),
      object("private", "room", "ground", ["edmund"], "Private Room"),
      object("private-chair", "element", "private", ["edmund"], "Private Chair"),
      object("salon-door", "opening", "ground", ["helena"], "Salon Door"),
    ];
    const groups = ownershipDisplayGroups(objects, "helena");
    expect(groups.roots.map(({ name }) => name)).toEqual(["Estate"]);
    expect(groups.inherited.map(({ name }) => name)).toEqual(["Desk", "Ground Floor", "Salon"]);
    expect(groups.exceptions.map(({ name }) => name)).toEqual(["Private Room"]);
    expect(groups.structural.map(({ name }) => name)).toEqual(["Salon Door"]);
  });
});
