import { describe, expect, it } from "vitest";
import { createBuildingWithDefaultLevel, createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { movePlaceBoundaryVertex, resizePlaceBoundary } from "./place-boundary-operations";

describe("place outline editing", () => {
  const identity = () => { let index = 0; return { createId: () => `id-${++index}` }; };
  it("resizes the opened map outline when outline editing is explicit", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
    const result = resizePlaceBoundary(project, "map", "south-east", { x: 120, y: 90 });
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.places[0].boundary).toEqual({ kind: "rectangle", x: 0, y: 0, width: 120, height: 90 });
  });

  it("does not shrink a containing map across one of its places", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
    project = createPlace(project, { id: "house", parentId: "map", name: "House", kind: "object", boundary: { kind: "rectangle", x: 0, y: 0, width: 12, height: 10 }, transform: { x: 70, y: 50, rotation: 0 } });
    expect(resizePlaceBoundary(project, "map", "south-east", { x: 50, y: 40 })).toMatchObject({ state: "blocked", reason: "collision" });
  });

  it("allows named place boundaries to cross one another while structural objects remain constrained", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
    project = createPlace(project, { id: "caves", parentId: "world", name: "Caves", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 70, height: 40 }, transform: { x: 50, y: 20, rotation: 0 } });
    expect(resizePlaceBoundary(project, "world", "south-east", { x: 60, y: 50 }).state).toBe("applied");
    expect(resizePlaceBoundary(project, "caves", "south-east", { x: 90, y: 50 }).state).toBe("applied");
  });

  it("moves one vertex of an existing polygon outline", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }] } });
    const result = movePlaceBoundaryVertex(project, "map", 0, 1, { x: 90, y: 10 });
    expect(result.state).toBe("applied");
    if (result.state !== "applied") return;
    expect(result.project.places[0].boundary).toMatchObject({ kind: "polygon", points: [{ x: 0, y: 0 }, { x: 90, y: 10 }, { x: 100, y: 80 }, { x: 0, y: 80 }] });
  });

  it("rebuilds a level enclosure and derived rooms when its outline is edited", () => {
    const project = createBuildingWithDefaultLevel(emptyProject("p", "P"), {
      id: "house", levelId: "floor", constructionId: "plan", name: "House", levelName: "Floor",
      boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 14 },
    }, identity());
    const result = resizePlaceBoundary(project, "floor", "south-east", { x: 15, y: 10 });
    expect(result.state).toBe("applied");
    if (result.state !== "applied") return;
    expect(result.project.constructions[0].enclosure).toEqual({ kind: "rectangle", x: 0, y: 0, width: 15, height: 10 });
    expect(result.project.constructions[0].walls).toHaveLength(4);
    expect(result.project.places.filter(({ parentId, kind }) => parentId === "floor" && kind === "room")).toHaveLength(1);
  });

  it("keeps real equipment constraints while ignoring derived rooms", () => {
    let project = createBuildingWithDefaultLevel(emptyProject("p", "P"), {
      id: "house", levelId: "floor", constructionId: "plan", name: "House", levelName: "Floor",
      boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 14 },
    }, identity());
    project = { ...project, elements: [{ id: "table", belongsToId: "floor", name: "Table", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "point", at: { x: 19, y: 13 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    expect(resizePlaceBoundary(project, "floor", "south-east", { x: 15, y: 10 })).toMatchObject({ state: "blocked", reason: "collision" });
  });

  it("does not treat an independently shaped level as a building collision", () => {
    let project = createBuildingWithDefaultLevel(emptyProject("p", "P"), {
      id: "house", levelId: "floor", constructionId: "plan", name: "House", levelName: "Floor",
      boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 14 },
    }, identity());
    project = { ...project, places: project.places.map((place) => place.id === "floor" ? { ...place, boundary: { kind: "rectangle", x: 0, y: 0, width: 30, height: 20 } } : place) };
    expect(resizePlaceBoundary(project, "house", "south-east", { x: 15, y: 10 }).state).toBe("applied");
  });
});
