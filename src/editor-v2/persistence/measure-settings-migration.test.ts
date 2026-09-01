import { describe, expect, it } from "vitest";
import { createProjectAtScale } from "../model/starter-project";
import { defaultMeasureSettings } from "../model/project-model";
import { parseProjectFile, PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from "./project-file";

describe("measure settings migration", () => {
  it("adds safe defaults when loading a schema 7 project", () => {
    const source = createProjectAtScale("legacy", "Legacy map", "en", "world");
    const legacy = structuredClone(source) as Record<string, unknown>;
    legacy.schemaVersion = 7;
    delete legacy.surfaces;
    delete legacy.measureSettings;
    const envelope = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: source.updatedAt, project: legacy });
    expect(envelope.project.schemaVersion).toBe(9);
    expect(envelope.project.story.world).toEqual([]);
    expect(envelope.project.surfaces).toEqual([]);
    expect(envelope.project.measureSettings).toEqual(defaultMeasureSettings());
  });

  it("preserves explicit measurement preferences during normalization", () => {
    const source = createProjectAtScale("modern", "Modern map", "en", "world");
    const project = { ...source, measureSettings: { ...defaultMeasureSettings(), units: "imperial" as const, gridVisible: true, gridOpacity: .42, pencilSmoothing: .8 } };
    const envelope = parseProjectFile({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt: source.updatedAt, project });
    expect(envelope.project.measureSettings).toMatchObject({ units: "imperial", gridVisible: true, gridOpacity: .42, pencilSmoothing: .8 });
  });
});
