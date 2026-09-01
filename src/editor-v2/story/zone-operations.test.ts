import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { canonicalZoneRefs, createProjectZone, createZoneFromMixedSelection, editProjectZoneFromSelection, editZoneFromSelection, filterEligibleZoneMembers, isTechnicalWallSegment, zoneMemberRefs } from "./zone-operations";

function fixture() {
  const project = emptyProject("p", "Synthetic");
  project.places = [{ id: "level", name: "Level", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {}, constructionId: "plan" }];
  project.constructions = [{ id: "plan", revision: 0, walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "boundary", thickness: .2 }], rooms: [], openings: [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1 }], transitions: [] }];
  return project;
}

describe("zone selection operations", () => {
  it("canonicalizes refs, removes technical wall segments, and keeps openings", () => {
    const project = fixture();
    expect(isTechnicalWallSegment({ kind: "wall", id: "wall" })).toBe(true);
    expect(canonicalZoneRefs(project, [{ kind: "opening", id: "door" }])).toEqual([{ kind: "opening", id: "door", scopeId: "plan" }]);
    expect(filterEligibleZoneMembers(project, [
      { kind: "wall", id: "wall", scopeId: "plan" },
      { kind: "opening", id: "door", scopeId: "plan" },
      { kind: "opening", id: "door", scopeId: "plan" },
    ])).toEqual([{ kind: "opening", id: "door", scopeId: "plan" }]);
    expect(zoneMemberRefs(project, [{ kind: "opening", id: "door", scopeId: "plan" }])).toHaveLength(1);
  });

  it("creates a distinct zone from mixed selection without changing project geometry", () => {
    const project = fixture();
    const next = createZoneFromMixedSelection(project, { id: "courtyard", name: "Courtyard", refs: [{ kind: "wall", id: "wall", scopeId: "plan" }, { kind: "opening", id: "door", scopeId: "plan" }], metadata: { properties: { mood: "quiet" } } });
    expect(next.constructions).toEqual(project.constructions);
    expect(next.story.zones[0]).toMatchObject({ id: "courtyard", name: "Courtyard", metadata: { properties: { mood: "quiet" } } });
    expect(next.story.zones[0]?.members.map(({ ref }) => ref)).toEqual([{ kind: "opening", id: "door", scopeId: "plan" }]);
    expect(project.story.zones).toEqual([]);
  });

  it("replaces selected members while retaining relation provenance for retained refs", () => {
    const project = fixture();
    const created = createProjectZone(project, { id: "zone", name: "Zone", refs: [{ kind: "opening", id: "door", scopeId: "plan" }] });
    created.story.zones[0]!.members[0] = { ...created.story.zones[0]!.members[0]!, relation: "overlaps", partial: true, note: "threshold" };
    const next = editProjectZoneFromSelection(created, "zone", [{ kind: "opening", id: "door", scopeId: "plan" }, { kind: "wall", id: "wall", scopeId: "plan" }]);
    expect(next.story.zones[0]?.members).toEqual([{ ref: { kind: "opening", id: "door", scopeId: "plan" }, relation: "overlaps", partial: true, note: "threshold" }]);
    expect(editZoneFromSelection(created, "zone", [{ kind: "opening", id: "door", scopeId: "plan" }]).story.zones[0]?.members).toHaveLength(1);
  });
});
