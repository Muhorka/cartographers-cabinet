import { describe, expect, it } from "vitest";
import { emptyProject } from "../../model/project-model";
import { evaluateProjectLens } from "../evaluation";
import { emptyStoryData, storyRefKey } from "../types";
import { storyEntityOptionId, storyEntityOptions, storyEntityValue } from "./story-entity-choices";

const world = [{ id: "anna", name: "Anna" }];
const mapRef = { kind: "room" as const, id: "hall", scopeId: "level" };

describe("story entity property choices", () => {
  it("round-trips canonical world and scoped map values without string storage", () => {
    const options = storyEntityOptions(world, [{ ref: mapRef, name: "Hall" }]);
    expect(storyEntityValue("entryId:anna", options)).toEqual({ entityId: "anna" });
    expect(storyEntityValue(storyRefKey(mapRef), options)).toEqual(mapRef);
    expect(storyEntityOptionId({ entityId: "anna" })).toBe("entryId:anna");
    expect(storyEntityOptionId(mapRef)).toBe(storyRefKey(mapRef));
    expect(typeof storyEntityValue("entryId:anna", options)).toBe("object");
  });

  it("matches lenses against both world and scoped map entity values", () => {
    const project = emptyProject("entity", "Entity");
    const story = { ...emptyStoryData(), objects: [{ ref: mapRef, metadata: { properties: { linked: mapRef } } }], propertyDefinitions: [{ id: "linked", name: "Linked", type: "entity" as const }], lenses: [
      { id: "world", name: "Anna", color: "#111111", expression: { kind: "predicate" as const, predicate: { kind: "property" as const, propertyId: "linked", equals: { entityId: "anna" } } } },
      { id: "map", name: "Hall", color: "#222222", expression: { kind: "predicate" as const, predicate: { kind: "property" as const, propertyId: "linked", equals: mapRef } } },
    ], world: [{ id: "anna", kind: "character" as const, name: "Anna", tags: [], properties: {} }] };
    project.story = { ...story, objects: [{ ref: mapRef, metadata: { properties: { linked: { entityId: "anna" } } } }] };
    expect(evaluateProjectLens(project, project.story, "world", mapRef)?.match).toBe(true);
    project.story = { ...story, objects: [{ ref: mapRef, metadata: { properties: { linked: mapRef } } }] };
    expect(evaluateProjectLens(project, project.story, "map", mapRef)?.match).toBe(true);
  });
});
