import { describe, expect, it } from "vitest";
import { movePathAnchor } from "../geometry/path-anchor-edit";
import { createStarterProject } from "../model/starter-project";
import type { DrawingElement } from "../model/project-model";
import { moveElementRegionVertex } from "./selection-detail-operations";
import { previewRegionVertex } from "../components/map-resize-preview";

describe("shared path anchor edits", () => {
  it("moves a Bezier anchor with both handles without mutating the source", () => {
    const curve = { kind: "bezier" as const, closed: false, nodes: [{ anchor: { x: 0, y: 0 }, inHandle: { x: -1, y: 2 }, outHandle: { x: 2, y: 3 } }, { anchor: { x: 4, y: 0 } }] };
    expect(movePathAnchor(curve, 0, { x: 1.25, y: 2.5 })).toMatchObject({ nodes: [{ anchor: { x: 1.25, y: 2.5 }, inHandle: { x: .25, y: 4.5 }, outHandle: { x: 3.25, y: 5.5 } }, curve.nodes[1]] });
    expect(curve.nodes[0].anchor).toEqual({ x: 0, y: 0 });
    expect(movePathAnchor(curve, -1, { x: 0, y: 0 })).toBeUndefined();
  });
  it.each(["roads", "sketch", "equipment"] as const)("keeps preview and commit equal for %s, protecting locked objects", (layerId) => {
    const project = createStarterProject("p", "Map", "en"); const owner = project.places.find(({ kind }) => kind === "location")!;
    const item: DrawingElement = { id: "line", name: "Line", belongsToId: owner.id, layerId, subjectId: layerId === "roads" ? "road.paved" : "sketch.line", geometry: { kind: "path", closed: false, points: [{ x: -20, y: -20 }, { x: -10, y: -20 }, { x: -5, y: -20 }] }, visible: true, locked: false, tags: [], access: [], properties: {} };
    project.elements = [item]; project.constructions = []; project.places = project.places.filter(({ kind }) => kind === "world" || kind === "location");
    const point = { x: -11.25, y: -18.75 }; const before = structuredClone(project);
    const preview = previewRegionVertex(project, owner.id, { kind: "element", id: item.id, polygonIndex: 0, vertexIndex: 1 }, point);
    const result = moveElementRegionVertex(project, item.id, 0, 1, point);
    expect(result.state).toBe("applied");
    expect(result.project.elements[0].geometry).toEqual(preview.elements[0].geometry);
    expect(project).toEqual(before);
    expect(moveElementRegionVertex({ ...project, elements: [{ ...item, locked: true }] }, item.id, 0, 1, point)).toMatchObject({ state: "blocked", reason: "locked-outline" });
  });
});
