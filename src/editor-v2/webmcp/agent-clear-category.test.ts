import { describe, expect, it } from "vitest";
import { createProjectAtScale } from "../model/starter-project";
import type { ConstructionSurface } from "../model/project-model";
import { buildClearLayerChange } from "./agent-hierarchy-command";
import { constructionClearCategories } from "./agent-tool-schemas";

describe("agent construction clear categories", () => {
  it("accepts the same explicit category choices as the human editor", () => {
    expect(constructionClearCategories).toEqual(["walls", "vertical-connections", "platforms", "doors", "windows", "gates", "passages", "openings"]);
    const project = createProjectAtScale("agent-clear", "Synthetic atlas", "en", "building");
    const level = project.places.find(({ kind }) => kind === "level")!;
    const platform: ConstructionSurface = { id: "agent-platform", belongsToId: level.id, name: "Platform", kind: "platform", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} };
    const change = buildClearLayerChange({ ...project, surfaces: [platform] }, level.id, "construction", "platforms");
    expect(change.effects).toContain(`cleared:construction:platforms:${level.id}`);
    expect(change.project.surfaces).toEqual([]);
  });
});
