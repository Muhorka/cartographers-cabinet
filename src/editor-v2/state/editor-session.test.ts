import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { addElement, createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "./editor-session";
import { projectWithPlaces, squareWalls } from "./editor-session-fixtures";

describe("editor v2 session", () => {
  it("keeps complete project snapshots for undo and redo", () => {
    const session = new EditorSession(projectWithPlaces());
    const initial = session.getState().project;
    session.executeTransaction({
      id: "add-place",
      apply: (project) => createPlace(project, { id: "house", parentId: "room", name: "House", kind: "building" }),
    });
    session.executeTransaction({
      id: "add-second-place",
      apply: (project) => createPlace(project, { id: "level", parentId: "house", name: "Level", kind: "level" }),
    });

    expect(session.getState().project.places.map(({ id }) => id)).toEqual(["world", "room", "house", "level"]);
    expect(session.undo().code).toBe("committed");
    expect(session.getState().project.places.map(({ id }) => id)).toEqual(["world", "room", "house"]);
    expect(session.undo().code).toBe("committed");
    expect(session.getState().project).toEqual(initial);
    expect(session.undo().code).toBe("history-empty");
    expect(session.redo().code).toBe("committed");
    expect(session.redo().code).toBe("committed");
    expect(session.getState().project.places.map(({ id }) => id)).toEqual(["world", "room", "house", "level"]);
  });

  it("repairs a legacy near-gap and creates the missing navigable room on load", () => {
    const identity = { createId: (() => { let index = 0; return () => `room-${++index}`; })(), createName: (index: number) => `Room ${index}` };
    const construction = createConstructionDocument("plan", squareWalls(), identity);
    const existingRoom = construction.rooms[0];
    const withLegacyGap = {
      ...construction,
      walls: [
        ...construction.walls,
        { id: "partition-top", start: { x: 5, y: 0 }, end: { x: 5, y: 3.99 }, thickness: .2, role: "partition" as const },
        { id: "partition-bottom", start: { x: 5, y: 4.01 }, end: { x: 5, y: 8 }, thickness: .2, role: "partition" as const },
      ],
    };
    let project = createPlace(emptyProject("project", "Project"), { id: "level", name: "Level", kind: "level", constructionId: "plan" });
    project = createPlace(project, { id: existingRoom.id, parentId: "level", name: "Named hall", kind: "room", boundary: { kind: "polygon", points: buildWallNetwork(construction.walls).faces[0].outer } });
    project = { ...project, constructions: [withLegacyGap] };

    const session = new EditorSession(project, { initialPlaceId: "level", createId: (() => { let index = 10; return () => `new-room-${++index}`; })(), createRoomName: (index) => `Room ${index}` });
    const repaired = session.getState().project;
    expect(repaired.constructions[0].rooms).toHaveLength(2);
    expect(repaired.places.filter(({ kind }) => kind === "room")).toHaveLength(2);
    expect(repaired.places.some(({ name }) => name === "Named hall")).toBe(true);
    const endpoints = repaired.constructions[0].walls.filter(({ id }) => id.startsWith("partition-")).flatMap(({ start, end }) => [start, end]);
    expect(endpoints.filter(({ x, y }) => x === 5 && y === 4)).toHaveLength(2);
  });

  it("falls back to the surviving parent when load repair removes the requested room", () => {
    const construction = createConstructionDocument("plan", [], { createId: () => "unused", createName: () => "Unused" });
    let project = createPlace(emptyProject("project", "Project"), { id: "level", name: "Level", kind: "level", constructionId: "plan" });
    project = createPlace(project, { id: "stale-room", parentId: "level", name: "Stale room", kind: "room" });
    project = { ...project, constructions: [construction] };

    const session = new EditorSession(project, { initialPlaceId: "stale-room" });

    expect(session.getState().activePlaceId).toBe("level");
    expect(session.getState().project.places.map(({ id }) => id)).toEqual(["level"]);
  });

  it("keeps the active place and blocks navigation with a pending structural transaction", () => {
    const session = new EditorSession(projectWithPlaces(), { initialPlaceId: "world" });
    expect(session.getState().activePlaceId).toBe("world");
    expect(session.openPlace("room").code).toBe("committed");
    expect(session.getState().activePlaceId).toBe("room");
    session.setPendingStructuralTransaction({ id: "wall-move", constructionId: "plan", beforeRevision: 3 });
    expect(session.openPlace("world").code).toBe("navigation-blocked-pending-structural");
    expect(session.getState().activePlaceId).toBe("room");
    session.setPendingStructuralTransaction(undefined);
    expect(session.openPlace("world").code).toBe("committed");
  });

  it("uses explicit selection kinds without putting UI state in project history", () => {
    let project = projectWithPlaces();
    project = addElement(project, {
      id: "river",
      name: "River",
      layerId: "terrain",
      subjectId: "terrain.water",
      geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 8, y: 0 }], closed: false },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    }, "world");
    const session = new EditorSession(project, { initialPlaceId: "room" });
    const before = session.getState().project;
    expect(session.setSelection([{ kind: "element", id: "river" }]).code).toBe("committed");
    session.setBoundaryEditing(true);
    session.activateLayer("sketch");
    session.chooseSubject("sketch.note");
    expect(session.getState().selection).toEqual([{ kind: "element", id: "river" }]);
    expect(session.getState().boundaryEditing).toBe(true);
    expect(session.getState().project).toEqual(before);
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });

  it("clears only elements owned by the active place and leaves all other layers alone", () => {
    let project = projectWithPlaces();
    project = addElement(project, {
      id: "room-note",
      name: "Room note",
      layerId: "sketch",
      subjectId: "sketch.note",
      geometry: { kind: "note", at: { x: 1, y: 1 }, text: "note" },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    }, "room");
    project = addElement(project, {
      id: "world-river",
      name: "World river",
      layerId: "terrain",
      subjectId: "terrain.water",
      geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 8, y: 0 }], closed: false },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    }, "world");
    const session = new EditorSession(project, { initialPlaceId: "room" });
    expect(session.clearCurrentLayer("sketch").code).toBe("committed");
    expect(session.getState().project.elements.map(({ id }) => id)).toEqual(["world-river"]);
    expect(session.undo().code).toBe("committed");
    expect(session.getState().project.elements.map(({ id }) => id)).toEqual(["room-note", "world-river"]);
  });

  it("clears the active local road layer and restores it with undo", () => {
    let project = projectWithPlaces();
    const road = (id: string) => ({ id, name: id, layerId: "roads" as const, subjectId: "road.paved", geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }, { x: 8, y: 0 }], closed: false }, widthMeters: 4, visible: true, locked: false, tags: [], access: [], properties: {} });
    project = addElement(project, road("room-road"), "room"); project = addElement(project, road("world-road"), "world");
    const session = new EditorSession(project, { initialPlaceId: "room" }); session.activateLayer("roads");
    expect(session.clearCurrentLayer().code).toBe("committed"); expect(session.getState().project.elements.map(({ id }) => id)).toEqual(["world-road"]); expect(session.getHistoryState().canUndo).toBe(true);
    expect(session.undo().code).toBe("committed"); expect(session.getState().project.elements.map(({ id }) => id)).toEqual(["room-road", "world-road"]);
  });

  it("clears construction contents but preserves boundary walls and rebuilds rooms", () => {
    const construction = createConstructionDocument("plan", squareWalls(), { createId: (() => { let i = 0; return () => `room-${++i}`; })(), createName: (index) => `Room ${index}` });
    const walls = [...construction.walls, { id: "partition", start: { x: 5, y: 0 }, end: { x: 5, y: 8 }, thickness: 0.3, role: "partition" as const }];
    const withPartition = { ...construction, walls };
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "level", name: "Level", kind: "level", constructionId: "plan" });
    project = { ...project, constructions: [withPartition] };
    const session = new EditorSession(project, { initialPlaceId: "level", createId: (() => { let i = 10; return () => `new-room-${++i}`; })(), createRoomName: (index) => `Room ${index}` });
    expect(session.clearCurrentLayer("construction").code).toBe("committed");
    const after = session.getState().project.constructions[0];
    expect(after.walls.length).toBeGreaterThanOrEqual(4);
    expect(after.walls.every(({ role }) => role === "boundary")).toBe(true);
    expect(after.rooms).toHaveLength(1);
    expect(session.getState().project.places.map(({ kind }) => kind)).toEqual(["level", "room"]);
  });

  it("does not clear the neighbouring floor construction from inside a room", () => {
    const construction = createConstructionDocument("plan", [
      ...squareWalls(),
      { id: "partition", start: { x: 5, y: 0 }, end: { x: 5, y: 8 }, thickness: 0.3, role: "partition" },
    ], { createId: (() => { let i = 0; return () => `room-${++i}`; })(), createName: (index) => `Room ${index}` });
    const room = construction.rooms[0];
    let project = createPlace(emptyProject("project", "Project"), { id: "level", name: "Level", kind: "level", constructionId: "plan" });
    project = createPlace(project, { id: room.id, parentId: "level", name: room.name, kind: "room", boundary: { kind: "polygon", points: construction.rooms.length ? buildWallNetwork(construction.walls).faces.find(({ id }) => id === room.faceId)!.outer : [] } });
    project = { ...project, constructions: [construction] };
    const session = new EditorSession(project, { initialPlaceId: room.id });

    expect(session.clearCurrentLayer("construction")).toEqual({ code: "nothing-to-clear", changed: false });
    expect(session.getState().project.constructions[0]).toEqual(construction);
  });

  it("clears the routed construction while a one-level building is the active map", () => {
    const project = createStarterProject("project", "Project", "en"); const base = project.constructions[0];
    const withPartition = { ...project, constructions: [{ ...base, walls: [...base.walls, { id: "partition", start: { x: 0, y: -11 }, end: { x: 0, y: 11 }, thickness: .2, role: "partition" as const }] }] };
    const session = new EditorSession(withPartition, { initialPlaceId: "project:building" });
    expect(session.clearCurrentLayer("construction").code).toBe("committed");
    expect(session.getState().project.constructions[0].walls.every(({ role }) => role === "boundary")).toBe(true);
  });

  it("repairs room records centrally when an operation changes walls without synchronizing rooms", () => {
    const identity = { createId: (() => { let index = 0; return () => `room-${++index}`; })(), createName: (index: number) => `Room ${index}` };
    const construction = createConstructionDocument("plan", squareWalls(), identity);
    let project = createPlace(emptyProject("project", "Project"), { id: "level", name: "Level", kind: "level", constructionId: "plan" });
    project = { ...project, constructions: [construction] };
    const session = new EditorSession(project, { initialPlaceId: "level", createId: identity.createId, createRoomName: identity.createName });
    session.executeTransaction({
      id: "legacy-wall-write",
      apply: (current) => ({ ...current, constructions: current.constructions.map((document) => document.id === "plan" ? {
        ...document,
        walls: [...document.walls, { id: "partition", start: { x: 5, y: 0 }, end: { x: 5, y: 8 }, thickness: .2, role: "partition" as const }],
      } : document) }),
    });
    const repaired = session.getState().project;
    expect(repaired.constructions[0].rooms).toHaveLength(2);
    expect(repaired.places.filter(({ parentId, kind }) => parentId === "level" && kind === "room")).toHaveLength(2);
  });

  it("clears place boundaries with their contents from the open map", () => {
    const session = new EditorSession(projectWithPlaces(), { initialPlaceId: "world" });
    expect(session.clearCurrentLayer("boundaries").code).toBe("committed");
    expect(session.getState().project.places.map(({ id }) => id)).toEqual(["world"]);
  });

  it("clears doors, windows and stairs without deleting walls", () => {
    const construction = createConstructionDocument("plan", squareWalls(), { createId: () => "room", createName: () => "Room" });
    const furnished = { ...construction, openings: [{ id: "door", kind: "door" as const, wallId: construction.walls[0].id, position: .5, width: 1 }], transitions: [{ id: "stairs", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 2, y: 2, width: 2, height: 2 } }] };
    let project = createPlace(emptyProject("project", "Project"), { id: "level", name: "Level", kind: "level", constructionId: "plan" }); project = { ...project, constructions: [furnished] };
    const session = new EditorSession(project, { initialPlaceId: "level" });
    expect(session.clearCurrentLayer("openings").code).toBe("committed");
    expect(session.getState().project.constructions[0]).toMatchObject({ openings: [], transitions: [], walls: construction.walls });
  });

  it("clears only the doors and stairs belonging to an opened room", () => {
    const construction = createConstructionDocument("plan", [
      ...squareWalls(),
      { id: "partition", start: { x: 5, y: 0 }, end: { x: 5, y: 8 }, thickness: 0.2, role: "partition" },
    ], { createId: (() => { let index = 0; return () => `room-${++index}`; })(), createName: (index) => `Room ${index}` });
    const network = buildWallNetwork(construction.walls);
    const leftFace = network.faces.find(({ outer }) => outer.some(({ x }) => x === 0))!;
    const leftRoom = construction.rooms.find(({ faceId }) => faceId === leftFace.id)!;
    const topWallId = construction.walls.find(({ start, end }) => start.y === 0 && end.y === 0 && Math.max(start.x, end.x) <= 5)!.id;
    const rightWallId = construction.walls.find(({ start, end }) => start.x === 10 && end.x === 10)!.id;
    const furnished = {
      ...construction,
      openings: [
        { id: "left-door", kind: "door" as const, wallId: topWallId, position: .25, width: 1 },
        { id: "right-door", kind: "door" as const, wallId: rightWallId, position: .5, width: 1 },
      ],
      transitions: [
        { id: "left-stairs", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 1, y: 2, width: 2, height: 2 } },
        { id: "right-stairs", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 7, y: 2, width: 2, height: 2 } },
      ],
    };
    let project = createPlace(emptyProject("project", "Project"), { id: "level", name: "Level", kind: "level", constructionId: "plan" });
    project = createPlace(project, { id: leftRoom.id, parentId: "level", name: leftRoom.name, kind: "room", boundary: { kind: "polygon", points: leftFace.outer } });
    project = { ...project, constructions: [furnished] };
    const session = new EditorSession(project, { initialPlaceId: leftRoom.id });

    expect(session.clearCurrentLayer("openings").code).toBe("committed");
    expect(session.getState().project.constructions[0].openings.map(({ id }) => id)).toEqual(["right-door"]);
    expect(session.getState().project.constructions[0].transitions.map(({ id }) => id)).toEqual(["right-stairs"]);
  });

});
