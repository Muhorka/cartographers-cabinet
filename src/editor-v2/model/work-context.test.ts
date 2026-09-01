import { describe, expect, it } from "vitest";
import { createBuildingWithDefaultLevel, createPlace } from "./hierarchy-operations";
import { emptyProject } from "./project-model";
import { availableWorkSubjects, workLayerAvailability } from "./work-context";
import { createStarterProject } from "./starter-project";

const identity = { createId: (() => { let id = 0; return () => `id-${++id}`; })() };

describe("work layer context", () => {
  it("offers the same complete object catalogue on broad maps and floor plans", () => {
    const project = createStarterProject("starter", "Project", "pl");
    const outdoor = availableWorkSubjects(project, "starter:world", "equipment").map(({ id }) => id);
    const indoor = availableWorkSubjects(project, "starter:level", "equipment").map(({ id }) => id);
    expect(outdoor).toEqual(indoor);
    expect(outdoor).toEqual(expect.arrayContaining(["equipment.furniture", "equipment.object", "equipment.vegetation", "equipment.monument", "equipment.small-architecture", "equipment.bridge", "equipment.marker", "equipment.custom"]));
  });

  it("routes construction and openings from a one-level building to its actual level plan", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world" });
    project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "floor", constructionId: "plan", parentId: "world", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identity);
    expect(workLayerAvailability(project, "house", "construction")).toEqual({ available: true, targetPlaceId: "floor", constructionId: "plan" });
    expect(workLayerAvailability(project, "house", "openings")).toEqual({ available: true, targetPlaceId: "floor", constructionId: "plan" });
  });

  it("does not let a building be placed in another building plan", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "house", name: "House", kind: "building", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } });
    expect(workLayerAvailability(project, "house", "buildings")).toEqual({ available: false, reason: "requires-broader-map" });
  });

  it("allows a level plan to carry contextual water or greenery such as a fountain or courtyard garden", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world" });
    project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "floor", constructionId: "plan", parentId: "world", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identity);
    expect(workLayerAvailability(project, "floor", "terrain")).toEqual({ available: true, targetPlaceId: "floor" });
  });

  it("keeps a loose room focused on furnishing and sketching", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "root", name: "Loose room plan", kind: "standalone-room" });
    expect(workLayerAvailability(project, "root", "sketch").available).toBe(true);
    expect(workLayerAvailability(project, "root", "equipment").available).toBe(true);
    expect(workLayerAvailability(project, "root", "terrain")).toEqual({ available: false, reason: "requires-broader-map" });
  });

  it("lets a room edit only its part of the shared level construction", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world" });
    project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "floor", constructionId: "plan", parentId: "world", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identity);
    const room = project.places.find(({ parentId, kind }) => parentId === "floor" && kind === "room");
    expect(room).toBeDefined();
    expect(workLayerAvailability(project, room!.id, "openings")).toEqual({ available: true, targetPlaceId: room!.id, constructionId: "plan" });
    expect(workLayerAvailability(project, room!.id, "construction")).toEqual({ available: true, targetPlaceId: room!.id, constructionId: "plan" });
    expect(workLayerAvailability(project, room!.id, "terrain")).toEqual({ available: false, reason: "requires-broader-map" });
  });
});
