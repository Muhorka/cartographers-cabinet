import { describe, expect, it } from "vitest";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { duplicateSelectedElements, mergeSelectedElementRegions, transformSelectedElements } from "./element-transformations";

const region = (id: string, x: number): DrawingElement => ({ id, belongsToId: "map", name: id, layerId: "terrain", subjectId: "terrain.meadow", geometry: { kind: "region", shape: { kind: "rectangle", x, y: 0, width: 4, height: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} });

describe("element selection transformations", () => {
  it("rotates a selected group around its shared centre", () => {
    const project = { ...emptyProject("p", "P"), elements: [region("a", 0), region("b", 6)] };
    const result = transformSelectedElements(project, ["a", "b"], { kind: "rotate", degrees: 90 });
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const points = result.project.elements.flatMap((element) => element.geometry.kind === "region" && element.geometry.shape.kind === "polygon" ? element.geometry.shape.points : []);
    expect(Math.min(...points.map(({ y }) => y))).toBeCloseTo(-4);
    expect(Math.max(...points.map(({ y }) => y))).toBeCloseTo(6);
  });

  it("duplicates selected objects and returns the new selection", () => {
    let id = 0; const project = { ...emptyProject("p", "P"), elements: [region("a", 0)] };
    const result = duplicateSelectedElements(project, ["a"], () => `copy-${++id}`, (name) => `${name} copy`);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements).toHaveLength(2); expect(result.selectedIds).toEqual(["copy-1"]);
  });

  it("merges touching areas into one real outline", () => {
    const project = { ...emptyProject("p", "P"), elements: [region("a", 0), region("b", 4)] };
    const result = mergeSelectedElementRegions(project, ["a", "b"]);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements).toHaveLength(1); expect(result.project.elements[0].geometry).toMatchObject({ kind: "region" });
  });

  it("keeps two separated equipment outlines as two parts of one composite", () => {
    const first = { ...region("a", 0), layerId: "equipment" as const, subjectId: "equipment.furniture" };
    const second = { ...region("b", 8), layerId: "equipment" as const, subjectId: "equipment.furniture" };
    const result = mergeSelectedElementRegions({ ...emptyProject("p", "P"), elements: [first, second] }, ["a", "b"]);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements[0].geometry).toMatchObject({ kind: "region", shape: { kind: "compound", polygons: [{}, {}] } });
  });

  it("uses the same union for separated terrain regions", () => {
    const first = region("a", 0);
    const second = region("b", 8);
    const result = mergeSelectedElementRegions({ ...emptyProject("p", "P"), elements: [first, second] }, ["a", "b"]);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements[0].geometry).toMatchObject({ kind: "region", shape: { kind: "compound", polygons: [{}, {}] } });
  });

  it("does not silently swallow an equipment outline contained by another", () => {
    const outer = { ...region("outer", 0), layerId: "equipment" as const, subjectId: "equipment.furniture" };
    const inner = { ...region("inner", 1), layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: 1, y: .5, width: 1, height: 1 } } };
    expect(mergeSelectedElementRegions({ ...emptyProject("p", "P"), elements: [outer, inner] }, ["outer", "inner"])).toMatchObject({ state: "blocked", reason: "unsupported" });
  });

  it("keeps transformed equipment inside its containing room", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Room", kind: "standalone-room", boundary: { kind: "rectangle", x: 0, y: 0, width: 5, height: 5 } });
    project = { ...project, elements: [{ ...region("table", 3), belongsToId: "map", layerId: "equipment", subjectId: "equipment.furniture" }] };
    expect(transformSelectedElements(project, ["table"], { kind: "rotate", degrees: 90 }).state).toBe("blocked");
  });
});
