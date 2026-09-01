import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { resolveStoryOwnership, resetStoryOwnership } from "./ownership";
import { effectiveProjectStoryObject, projectZonesForRef } from "./project-effective";
import { storyDataSchema } from "./schema";
import { emptyStoryData, type StoryObjectRef } from "./types";
import { effectiveStoryMetadata } from "./effective";
import { evaluateLens } from "./evaluation";

const ref: StoryObjectRef = { kind: "place", id: "garden" };

function fixture() {
  const project = emptyProject("zone-effective", "Zone effective");
  project.places.push({ id: "garden", name: "Garden", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, tags: [], access: [], properties: {} });
  project.story = storyDataSchema.parse({ ...emptyStoryData(), objects: [{ ref, metadata: { properties: { local: "kept", shared: "local" } } }] });
  return project;
}

describe("project zone effective metadata", () => {
  it("uses the same zone traits in plain metadata and lens evaluation", () => {
    const project = fixture();
    project.story.zones = [{ id: "calm-zone", name: "Calm", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { properties: { calm: true } } }];
    project.story.lenses = [{ id: "calm", name: "Calm places", color: "#abcdef", expression: { kind: "predicate", predicate: { kind: "property", propertyId: "calm", equals: true } } }];
    expect(effectiveStoryMetadata(project.story, ref).metadata.properties).toMatchObject({ local: "kept", calm: true });
    expect(evaluateLens(project.story, "calm", ref)?.match).toBe(true);
    // A missing legacy group must not silently become an unrelated zone with the same id.
    project.story.lenses[0].expression = { kind: "predicate", predicate: { kind: "group", groupId: "calm-zone" } };
    expect(evaluateLens(project.story, "calm", ref)?.match).toBe(false);
  });

  it("preserves a native local trait and reports its real source", () => {
    const project = fixture();
    project.places[0].properties = { season: "spring" };
    project.story.zones = [{ id: "winter", name: "Winter", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { properties: { season: "winter", bright: true } } }];
    const before = structuredClone(project);
    const result = effectiveProjectStoryObject(project, ref)!;
    expect(result.metadata.properties).toMatchObject({ season: "spring", bright: true });
    expect(result.effectiveProperties).toContainEqual(expect.objectContaining({ propertyId: "season", value: "spring", source: "native:place:garden" }));
    expect(result.conflicts).not.toContain("zone:season");
    expect(project).toEqual(before);
  });

  it("matches zones through project geometry and combines distinct properties", () => {
    const project = fixture();
    project.story.zones = [
      { id: "north", name: "North", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 5 }, members: [], tags: [], metadata: { properties: { climate: "mild", shared: "north" }, tags: ["sunny"] } },
      { id: "garden", name: "Garden zone", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { properties: { soil: "rich", shared: "garden" } } },
    ];
    expect(projectZonesForRef(project, project.story, ref).map(({ id }) => id)).toEqual(["north", "garden"]);
    const result = effectiveProjectStoryObject(project, ref)!;
    expect(result.metadata.properties).toMatchObject({ local: "kept", climate: "mild", soil: "rich", shared: "local" });
    expect(result.metadata.tags).toContain("sunny");
    expect(result.conflicts).not.toContain("zone:shared");
  });

  it("does not choose one of two conflicting zone values without local resolution", () => {
    const project = fixture();
    project.story.objects[0]!.metadata = { properties: { local: "kept" } };
    project.story.zones = [
      { id: "a", name: "A", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { properties: { season: "summer" } } },
      { id: "b", name: "B", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { properties: { season: "winter" } } },
    ];
    const result = effectiveProjectStoryObject(project, ref)!;
    expect(result.metadata.properties).not.toHaveProperty("season");
    expect(result.conflicts).toContain("zone:season");
  });

  it("lets scenario and step values override a zone without leaking its conflict", () => {
    const project = fixture();
    project.story.zones = [{ id: "mood-zone", name: "Mood", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { properties: { mood: "sunny" } } }];
    project.story.objects[0]!.metadata = { properties: { local: "kept" } };
    project.story.scenarios = [{ id: "scene", name: "Scene", patches: [{ id: "scenario-mood", target: ref, properties: { mood: "storm" } }], steps: [{ id: "step", name: "Step", patches: [{ id: "step-mood", target: ref, properties: { mood: "night" } }] }] }];
    const result = effectiveProjectStoryObject(project, ref, { scenarioId: "scene", stepId: "step" })!;
    expect(result.metadata.properties).toMatchObject({ mood: "night" });
    expect(result.effectiveProperties).toContainEqual(expect.objectContaining({ propertyId: "mood", value: "night", source: "step", conflict: false }));
    expect(result.conflicts).not.toContain("zone:mood");
  });

  it("keeps local ownership precedence while exposing inherited zone owners", () => {
    const project = fixture();
    project.story.zones = [{ id: "owned", name: "Owned zone", members: [{ ref, relation: "inside", partial: false }], tags: [], metadata: { owners: ["alice"] } }];
    const inherited = resolveStoryOwnership(project, project.story, ref);
    expect(inherited).toMatchObject({ mode: "inherited", effectiveOwners: ["alice"], inheritedOwners: ["alice"], source: { kind: "zone", zoneId: "owned" } });
    project.story.objects[0]!.metadata = { owners: ["bob"] };
    const local = resolveStoryOwnership(project, project.story, ref);
    expect(local).toMatchObject({ mode: "custom", effectiveOwners: ["bob"], inheritedOwners: ["alice"] });
    const reset = resetStoryOwnership(project, { ref });
    expect(reset.story.objects[0]?.metadata).not.toHaveProperty("owners");
    expect(resolveStoryOwnership(reset, reset.story, ref).effectiveOwners).toEqual(["alice"]);
  });
});
