import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import type { CanonicalWall } from "../geometry/geometry-types";
import { emptyProject } from "../model/project-model";
import { applyProjectStoryMetadata } from "./project-commands";
import { effectiveProjectStoryObject } from "./project-effective";
import { storyDataSchema } from "./schema";
import { defaultStoryAccessPolicy } from "./types";

function fixture() {
  const project = emptyProject("field-edits", "Field edits");
  return {
    ...project,
    places: ["a", "b"].map((id) => ({ id, name: id, description: "Existing", kind: "custom" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} })),
    story: {
      ...project.story,
      objects: ["a", "b"].map((id) => ({ ref: { kind: "place" as const, id }, metadata: { access: { ...defaultStoryAccessPolicy(), allow: [id], keyIds: [`key-${id}`] } } })),
      scenarios: [{ id: "night", name: "Night", patches: [], steps: [] }],
    },
  };
}

describe("shared sparse Story field edits", () => {
  it("preserves each selected object's unedited access fields", () => {
    const before = fixture();
    const after = applyProjectStoryMetadata(before, {
      refs: before.story.objects.map(({ ref }) => ref), action: "replace",
      metadata: { access: { ...defaultStoryAccessPolicy(), physicalState: "closed" } }, accessFields: ["physicalState"],
    });
    for (const id of ["a", "b"]) {
      const access = effectiveProjectStoryObject(after, { kind: "place", id })?.metadata.access;
      expect(access).toMatchObject({ allow: [id], keyIds: [`key-${id}`], physicalState: "closed" });
    }
    expect(before.story.objects[0].metadata.access.physicalState).toBe("open");
  });

  it("applies the same sparse edit to the scenario without changing base facts", () => {
    const before = fixture(); const ref = { kind: "place" as const, id: "a" };
    const after = applyProjectStoryMetadata(before, { refs: [ref], action: "replace", context: { scenarioId: "night" }, metadata: { access: { ...defaultStoryAccessPolicy(), physicalState: "closed" } }, accessFields: ["physicalState"] });
    expect(effectiveProjectStoryObject(after, ref)?.metadata.access?.physicalState).toBe("open");
    expect(effectiveProjectStoryObject(after, ref, { scenarioId: "night" })?.metadata.access).toMatchObject({ allow: ["a"], keyIds: ["key-a"], physicalState: "closed" });
    expect(before.story.scenarios[0].patches).toEqual([]);
  });

  it("does not turn an inherited Nobody rule into a permanent local door rule", () => {
    const wall: CanonicalWall = { id: "wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "partition", thickness: 0.2 };
    const construction = createConstructionDocument("plan", [wall], { createId: () => "room", createName: () => "Room" });
    construction.openings = [{ id: "door", kind: "door", wallId: wall.id, position: 0.5, width: 1 }];
    const before = emptyProject("zone-door", "Zone door");
    before.places.push({ id: "level", name: "Level", kind: "level", constructionId: construction.id, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    before.constructions.push(construction);
    const ref = { kind: "opening" as const, id: "door", scopeId: construction.id };
    before.story.zones = [{ id: "ruins", name: "Ruins", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { access: { ...defaultStoryAccessPolicy(), permission: "nobody" } } }];

    const edited = applyProjectStoryMetadata(before, {
      refs: [ref], action: "replace",
      metadata: { access: { ...defaultStoryAccessPolicy(), physicalState: "closed", lock: "locked" } },
      accessFields: ["physicalState", "lock"],
    });
    const authored = edited.story.objects.find(({ ref: candidate }) => candidate.kind === ref.kind && candidate.id === ref.id && candidate.scopeId === ref.scopeId)?.metadata.access;
    expect(authored).toMatchObject({ permission: "open", physicalState: "closed", lock: "locked" });
    expect(effectiveProjectStoryObject(edited, ref)?.metadata.access).toMatchObject({ permission: "nobody", physicalState: "closed", lock: "locked" });

    const withoutZone = { ...edited, story: { ...edited.story, zones: [] } };
    expect(effectiveProjectStoryObject(withoutZone, ref)?.metadata.access).toMatchObject({ permission: "open", physicalState: "closed", lock: "locked" });
  });

  it("does not materialize an empty scenario patch and keeps StoryData valid", () => {
    const before = fixture(); const ref = { kind: "place" as const, id: "a" };
    const after = applyProjectStoryMetadata(before, { refs: [ref], action: "replace", context: { scenarioId: "night" }, metadata: {} });
    expect(after.story.scenarios[0]?.patches).toEqual([]);
    expect(storyDataSchema.safeParse(after.story).success).toBe(true);
    expect(after.story.objects).toEqual(before.story.objects);
  });

  it("allows clearing optional descriptions but not required names", () => {
    const before = fixture(); const refs = [{ kind: "place" as const, id: "a" }];
    expect(applyProjectStoryMetadata(before, { refs, action: "replace", metadata: { narrativeDescription: "" } }).places[0].description).toBe("");
    expect(() => applyProjectStoryMetadata(before, { refs, action: "replace", metadata: { narrativeLabel: "" } })).toThrow();
  });
});
