import { describe, expect, it } from "vitest";
import { addElement, changeElementOwnership, createBuildingWithDefaultLevel, createLevelForBuilding, createPlace, deletePlaceSubtree, movePlace, reparentPlace, roots, syncConstructionRooms, updatePlaceDetails, validContainingPlaces, worldPosition, wrapPlaceInBroaderMap, wrapStandaloneRoomInBuilding } from "./hierarchy-operations";
import { reorderLevel } from "./level-operations";
import { emptyProject } from "./project-model";
import { shapePoints } from "../geometry/region-constraints";
import { previewWallAddition } from "../construction/construction-document";

const identities = () => { let value = 0; return { createId: () => `id-${++value}` }; };

describe("editor v2 hierarchy", () => {
  it("allows independent roots without requiring a world", () => {
    let project = emptyProject("project", "Story places");
    project = createPlace(project, { id: "room", name: "Scene room", kind: "standalone-room", boundary: { kind: "rectangle", x: 0, y: 0, width: 8, height: 6 } });
    project = createPlace(project, { id: "village", name: "Village", kind: "location" });
    expect(roots(project).map(({ id }) => id)).toEqual(["room", "village"]);
  });

  it("creates one usable level and construction plan with every building", () => {
    const project = createBuildingWithDefaultLevel(emptyProject("project", "Project"), { id: "house", levelId: "ground", constructionId: "ground-plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identities());
    expect(project.places.find(({ id }) => id === "ground")?.parentId).toBe("house");
    expect(project.constructions).toHaveLength(1);
    expect(project.constructions[0].rooms).toHaveLength(1);
  });

  it("creates a hierarchy room for every enclosed face after a partition split", () => {
    const identity = identities();
    let project = createBuildingWithDefaultLevel(emptyProject("project", "Project"), { id: "house", levelId: "ground", constructionId: "ground-plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identity);
    const construction = project.constructions[0];
    const partition = { id: "partition", start: { x: 5, y: 0 }, end: { x: 5, y: 8 }, thickness: .3, role: "partition" as const };
    const withSplit = previewWallAddition(construction, [partition], { createId: identity.createId, createName: (index) => `Room ${index}` }).after;
    project = syncConstructionRooms({ ...project, constructions: [withSplit] }, withSplit);
    expect(project.constructions[0].rooms).toHaveLength(2);
    expect(project.places.filter(({ parentId, kind }) => parentId === "ground" && kind === "room")).toHaveLength(2);
  });

  it("does not turn a closed face outside the level enclosure into a room", () => {
    const identity = identities();
    let project = createBuildingWithDefaultLevel(emptyProject("project", "Project"), { id: "house", levelId: "ground", constructionId: "ground-plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identity);
    const construction = project.constructions[0];
    const outside = [
      { id: "outside-a", start: { x: 20, y: 20 }, end: { x: 22, y: 20 }, thickness: .3, role: "partition" as const },
      { id: "outside-b", start: { x: 22, y: 20 }, end: { x: 22, y: 22 }, thickness: .3, role: "partition" as const },
      { id: "outside-c", start: { x: 22, y: 22 }, end: { x: 20, y: 22 }, thickness: .3, role: "partition" as const },
      { id: "outside-d", start: { x: 20, y: 22 }, end: { x: 20, y: 20 }, thickness: .3, role: "partition" as const },
    ];
    const withOutside = { ...construction, walls: [...construction.walls, ...outside] };
    project = syncConstructionRooms({ ...project, constructions: [withOutside] }, withOutside);
    expect(project.constructions[0].rooms).toHaveLength(1);
    expect(project.places.filter(({ parentId, kind }) => parentId === "ground" && kind === "room")).toHaveLength(1);
  });

  it("stores an explicit floor order that can be changed independently of creation order", () => {
    const identity = identities();
    let project = createBuildingWithDefaultLevel(emptyProject("project", "Project"), { id: "house", levelId: "ground", constructionId: "ground-plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identity);
    project = createLevelForBuilding(project, { id: "third", constructionId: "third-plan", buildingId: "house", name: "Third floor" }, identity);
    project = createLevelForBuilding(project, { id: "basement", constructionId: "basement-plan", buildingId: "house", name: "Basement" }, identity);
    project = reorderLevel(project, "basement", "ground");
    const ordered = project.places.filter(({ parentId, kind }) => parentId === "house" && kind === "level").sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    expect(ordered.map(({ id }) => id)).toEqual(["basement", "ground", "third"]);
  });

  it("can add storeys above the roof line and below the ground floor", () => {
    const identity = identities();
    let project = createBuildingWithDefaultLevel(emptyProject("project", "Project"), { id: "house", levelId: "ground", constructionId: "ground-plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, identity);
    project = createLevelForBuilding(project, { id: "upper", constructionId: "upper-plan", buildingId: "house", name: "First floor", position: "above" }, identity);
    project = createLevelForBuilding(project, { id: "basement", constructionId: "basement-plan", buildingId: "house", name: "Basement", position: "below" }, identity);
    const ordered = project.places.filter(({ parentId, kind }) => parentId === "house" && kind === "level").sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    expect(ordered.map(({ id }) => id)).toEqual(["basement", "ground", "upper"]);
    expect(ordered.map(({ order }) => order)).toEqual([-1, 0, 1]);
  });

  it("moves a place with its hierarchy while world-owned terrain stays behind", () => {
    let project = emptyProject("project", "World");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    project = createPlace(project, { id: "town", parentId: "world", name: "Town", kind: "location", transform: { x: 10, y: 10, rotation: 0 } });
    project = createPlace(project, { id: "house", parentId: "town", name: "House", kind: "building", transform: { x: 2, y: 3, rotation: 0 } });
    project = addElement(project, { id: "river", name: "River", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }, "world");
    project = movePlace(project, "town", { x: 5, y: -2 });
    expect(worldPosition(project, "house")).toEqual({ x: 17, y: 11 });
    expect(project.elements.find(({ id }) => id === "river")?.belongsToId).toBe("world");
  });

  it("can deliberately move ownership without guessing from geometry", () => {
    let project = emptyProject("project", "World");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    project = createPlace(project, { id: "estate", parentId: "world", name: "Estate", kind: "location" });
    project = addElement(project, { id: "pond", name: "Pond", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "region", shape: { kind: "circle", cx: 4, cy: 4, radius: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "world");
    project = changeElementOwnership(project, "pond", "estate");
    expect(project.elements[0].belongsToId).toBe("estate");
  });

  it("preserves an element's world position when its ownership changes", () => {
    let project = emptyProject("project", "World");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    project = createPlace(project, { id: "west", parentId: "world", name: "West", kind: "location", transform: { x: 20, y: 10, rotation: 30 } });
    project = createPlace(project, { id: "east", parentId: "world", name: "East", kind: "location", transform: { x: 80, y: 40, rotation: -20 } });
    project = addElement(project, { id: "well", name: "Well", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "point", at: { x: 6, y: 4 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "west");
    const oldOwner = project.places.find(({ id }) => id === "west")!; const oldAt = project.elements[0].geometry.kind === "point" ? project.elements[0].geometry.at : { x: 0, y: 0 };
    const radians = oldOwner.transform.rotation * Math.PI / 180; const before = { x: oldOwner.transform.x + oldAt.x * Math.cos(radians) - oldAt.y * Math.sin(radians), y: oldOwner.transform.y + oldAt.x * Math.sin(radians) + oldAt.y * Math.cos(radians) };
    project = changeElementOwnership(project, "well", "east");
    const newOwner = project.places.find(({ id }) => id === "east")!; const newAt = project.elements[0].geometry.kind === "point" ? project.elements[0].geometry.at : { x: 0, y: 0 }; const nextRadians = newOwner.transform.rotation * Math.PI / 180;
    const after = { x: newOwner.transform.x + newAt.x * Math.cos(nextRadians) - newAt.y * Math.sin(nextRadians), y: newOwner.transform.y + newAt.x * Math.sin(nextRadians) + newAt.y * Math.cos(nextRadians) };
    expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
  });

  it("moves complete subtrees but rejects hierarchy cycles", () => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "a", name: "A", kind: "world" });
    project = createPlace(project, { id: "b", parentId: "a", name: "B", kind: "location" });
    project = createPlace(project, { id: "c", parentId: "b", name: "C", kind: "building" });
    expect(() => reparentPlace(project, "a", "c")).toThrow(/cannot be moved/i);
    expect(reparentPlace(project, "c").places.find(({ id }) => id === "c")?.parentId).toBeUndefined();
  });

  it("changes ownership without teleporting a rotated place", () => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    project = createPlace(project, { id: "west", parentId: "world", name: "West", kind: "location", transform: { x: 20, y: 10, rotation: 30 } });
    project = createPlace(project, { id: "east", parentId: "world", name: "East", kind: "location", transform: { x: 70, y: 40, rotation: -15 } });
    project = createPlace(project, { id: "house", parentId: "west", name: "House", kind: "building", transform: { x: 8, y: 5, rotation: 12 } });
    const before = worldPosition(project, "house"); project = reparentPlace(project, "house", "east");
    expect(worldPosition(project, "house").x).toBeCloseTo(before.x); expect(worldPosition(project, "house").y).toBeCloseTo(before.y);
    expect(project.places.find(({ id }) => id === "house")?.parentId).toBe("east");
  });

  it("offers only structurally sensible containing places", () => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    project = createPlace(project, { id: "town", parentId: "world", name: "Town", kind: "location" });
    project = createPlace(project, { id: "house", parentId: "town", name: "House", kind: "building" });
    project = createPlace(project, { id: "floor", parentId: "house", name: "Floor", kind: "level" });
    expect(validContainingPlaces(project, "house").map(({ id }) => id)).toEqual(["world", "town"]);
    expect(validContainingPlaces(project, "floor").map(({ id }) => id)).toEqual(["house"]);
  });

  it("does not offer a container where a moved building would collide with another building", () => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "world", name: "World", kind: "world", boundary: { kind: "rectangle", x: 0, y: 0, width: 200, height: 100 } });
    project = createPlace(project, { id: "west", parentId: "world", name: "West", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 80, height: 80 } });
    project = createPlace(project, { id: "east", parentId: "world", name: "East", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 80, height: 80 }, transform: { x: 100, y: 0, rotation: 0 } });
    project = createPlace(project, { id: "moving", parentId: "west", name: "Moving house", kind: "building", boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, transform: { x: 110, y: 10, rotation: 0 } });
    project = createPlace(project, { id: "occupied", parentId: "east", name: "Occupied", kind: "building", boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, transform: { x: 10, y: 10, rotation: 0 } });
    expect(validContainingPlaces(project, "moving").map(({ id }) => id)).not.toContain("east");
  });

  it("adds a broader map scale without moving the existing place in world coordinates", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "room", name: "Loose room", kind: "standalone-room", transform: { x: 12, y: 7, rotation: 3 } });
    project = wrapPlaceInBroaderMap(project, "room", { id: "building", name: "New building", kind: "building" });
    expect(project.places.find(({ id }) => id === "building")?.transform).toEqual({ x: 12, y: 7, rotation: 3 });
    expect(project.places.find(({ id }) => id === "room")).toMatchObject({ parentId: "building", transform: { x: 0, y: 0, rotation: 0 } });
    expect(worldPosition(project, "room")).toEqual({ x: 12, y: 7 });
  });

  it("wraps a standalone room in a real one-level building without replacing the room", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "room", name: "Scene room", description: "Keep me", kind: "standalone-room", boundary: { kind: "rectangle", x: -4, y: -3, width: 8, height: 6 }, transform: { x: 12, y: 7, rotation: 3 } });
    project = addElement(project, { id: "table", name: "Table", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "point", at: { x: 0, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "room");
    project = wrapStandaloneRoomInBuilding(project, "room", { buildingId: "building", levelId: "level", constructionId: "plan", buildingName: "House", levelName: "Ground floor" }, identities());
    expect(project.places.map(({ id, kind, parentId }) => ({ id, kind, parentId }))).toEqual([
      { id: "building", kind: "building", parentId: undefined }, { id: "level", kind: "level", parentId: "building" }, { id: "room", kind: "room", parentId: "level" },
    ]);
    expect(project.places.find(({ id }) => id === "room")).toMatchObject({ name: "Scene room", description: "Keep me" });
    expect(project.elements.find(({ id }) => id === "table")?.belongsToId).toBe("room");
    expect(worldPosition(project, "room")).toEqual({ x: 12, y: 7 });
  });

  it("renames places and deletes a complete contained subtree with its construction", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world" });
    project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "floor", constructionId: "plan", parentId: "world", name: "House", levelName: "Floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 4, height: 3 } }, identities());
    project = updatePlaceDetails(project, "house", { name: "Inn", description: "Old stone inn", tags: ["stone", "ruined"] });
    expect(project.places.find(({ id }) => id === "house")).toMatchObject({ name: "Inn", description: "Old stone inn", tags: ["stone", "ruined"] });
    project = deletePlaceSubtree(project, "house");
    expect(project.places.map(({ id }) => id)).toEqual(["world"]); expect(project.constructions).toEqual([]);
  });

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
