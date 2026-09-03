import { describe, expect, it } from "vitest";
import { createPlace } from "./hierarchy-operations";
import { emptyProject } from "./project-model";
import { projectIntegrityIssues } from "./project-integrity";
import { projectConsistencyReport, searchProjectObjects } from "../webmcp/project-read-model";

function fixture() {
  let project = createPlace(emptyProject("project", "Project"), { id: "world", name: "World", kind: "world" });
  project = createPlace(project, { id: "hall", parentId: "world", name: "Hall", kind: "location" });
  return project;
}

describe("project integrity and read-model consistency", () => {
  it("rejects spatial story references that are not backed by the project", () => {
    const project = fixture();
    project.story.objects = [{ ref: { kind: "place", id: "missing" }, metadata: { properties: { related: { kind: "place", id: "also-missing" } } } }];
    project.story.zones = [{ id: "zone", name: "Zone", ownerPlaceId: "missing-owner", members: [{ ref: { kind: "place", id: "missing-member" }, relation: "inside", partial: false }], tags: [] }];
    const issues = projectIntegrityIssues(project, { includeStoryReferences: true });
    expect(issues.map(({ message }) => message)).toEqual(expect.arrayContaining([
      "Story reference does not resolve to a project object: place::missing",
      "Story reference does not resolve to a project object: place::also-missing",
      "Story reference does not resolve to a project object: place::missing-member",
      "Story zone owner does not exist: missing-owner",
    ]));
  });

  it("surfaces integrity issues through the WebMCP consistency report", () => {
    const project = fixture();
    project.story.objects = [{ ref: { kind: "place", id: "missing" }, metadata: {} }];
    const report = projectConsistencyReport(project);
    expect(report.valid).toBe(true);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "story-reference", severity: "warning", message: expect.stringContaining("place::missing") }));
  });

  it("reports broken semantic Story links without blocking a recoverable project", () => {
    const project = fixture();
    project.story.scenarios = [
      { id: "night", name: "Night", patches: [], steps: [{ id: "arrival", name: "Arrival", patches: [] }] },
      { id: "day", name: "Day", patches: [], steps: [{ id: "departure", name: "Departure", patches: [] }] },
    ];
    project.story.relations = [{ id: "relation", from: { entryId: "missing-person" }, to: { kind: "place", id: "hall" }, kind: "visits" }];
    project.story.documents = [{ id: "note", title: "Note", bodyMarkdown: "", references: [{ kind: "scenario", scenarioId: "missing-scenario" }] }];
    project.story.lenses = [{ id: "lens", name: "Lens", color: "#123456", expression: { kind: "predicate", predicate: { kind: "property", propertyId: "missing-property", equals: { entityId: "missing-entry" } } } }];
    project.story.routes = [{
      id: "route", name: "Route", sourceRevision: "old",
      query: { from: { placeId: "hall", point: { x: 0, y: 0 } }, to: { placeId: "hall", point: { x: 1, y: 1 } }, scenarioId: "night", stepId: "departure" },
      result: { status: "ready", revision: 0, sourceRevision: "old", routes: [{
        id: "alternative", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], distance: 1, conditions: [], reasons: [],
        usedOpeningIds: ["missing-opening"], usedTransitionIds: ["missing-transition"],
        segments: [
          { placeId: "hall", kind: "indoor", sourceId: "missing-opening", points: [{ x: 0, y: 0 }] },
          { placeId: "hall", kind: "road", sourceId: "missing-road", points: [{ x: 1, y: 1 }] },
        ],
      }], missingFacts: [], reasons: [] },
    }];

    const report = projectConsistencyReport(project);
    expect(report.valid).toBe(true);
    expect(report.issues.map(({ message }) => message)).toEqual(expect.arrayContaining([
      expect.stringContaining("missing-person"),
      expect.stringContaining("missing-scenario"),
      expect.stringContaining("missing-property"),
      expect.stringContaining("missing-entry"),
      expect.stringContaining("inside scenario night: departure"),
      expect.stringContaining("missing-opening"),
      expect.stringContaining("missing-transition"),
      expect.stringContaining("missing-road"),
    ]));
  });

  it("searches authored narrative labels and descriptions per object", () => {
    const project = fixture();
    project.story.objects = [
      { ref: { kind: "place", id: "hall" }, metadata: { narrativeLabel: "Hidden archive", narrativeDescription: "Behind the blue door" } },
      { ref: { kind: "place", id: "world" }, metadata: { narrativeDescription: "Public grounds" } },
    ];
    expect(searchProjectObjects(project, "hidden archive").map(({ ref }) => ref.id)).toEqual(["hall"]);
    expect(searchProjectObjects(project, "blue door").map(({ ref }) => ref.id)).toEqual(["hall"]);
  });
});
