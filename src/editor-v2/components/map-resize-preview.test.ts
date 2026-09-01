import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { previewRegionResize, previewRegionVertex } from "./map-resize-preview";

describe("live editing previews", () => {
  it("converts element handles from sheet to owner coordinates without changing the saved project", () => {
    const project = createStarterProject("p", "Map", "en");
    const owner = project.places.find(({ kind }) => kind === "location")!;
    project.elements = [{ id: "note", name: "Note", belongsToId: owner.id, layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, width: 10, height: 5, text: "Text" }, visible: true, locked: false, tags: [], access: [], properties: {} }];
    const before = structuredClone(project);
    const next = previewRegionResize(project, owner.parentId!, { kind: "element", id: "note", corner: "south-east" }, { x: owner.transform.x + 12.5, y: owner.transform.y + 8.25 });
    expect(next.elements[0].geometry).toMatchObject({ width: 12.5, height: 8.25, text: "Text" });
    expect(project).toEqual(before);
  });

  it("shows fractional vertex movement immediately, leaving validation for release", () => {
    const project = createStarterProject("p", "Map", "en");
    const place = project.places.find(({ kind }) => kind === "location")!;
    const before = structuredClone(project);
    const next = previewRegionVertex(project, place.id, { kind: "place", id: place.id, polygonIndex: 0, vertexIndex: 0 }, { x: -48.75, y: -29.125 });
    expect(JSON.stringify(next.places.find(({ id }) => id === place.id)?.boundary)).toContain("-48.75");
    expect(project).toEqual(before);
  });
});
