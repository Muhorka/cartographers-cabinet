import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { migrateStoryData } from "../story/migration";
import { projectRevision } from "./project-revision";

describe("project revisions across zone normalization", () => {
  it("treats only the format conversion as unchanged and retains real edits", () => {
    const old = emptyProject("revision-zone", "Synthetic revision");
    old.story.groups = [{ id: "apartment", name: "Apartment", memberRefs: [], entryIds: [], metadata: { properties: { sunny: true } } }];
    const before = structuredClone(old);
    const normalized = { ...old, story: migrateStoryData(old.story) };
    expect(projectRevision(normalized)).toBe(projectRevision(old));
    expect(projectRevision({ ...normalized, updatedAt: "2030-01-01T00:00:00Z" })).toBe(projectRevision(old));
    normalized.story.zones[0].metadata!.properties!.sunny = false;
    expect(projectRevision(normalized)).not.toBe(projectRevision(old));
    expect(old).toEqual(before);
  });

  it("can fingerprint malformed historical scenarios so review can report them", () => {
    const project = emptyProject("invalid-review", "Synthetic history");
    project.story.groups = [{ id: "old", name: "Old", memberRefs: [], entryIds: [], metadata: {} }];
    project.story.scenarios = [{ id: "duplicate", name: "One", patches: [], steps: [] }, { id: "duplicate", name: "Two", patches: [], steps: [] }];
    expect(() => projectRevision(project)).not.toThrow();
    expect(projectRevision(project)).not.toBe(projectRevision({ ...project, story: { ...project.story, scenarios: [] } }));
  });
});
