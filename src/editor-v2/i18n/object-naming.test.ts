import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { nextSubjectName } from "./object-naming";

describe("canonical object naming", () => {
  it("uses the same localized subject name for every caller", () => {
    expect(nextSubjectName(emptyProject("p", "Test"), "platform.balcony", "pl")).toBe("Balkon 1");
  });

  it("finds successive free names without relying on array counts", () => {
    const project = emptyProject("p", "Test");
    project.elements.push({ id: "one", name: "Balkon 1", layerId: "equipment", subjectId: "equipment.object", belongsToId: "map", geometry: { kind: "point", at: { x: 0, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    expect(nextSubjectName(project, "platform.balcony", "pl", 1)).toBe("Balkon 2");
    expect(nextSubjectName(project, "platform.balcony", "pl", 2)).toBe("Balkon 3");
  });
});
