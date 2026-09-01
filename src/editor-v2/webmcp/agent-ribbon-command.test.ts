import { describe, expect, it } from "vitest";
import { buildRibbonEdit, ribbonEditingHandles } from "./agent-ribbon-command";
import { emptyProject, type DrawingElement } from "../model/project-model";

function riverProject(): ReturnType<typeof emptyProject> {
  const project = emptyProject("water-agent", "Water agent"); project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -100, y: -100, width: 300, height: 300 }, tags: [], access: [], properties: {} }];
  const river: DrawingElement = { id: "river", belongsToId: "world", name: "River", layerId: "terrain", subjectId: "terrain.river", geometry: { kind: "bezier", nodes: [{ anchor: { x: 0, y: 0 }, outHandle: { x: 4, y: 0 } }, { anchor: { x: 10, y: 2 }, inHandle: { x: 6, y: 2 } }], closed: false }, widthMeters: 4, widthProfile: [{ t: 0, left: 2, right: 2 }, { t: 1, left: 3, right: 3 }], visible: true, locked: false, tags: [], access: [], properties: {} }; project.elements = [river]; return project;
}

describe("WebMCP flowing-water editing", () => {
  it("uses owner-local centerline and bank handles and changes only a prepared copy", () => {
    const project = riverProject(); const before = structuredClone(project); const handles = ribbonEditingHandles(project, "river"); expect(handles.layerId).toBe("terrain"); expect(handles.anchors).toHaveLength(2); expect(handles.edges.length).toBeGreaterThan(0);
    const result = buildRibbonEdit(project, { id: "river", channel: 0, index: 1, point: { x: 12, y: 3 } }); expect(project).toEqual(before); expect(result.project.elements[0]?.geometry).toMatchObject({ kind: "bezier", nodes: [{ anchor: { x: 0, y: 0 } }, { anchor: { x: 12, y: 3 } }] });
  });

  it("rejects locked watercourse edits without changing the source", () => {
    const project = riverProject(); project.elements[0] = { ...project.elements[0]!, locked: true }; expect(() => buildRibbonEdit(project, { id: "river", widthMeters: 8 })).toThrow("ribbon-not-editable");
  });
});
