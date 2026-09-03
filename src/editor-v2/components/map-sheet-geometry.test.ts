import { describe, expect, it } from "vitest";
import { addElement } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { createPlace } from "../model/hierarchy-operations";
import { connectedTransitionsForView, constructionPlaceForView, elementContextDepth, viewportRegion } from "./map-sheet-geometry";

describe("map sheet viewport context", () => {
  it("fits the surrounding level when a room is opened", () => {
    const level = { kind: "rectangle" as const, x: 0, y: 0, width: 20, height: 10 };
    const room = { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 10 };
    let project = createPlace(emptyProject("p", "P"), { id: "level", name: "Level", kind: "level", boundary: level });
    project = createPlace(project, { id: "room", parentId: "level", name: "Room", kind: "room", boundary: room });
    expect(viewportRegion(project, "room")).toEqual(level);
    expect(viewportRegion(project, "level")).toEqual(level);
  });

  it("uses the containing level construction while a room is open", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "level", name: "Level", kind: "level", constructionId: "plan" });
    project = createPlace(project, { id: "room", parentId: "level", name: "Room", kind: "room" });
    expect(constructionPlaceForView(project, "room")?.id).toBe("level");
  });

  it("does not show an arbitrary floor construction for a multi-level building", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "building", name: "Building", kind: "building" });
    project = createPlace(project, { id: "ground", parentId: "building", name: "Ground", kind: "level", constructionId: "ground-plan" });
    project = createPlace(project, { id: "upper", parentId: "building", name: "Upper", kind: "level", constructionId: "upper-plan" });

    expect(constructionPlaceForView(project, "building")).toBeUndefined();
    expect(constructionPlaceForView(project, "ground")?.id).toBe("ground");
  });

  it("shows terrain across nearby hierarchy levels without exposing unrelated branches", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world" });
    project = createPlace(project, { id: "place", parentId: "world", name: "Place", kind: "location" });
    project = createPlace(project, { id: "building", parentId: "place", name: "Building", kind: "building" });
    project = createPlace(project, { id: "elsewhere", parentId: "world", name: "Elsewhere", kind: "location" });
    project = addElement(project, { id: "river", name: "River", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }, "world");
    project = addElement(project, { id: "meadow", name: "Meadow", layerId: "terrain", subjectId: "terrain.meadow", geometry: { kind: "region", shape: { kind: "rectangle", x: 0, y: 0, width: 2, height: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "place");
    project = addElement(project, { id: "foreign", name: "Foreign", layerId: "terrain", subjectId: "terrain.field", geometry: { kind: "region", shape: { kind: "rectangle", x: 0, y: 0, width: 2, height: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "elsewhere");
    expect(elementContextDepth(project, "building", project.elements.find(({ id }) => id === "river")!)).toBe(-2);
    expect(elementContextDepth(project, "world", project.elements.find(({ id }) => id === "meadow")!)).toBe(1);
    expect(elementContextDepth(project, "building", project.elements.find(({ id }) => id === "foreign")!)).toBeUndefined();
  });

  it("projects a connected stair or lift into each linked level without copying its data", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "building", name: "Building", kind: "building", transform: { x: 0, y: 0, rotation: 0 } });
    project = createPlace(project, { id: "lower", parentId: "building", name: "Lower", kind: "level", constructionId: "lower-plan", transform: { x: 2, y: 3, rotation: 0 } });
    project = createPlace(project, { id: "upper", parentId: "building", name: "Upper", kind: "level", constructionId: "upper-plan", transform: { x: 12, y: 3, rotation: 0 } });
    project = { ...project, constructions: [
      { id: "lower-plan", revision: 0, walls: [], rooms: [], openings: [], transitions: [{ id: "lift", kind: "elevator", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, sourceLevelId: "lower", connectedLevelIds: ["lower", "upper"] }] },
      { id: "upper-plan", revision: 0, walls: [], rooms: [], openings: [], transitions: [] },
    ] };
    const context = connectedTransitionsForView(project, "upper", "upper-plan");
    expect(context).toHaveLength(1);
    expect(context[0].transition.id).toBe("lift");
    expect(context[0].scopeId).toBe("lower-plan");
    expect(context[0].transform?.[4]).toBe(-10);
    expect(context[0].transform?.[5]).toBe(0);
  });
});
