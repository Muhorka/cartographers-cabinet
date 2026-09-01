import { describe, expect, it } from "vitest";
import { createBuildingWithDefaultLevel, createLevelForBuilding, createPlace } from "../model/hierarchy-operations";
import { shapePoints } from "../geometry/region-constraints";
import { emptyProject } from "../model/project-model";
import { localizeRegion } from "../geometry/region-transform";
import { createConstructionDocument } from "../construction/construction-document";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { deleteSelection, mergeSelectedRooms, moveElementRegionVertex, moveSelection, moveWallEndpoint, resizeElementRegion, updateElementDetails } from "./selection-operations";
import { updateOpeningWidth } from "./selection-detail-operations";
import { deleteSelectionGroup, moveSelectionGroup } from "./group-selection-operations";

function identities() {
  let index = 0;
  return { createId: () => `id-${++index}`, createRoomName: (room: number) => `Room ${room}` };
}

function projectWithHouse() {
  const identity = identities();
  let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
  const house = localizeRegion({ kind: "rectangle", x: 20, y: 20, width: 20, height: 14 });
  project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "floor", constructionId: "plan", parentId: "map", name: "House", levelName: "Floor", boundary: house.boundary, transform: house.transform }, identity);
  return { project, identity };
}

describe("selection operations", () => {
  it("resizes every opening kind when the one-level building itself is active", () => {
    const { project } = projectWithHouse(); const document = project.constructions[0];
    const kinds = ["door", "window", "gate", "passage"] as const;
    const withOpenings = { ...project, constructions: [{ ...document, openings: kinds.map((kind, index) => ({ id: kind, kind, wallId: document.walls[index].id, position: .5, width: 1 })) }] };
    for (const kind of kinds) {
      const result = updateOpeningWidth(withOpenings, "house", kind, 1.5);
      expect(result.state).toBe("applied");
      if (result.state === "applied") expect(result.project.constructions[0].openings.find(({ id }) => id === kind)?.width).toBe(1.5);
    }
  });

  it("moves a place on its containing map without changing its own local outline", () => {
    const { project, identity } = projectWithHouse(); const before = project.places.find(({ id }) => id === "house")!;
    const result = moveSelection(project, { activePlaceId: "map", selection: { kind: "place", id: "house" }, delta: { x: 5, y: 3 }, boundaryEditing: false }, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const after = result.project.places.find(({ id }) => id === "house")!;
    expect(after.boundary).toEqual(before.boundary); expect(after.transform).toEqual({ x: 35, y: 30, rotation: 0 });
  });

  it("rejects moving a building beyond its containing outline", () => {
    const { project, identity } = projectWithHouse();
    const result = moveSelection(project, { activePlaceId: "map", selection: { kind: "place", id: "house" }, delta: { x: 90, y: 0 }, boundaryEditing: false }, identity);
    expect(result).toMatchObject({ state: "blocked", reason: "outside-outline" });
  });

  it("allows a building to overlap another building while it is being arranged", () => {
    const prepared = projectWithHouse();
    const annex = { ...prepared.project.places.find(({ id }) => id === "house")!, id: "annex", name: "Annex", transform: { x: 60, y: 27, rotation: 0 } };
    const project = { ...prepared.project, places: [...prepared.project.places, annex] };
    const result = moveSelection(project, { activePlaceId: "map", selection: { kind: "place", id: "annex" }, delta: { x: -20, y: 0 }, boundaryEditing: false }, prepared.identity);
    expect(result.state).toBe("applied");
  });

  it("allows overlapping place boundaries to cross their containing place", () => {
    const { project, identity } = projectWithHouse();
    const nested = createPlace(project, { id: "caves", parentId: "map", name: "Caves", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 30, height: 30 }, transform: { x: 75, y: 30, rotation: 0 } });
    const result = moveSelection(nested, { activePlaceId: "map", selection: { kind: "place", id: "caves" }, delta: { x: 20, y: 0 }, boundaryEditing: false }, identity);
    expect(result.state).toBe("applied");
  });

  it("keeps point equipment inside its owning place while moving it", () => {
    const { project, identity } = projectWithHouse();
    const marker = { id: "marker", belongsToId: "floor", name: "Marker", layerId: "equipment" as const, subjectId: "equipment.marker", geometry: { kind: "point" as const, at: { x: 0, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const result = moveSelection({ ...project, elements: [marker] }, { activePlaceId: "floor", selection: { kind: "element", id: "marker" }, delta: { x: 50, y: 0 }, boundaryEditing: false }, identity);
    expect(result).toMatchObject({ state: "blocked", reason: "outside-outline" });
  });

  it("never moves the opened outline while outline editing is locked", () => {
    const { project, identity } = projectWithHouse();
    const result = moveSelection(project, { activePlaceId: "floor", selection: { kind: "place", id: "floor" }, delta: { x: 2, y: 0 }, boundaryEditing: false }, identity);
    expect(result).toMatchObject({ state: "blocked", reason: "locked-outline" });
  });

  it("keeps the level and building outlines synchronized after an exterior wall edit", () => {
    const { project, identity } = projectWithHouse(); const wall = project.constructions[0].walls[0];
    const result = moveSelection(project, { activePlaceId: "floor", selection: { kind: "wall", id: wall.id }, delta: { x: 0, y: 2 }, boundaryEditing: true }, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const house = result.project.places.find(({ id }) => id === "house"); const floor = result.project.places.find(({ id }) => id === "floor");
    expect(floor?.boundary).toEqual(house?.boundary); expect(floor?.boundary).not.toEqual(project.places.find(({ id }) => id === "floor")?.boundary);
  });

  it("lets one level extend into a balcony and expands the building footprint without changing its other level", () => {
    const prepared = projectWithHouse();
    const project = createLevelForBuilding(prepared.project, { id: "upper", constructionId: "upper-plan", buildingId: "house", name: "Upper floor" }, prepared.identity);
    const rightWall = project.constructions[0].walls.find(({ start, end }) => start.x === 10 && end.x === 10)!;
    const result = moveSelection(project, { activePlaceId: "floor", selection: { kind: "wall", id: rightWall.id }, delta: { x: 2, y: 0 }, boundaryEditing: true }, prepared.identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const floor = result.project.places.find(({ id }) => id === "floor")!;
    const upper = result.project.places.find(({ id }) => id === "upper")!;
    const house = result.project.places.find(({ id }) => id === "house")!;
    expect(Math.max(...shapePoints(floor.boundary!).map(({ x }) => x))).toBeCloseTo(12);
    expect(Math.max(...shapePoints(upper.boundary!).map(({ x }) => x))).toBeCloseTo(10);
    expect(Math.max(...shapePoints(house.boundary!).map(({ x }) => x))).toBeCloseTo(12);
  });

  it("moves a wall junction directly and keeps every connected wall attached", () => {
    const { project, identity } = projectWithHouse(); const document = project.constructions[0]; const corner = document.walls[0].start;
    const connected = document.walls.filter((wall) => wall.start.x === corner.x && wall.start.y === corner.y || wall.end.x === corner.x && wall.end.y === corner.y);
    const next = { x: corner.x + 2, y: corner.y + 1 };
    const result = moveWallEndpoint(project, { activePlaceId: "floor", wallId: document.walls[0].id, endpoint: "start", point: next, boundaryEditing: true }, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changed = result.project.constructions[0];
    expect(connected.every(({ id }) => { const wall = changed.walls.find((candidate) => candidate.id === id)!; return [wall.start, wall.end].some((point) => point.x === next.x && point.y === next.y); })).toBe(true);
  });

  it("moves a closed interior room as one structural unit", () => {
    const { project, identity } = projectWithHouse(); const base = project.constructions[0];
    const inner = [
      { id: "inner-top", start: { x: -5, y: -3 }, end: { x: 5, y: -3 }, thickness: .2, role: "partition" as const },
      { id: "inner-right", start: { x: 5, y: -3 }, end: { x: 5, y: 3 }, thickness: .2, role: "partition" as const },
      { id: "inner-bottom", start: { x: 5, y: 3 }, end: { x: -5, y: 3 }, thickness: .2, role: "partition" as const },
      { id: "inner-left", start: { x: -5, y: 3 }, end: { x: -5, y: -3 }, thickness: .2, role: "partition" as const },
    ];
    const document = createConstructionDocument(base.id, [...base.walls, ...inner], { createId: identity.createId, createName: identity.createRoomName });
    const network = buildWallNetwork(document.walls); const innerFace = network.faces.find((face) => face.wallIds.every((id) => inner.some((wall) => wall.id === id)))!;
    const room = document.rooms.find(({ faceId }) => faceId === innerFace.id)!; const withRoom = { ...project, constructions: [document] };
    const result = moveSelection(withRoom, { activePlaceId: "floor", selection: { kind: "room", id: room.id }, delta: { x: 2, y: 1 }, boundaryEditing: false }, identity);
    expect(result.state).toBe("applied");
    const changed = result.state === "applied" ? result.project : withRoom;
    expect(changed.constructions[0].walls.find(({ id }) => id === "inner-top")?.start).toEqual({ x: -3, y: -2 });
  });

  it("blocks a wall move that would leave furniture outside its room", () => {
    const { project, identity } = projectWithHouse(); const base = project.constructions[0];
    const partition = { id: "partition", start: { x: 0, y: -7 }, end: { x: 0, y: 7 }, thickness: .2, role: "partition" as const };
    const document = createConstructionDocument(base.id, [...base.walls, partition], { createId: identity.createId, createName: identity.createRoomName });
    const network = buildWallNetwork(document.walls); const leftFace = network.faces.find(({ outer }) => Math.max(...outer.map(({ x }) => x)) <= 0)!;
    const leftRoom = document.rooms.find(({ faceId }) => faceId === leftFace.id)!;
    const table = { id: "table", belongsToId: leftRoom.id, name: "Table", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: -1.5, y: -1, width: 1, height: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const prepared = { ...project, constructions: [document], elements: [table] };
    const result = moveSelection(prepared, { activePlaceId: "floor", selection: { kind: "wall", id: "partition" }, delta: { x: -2, y: 0 }, boundaryEditing: false }, identity);
    expect(result).toMatchObject({ state: "blocked", reason: "collision" });
  });

  it("removes a selected opening without requiring an eraser mode", () => {
    const { project, identity } = projectWithHouse(); const document = project.constructions[0];
    const withDoor = { ...project, constructions: [{ ...document, openings: [{ id: "door", kind: "door" as const, wallId: document.walls[0].id, position: .5, width: 1 }] }] };
    const result = deleteSelection(withDoor, { activePlaceId: "floor", selection: { kind: "opening", id: "door" }, boundaryEditing: false }, identity);
    expect(result.state).toBe("applied"); if (result.state === "applied") expect(result.project.constructions[0].openings).toEqual([]);
  });

  it("does not let an opening leave the room from which it is being edited", () => {
    const { project, identity } = projectWithHouse();
    const partitioned = createConstructionDocument("plan", [...project.constructions[0].walls, { id: "partition", start: { x: 0, y: -7 }, end: { x: 0, y: 7 }, thickness: .2, role: "partition" }], { createId: identity.createId, createName: identity.createRoomName });
    const network = buildWallNetwork(partitioned.walls); const leftFace = network.faces.find(({ outer }) => outer.some(({ x }) => x < 0))!; const leftRoom = partitioned.rooms.find(({ faceId }) => faceId === leftFace.id)!; const west = partitioned.walls.find(({ start, end }) => start.x === -10 && end.x === -10)!;
    const furnished = { ...partitioned, openings: [{ id: "door", kind: "door" as const, wallId: west.id, position: .5, width: 1 }] };
    const withRoom = { ...project, constructions: [furnished], places: [...project.places.filter(({ kind }) => kind !== "room"), { id: leftRoom.id, parentId: "floor", name: leftRoom.name, kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "polygon" as const, points: leftFace.outer }, tags: [], access: [], properties: {} }] };
    expect(moveSelection(withRoom, { activePlaceId: leftRoom.id, selection: { kind: "opening", id: "door" }, delta: { x: 20, y: 0 }, boundaryEditing: false }, identity)).toMatchObject({ state: "blocked", reason: "outside-outline" });
  });

  it("deletes a room by removing only its shared interior wall", () => {
    const { project, identity } = projectWithHouse(); const base = project.constructions[0];
    const partition = { id: "partition", start: { x: 0, y: -7 }, end: { x: 0, y: 7 }, thickness: .2, role: "partition" as const };
    const document = createConstructionDocument(base.id, [...base.walls, partition], { createId: identity.createId, createName: identity.createRoomName });
    const withRooms = { ...project, constructions: [document] }; const room = document.rooms[0];
    const result = deleteSelection(withRooms, { activePlaceId: "floor", selection: { kind: "room", id: room.id }, boundaryEditing: false }, identity);
    expect(result.state).toBe("review-required"); if (result.state !== "review-required") return;
    const changed = result.accept();
    expect(changed.constructions[0].walls.map(({ id }) => id)).not.toContain("partition");
    expect(changed.constructions[0].rooms).toHaveLength(1);
  });

  it("merges selected neighbouring rooms and keeps their contents in the surviving room", () => {
    const { project, identity } = projectWithHouse(); const base = project.constructions[0];
    const document = createConstructionDocument(base.id, [...base.walls, { id: "partition", start: { x: 0, y: -7 }, end: { x: 0, y: 7 }, thickness: .2, role: "partition" }], { createId: identity.createId, createName: identity.createRoomName });
    const first = document.rooms[0]; const second = document.rooms[1];
    const chair = { id: "chair", belongsToId: second.id, name: "Chair", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "point" as const, at: { x: 4, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const prepared = { ...project, constructions: [document], elements: [chair] };
    const result = mergeSelectedRooms(prepared, "floor", [first.id, second.id], identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.constructions[0].rooms).toHaveLength(1);
    const survivor = result.project.constructions[0].rooms[0];
    expect(survivor.name).toBe(first.name);
    expect(result.project.elements[0].belongsToId).toBe(survivor.id);
  });

  it("resizes an equipment region but keeps it inside its room", () => {
    const { project } = projectWithHouse();
    const withTable = { ...project, elements: [{ id: "table", belongsToId: "floor", name: "Table", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: -2, y: -2, width: 4, height: 3 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    const resized = resizeElementRegion(withTable, "table", "south-east", { x: 5, y: 4 });
    expect(resized.state).toBe("applied");
    const outside = resizeElementRegion(withTable, "table", "south-east", { x: 50, y: 40 });
    expect(outside).toMatchObject({ state: "blocked", reason: "outside-outline" });
  });

  it("moves one vertex of an existing terrain region", () => {
    const { project } = projectWithHouse();
    const meadow = { id: "meadow", belongsToId: "map", name: "Meadow", layerId: "terrain" as const, subjectId: "terrain.meadow", geometry: { kind: "region" as const, shape: { kind: "polygon" as const, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }] } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const result = moveElementRegionVertex({ ...project, elements: [meadow] }, "meadow", 0, 2, { x: 8, y: 7 });
    expect(result.state).toBe("applied");
    if (result.state !== "applied") return;
    expect(result.project.elements[0].geometry).toMatchObject({ kind: "region", shape: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 8, y: 7 }, { x: 0, y: 8 }] } });
  });

  it("stores an element description and searchable tags without changing its geometry", () => {
    const { project } = projectWithHouse();
    const table = { id: "table", belongsToId: "floor", name: "Table", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: -2, y: -2, width: 4, height: 3 } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const changed = updateElementDetails({ ...project, elements: [table] }, "table", { description: "Heavy oak table", tags: ["oak", "damaged"], visible: false, locked: true });
    expect(changed.elements[0]).toMatchObject({ description: "Heavy oak table", tags: ["oak", "damaged"], visible: false, locked: true, geometry: table.geometry });
  });

  it("moves several selected buildings atomically without treating their old positions as collisions", () => {
    const prepared = projectWithHouse();
    const second = { ...prepared.project.places.find(({ id }) => id === "house")!, id: "annex", name: "Annex", transform: { x: 65, y: 45, rotation: 0 } };
    const project = { ...prepared.project, places: [...prepared.project.places, second] };
    const moved = moveSelectionGroup(project, { activePlaceId: "map", selections: [{ kind: "place", id: "house" }, { kind: "place", id: "annex" }], delta: { x: 3, y: 2 }, boundaryEditing: false }, prepared.identity);
    expect(moved.state).toBe("applied"); if (moved.state !== "applied") return;
    expect(moved.project.places.find(({ id }) => id === "house")?.transform).toMatchObject({ x: 33, y: 29 });
    expect(moved.project.places.find(({ id }) => id === "annex")?.transform).toMatchObject({ x: 68, y: 47 });
  });

  it("deletes several selected ordinary objects in one project change", () => {
    const { project, identity } = projectWithHouse();
    const object = (id: string, x: number) => ({ id, belongsToId: "floor", name: id, layerId: "equipment" as const, subjectId: "equipment.object", geometry: { kind: "point" as const, at: { x, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const prepared = { ...project, elements: [object("a", 0), object("b", 2)] };
    const deleted = deleteSelectionGroup(prepared, { activePlaceId: "floor", selections: [{ kind: "element", id: "a" }, { kind: "element", id: "b" }], boundaryEditing: false }, identity);
    expect(deleted.state).toBe("applied"); if (deleted.state === "applied") expect(deleted.project.elements).toEqual([]);
  });

  it("deletes a mixed room and wall selection as one construction operation", () => {
    const { project, identity } = projectWithHouse(); const base = project.constructions[0];
    const document = createConstructionDocument(base.id, [...base.walls, { id: "partition", start: { x: 0, y: -7 }, end: { x: 0, y: 7 }, thickness: .2, role: "partition" }], { createId: identity.createId, createName: identity.createRoomName });
    const deleted = deleteSelectionGroup({ ...project, constructions: [document] }, { activePlaceId: "floor", selections: [{ kind: "room", id: document.rooms[0].id }, { kind: "wall", id: "partition" }], boundaryEditing: false }, identity);
    expect(deleted.state).toBe("applied"); if (deleted.state !== "applied") return;
    expect(deleted.project.constructions[0].walls.map(({ id }) => id)).not.toContain("partition");
    expect(deleted.project.constructions[0].rooms).toHaveLength(1);
  });

  it("moves only the selected atomic wall segments as one group", () => {
    const { project, identity } = projectWithHouse();
    const base = project.constructions[0];
    const document = createConstructionDocument(base.id, [
      ...base.walls,
      { id: "horizontal", start: { x: -8, y: 0 }, end: { x: 8, y: 0 }, thickness: .2, role: "partition" },
      { id: "vertical", start: { x: 0, y: -5 }, end: { x: 0, y: 5 }, thickness: .2, role: "partition" },
    ], { createId: identity.createId, createName: identity.createRoomName });
    const prepared = { ...project, constructions: [document] };
    const selected = document.walls.filter(({ id }) => id === "horizontal:1" || id === "vertical:1");
    const untouched = document.walls.find(({ id }) => id === "horizontal:2")!;
    const result = moveSelectionGroup(prepared, { activePlaceId: "floor", selections: selected.map(({ id }) => ({ kind: "wall" as const, id })), delta: { x: 1, y: 2 }, boundaryEditing: false }, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const movedFamily = result.project.constructions[0].walls.filter(({ id }) => selected.some(({ id: sourceId }) => id === sourceId || id.startsWith(`${sourceId}:`)));
    expect(movedFamily.some(({ start, end }) => [start, end].some((point) => point.x === selected[0].start.x + 1 && point.y === selected[0].start.y + 2))).toBe(true);
    const untouchedFamily = result.project.constructions[0].walls.filter(({ id }) => id === untouched.id || id.startsWith(`${untouched.id}:`));
    expect(untouchedFamily.flatMap(({ start, end }) => [start, end])).toContainEqual(untouched.end);
  });

});
