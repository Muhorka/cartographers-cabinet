import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { emptyStoryData, type StoryObjectRef } from "./types";
import { formatStoryFieldValue, storyFieldLabel, storyFieldObjectName } from "./field-format";
import { formatScenarioEffect } from "./components/story-scenario-effect-format";
import { scenarioCopy } from "./i18n/scenario-copy";

const target: StoryObjectRef = { kind: "place", id: "hall" };

function fixture() {
  const project = emptyProject("project", "Test project");
  project.places = [{ id: "hall", name: "Hall", kind: "location", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }];
  project.story = {
    ...emptyStoryData(),
    world: [{ id: "anna", kind: "character", name: "Anna", tags: [], properties: {} }],
    objects: [{ ref: target, metadata: {} }],
    scenarios: [{ id: "night", name: "Night", patches: [{ id: "rename", target, title: "Night hall" }], steps: [] }],
  };
  return project;
}

describe("story field formatting", () => {
  it("resolves each project snapshot independently", () => {
    const before = fixture();
    const after = structuredClone(before);
    after.story.world[0]!.name = "Borys";

    expect(formatStoryFieldValue(before, ["anna"], "owners", "pl")).toBe("Anna");
    expect(formatStoryFieldValue(after, ["anna"], "owners", "pl")).toBe("Borys");
    expect(formatStoryFieldValue(before, [{ entityId: "anna" }], "access.allow", "en")).toBe("Anna");
  });

  it("keeps empty, false, zero, lists, and unset values distinct", () => {
    const project = fixture();

    expect(formatStoryFieldValue(project, undefined, "tags", "pl")).toBe("Dziedziczenie / brak wartości");
    expect(formatStoryFieldValue(project, [], "tags", "pl")).toBe("Brak (pusta lista)");
    expect(formatStoryFieldValue(project, "", "tags", "pl")).toBe("Puste");
    expect(formatStoryFieldValue(project, 0, "tags", "pl")).toBe("0");
    expect(formatStoryFieldValue(project, false, "tags", "pl")).toBe("Nie");
    expect(new Set([
      formatStoryFieldValue(project, undefined, "tags", "pl"),
      formatStoryFieldValue(project, [], "tags", "pl"),
      formatStoryFieldValue(project, "", "tags", "pl"),
      formatStoryFieldValue(project, 0, "tags", "pl"),
      formatStoryFieldValue(project, false, "tags", "pl"),
    ])).toHaveLength(5);
  });

  it("uses localized labels and a supplied scenario context for object names", () => {
    const project = fixture();

    expect(storyFieldLabel(project, "owners", "pl")).toBe("Właściciele");
    expect(storyFieldLabel(project, "access.permission", "en")).toBe("Permission");
    expect(storyFieldObjectName(project, target, {}, "pl")).toBe("Hall");
    expect(storyFieldObjectName(project, target, { scenarioId: "night" }, "pl")).toBe("Night hall");
    expect(project.story.scenarios[0]!.patches[0]!.title).toBe("Night hall");
  });

  it("keeps the scenario formatter output shape and unchanged fields", () => {
    const project = fixture();
    const result = formatScenarioEffect(project, {
      patchId: "patch",
      target,
      objectName: "raw",
      missing: false,
      locked: false,
      fields: [
        { key: "owners", before: ["anna"], after: ["anna"], authored: ["anna"], changed: false },
        { key: "access.permission", before: "open", after: "open", authored: "open", changed: false },
      ],
    }, scenarioCopy.pl, "pl");

    expect(result.objectName).toBe("Hall");
    expect(result.fields).toEqual([
      { label: "Właściciele", before: "Anna", after: "Anna", authored: "Anna", changed: false },
      { label: "Prawo wstępu", before: "Każdy", after: "Każdy", authored: "Każdy", changed: false },
    ]);
  });
});
