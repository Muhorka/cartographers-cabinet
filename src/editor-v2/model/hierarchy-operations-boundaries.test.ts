import { describe, expect, it } from "vitest";
import { shapePoints } from "../geometry/region-constraints";
import { createBuildingWithDefaultLevel, createLevelForBuilding, createPlace, deletePlaceSubtree, reparentPlace } from "./hierarchy-operations";
import { emptyProject } from "./project-model";

describe("hierarchy boundary references", () => {
  it("rebuilds building footprints after a level is moved or deleted", () => {
    const identity = { createId: (() => { let index = 0; return () => `id-${++index}`; })() };
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
    project = createBuildingWithDefaultLevel(project, { id: "first", levelId: "ground", constructionId: "ground-plan", parentId: "map", name: "First", levelName: "Ground", boundary: { kind: "rectangle", x: -5, y: -5, width: 10, height: 10 }, transform: { x: 30, y: 30, rotation: 0 } }, identity);
    project = createBuildingWithDefaultLevel(project, { id: "second", levelId: "other-ground", constructionId: "other-plan", parentId: "map", name: "Second", levelName: "Ground", boundary: { kind: "rectangle", x: -5, y: -5, width: 10, height: 10 }, transform: { x: 40, y: 30, rotation: 0 } }, identity);
    project = createLevelForBuilding(project, { id: "upper", constructionId: "upper-plan", buildingId: "first", name: "Upper" }, identity);
    project = { ...project, places: project.places.map((place) => place.id === "upper" ? { ...place, transform: { x: 10, y: 0, rotation: 0 } } : place) };
    const moved = reparentPlace(project, "upper", "second");
    expect(shapePoints(moved.places.find(({ id }) => id === "first")!.boundary!).every(({ x }) => x >= -5 && x <= 5)).toBe(true);
    const deleted = deletePlaceSubtree(moved, "upper");
    expect(shapePoints(deleted.places.find(({ id }) => id === "second")!.boundary!).every(({ x }) => x >= -5 && x <= 5)).toBe(true);
  });
});
