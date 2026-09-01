import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { addConstructionSurface, addElement, createPlace } from "../model/hierarchy-operations";
import { applyAffinePoint, relativePlaceMatrix } from "../geometry/affine-transform";
import { EditorSession } from "../state/editor-session";
import { canRotateSelection, rotateSelection, rotationSelectionBounds, rotationSelectionCenter } from "./selection-rotation";

const identity = { createId: (() => { let index = 0; return () => `generated-${++index}`; })(), createRoomName: (index: number) => `Room ${index}` };
const point = (id: string, at: { x: number; y: number }, owner = "world"): DrawingElement => ({ id, belongsToId: owner, name: id, layerId: "terrain", subjectId: "terrain.meadow", geometry: { kind: "point", at }, visible: true, locked: false, tags: [], access: [], properties: {} });

describe("shared selection rotation", () => {
  it("exposes one active-sheet bounds centre and rotates mixed drawable objects by an exact angle", () => {
    const project = { ...emptyProject("p", "Project"), places: [{ id: "world", name: "World", kind: "world" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle" as const, x: -100, y: -100, width: 200, height: 200 }, tags: [], access: [], properties: {} }], elements: [point("a", { x: 0, y: 0 }), point("b", { x: 10, y: 0 })] };
    const selection = [{ kind: "element" as const, id: "a" }, { kind: "element" as const, id: "b" }];
    expect(rotationSelectionBounds(project, "world", selection)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 0 });
    expect(rotationSelectionCenter(project, "world", selection)).toEqual({ x: 5, y: 0 });
    const result = rotateSelection(project, "world", selection, 90, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const points = result.project.elements.map((element) => element.geometry.kind === "point" ? element.geometry.at : undefined);
    expect(points[0]).toEqual({ x: 5, y: -5 }); expect(points[1]?.x).toBeCloseTo(5); expect(points[1]?.y).toBeCloseTo(5);
  });

  it("rotates a note box and includes its rotated corners in the selection bounds", () => {
    const project = { ...emptyProject("p", "Project"), places: [{ id: "world", name: "World", kind: "world" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle" as const, x: -100, y: -100, width: 200, height: 200 }, tags: [], access: [], properties: {} }], elements: [{ id: "note", belongsToId: "world", name: "Note", layerId: "sketch" as const, subjectId: "sketch.note", geometry: { kind: "note" as const, at: { x: 0, y: 0 }, width: 10, height: 4, text: "Text" }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    expect(rotationSelectionBounds(project, "world", [{ kind: "element", id: "note" }])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 4 });
    const result = rotateSelection(project, "world", [{ kind: "element", id: "note" }], 90, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements[0]!.geometry).toMatchObject({ kind: "note", at: { x: 7, y: -3 }, width: 10, height: 4, rotation: 90 });
    expect(rotationSelectionBounds(result.project, "world", [{ kind: "element", id: "note" }])).toMatchObject({ minX: 3, minY: -3, maxY: 7 });
    expect(rotationSelectionBounds(result.project, "world", [{ kind: "element", id: "note" }])?.maxX).toBeCloseTo(7);
  });

  it("rotates a selected place once when one of its children is also selected", () => {
    let project = createStarterProject("p", "Project", "en"); project = { ...project, places: project.places.map((candidate) => candidate.kind === "world" ? { ...candidate, boundary: { kind: "rectangle", x: -200, y: -200, width: 400, height: 400 } } : candidate) }; const place = project.places.find(({ kind }) => kind === "location")!;
    project = addElement(project, { ...point("marker", { x: 2, y: 0 }), belongsToId: place.id }, place.id);
    const before = project.elements[0]!.geometry;
    const result = rotateSelection(project, "p:world", [{ kind: "place", id: place.id }, { kind: "element", id: "marker" }], 30, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.selections).toEqual([{ kind: "place", id: place.id }]);
    expect(result.project.elements[0]!.geometry).toEqual(before);
    expect(result.project.places.find(({ id }) => id === place.id)!.transform.rotation).toBeCloseTo(30);
  });

  it("rotates a room and its furniture once while keeping the construction boundary safe", () => {
    const base = createStarterProject("p", "Project", "en"); const level = base.places.find(({ kind }) => kind === "level")!; const room = base.constructions[0]!.rooms[0]!;
    const project = addElement(base, { ...point("table", { x: 4, y: 3 }), belongsToId: room.id, layerId: "equipment", subjectId: "equipment.furniture" }, level.id);
    const result = rotateSelection(project, level.id, [{ kind: "room", id: room.id }], 25, identity, true);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const table = result.project.elements.find(({ id }) => id === "table")!; expect(table.geometry.kind).toBe("point");
    if (table.geometry.kind === "point") { expect(table.geometry.at.x).not.toBe(4); expect(table.geometry.at.y).not.toBe(3); }
    expect(result.project.places.some((place) => place.parentId === level.id && place.kind === "room" && place.boundary)).toBe(true);
  });

  it("keeps a child surface local when its containing location rotates", () => {
    let project = createStarterProject("p", "Project", "en"); const location = project.places.find(({ kind }) => kind === "location")!; const level = project.places.find(({ kind }) => kind === "level")!;
    project = addConstructionSurface(project, { id: "terrace", name: "Terrace", kind: "terrace", shape: { kind: "circle", cx: 10, cy: 10, radius: 2 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {}, belongsToId: location.id }, level.id);
    const before = project.surfaces[0]!.shape; const beforeWorld = applyAffinePoint(relativePlaceMatrix(project, "p:world", location.id), { x: 10, y: 10 });
    const result = rotateSelection(project, "p:world", [{ kind: "place", id: location.id }, { kind: "surface", id: "terrace" }], 35, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.surfaces[0]!.shape).toEqual(before);
    const afterWorld = applyAffinePoint(relativePlaceMatrix(result.project, "p:world", location.id), { x: 10, y: 10 }); expect(afterWorld).not.toEqual(beforeWorld);
  });

  it("keeps location overlap allowed but still checks building containment", () => {
    let project = emptyProject("p", "Project"); project = createPlace(project, { id: "world", name: "World", kind: "world", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 } });
    project = createPlace(project, { id: "location", parentId: "world", name: "Location", kind: "location", boundary: { kind: "rectangle", x: -20, y: -20, width: 40, height: 40 } });
    const locationResult = rotateSelection(project, "world", [{ kind: "place", id: "location" }], 35, identity); expect(locationResult.state).toBe("applied");
    const starter = createStarterProject("starter", "Project", "en"); const building = starter.places.find(({ kind }) => kind === "building")!;
    expect(rotateSelection(starter, "starter:place", [{ kind: "place", id: building.id }], 35, identity).state).toBe("applied");
  });

  it("protects construction boundaries and keeps an attached door on its wall", () => {
    const base = createStarterProject("p", "Project", "en"); const level = base.places.find(({ kind }) => kind === "level")!; const original = base.constructions[0]!; const wall = original.walls[0]!;
    const project = { ...base, constructions: [{ ...original, openings: [{ id: "door", kind: "door" as const, wallId: wall.id, position: .5, width: 1 }] }] };
    expect(canRotateSelection(project, level.id, [{ kind: "room", id: original.rooms[0]!.id }])).toEqual({ can: false, reason: "locked-outline" });
    const result = rotateSelection(project, level.id, [{ kind: "room", id: original.rooms[0]!.id }], 20, identity, true);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.constructions[0]!.openings[0]!.wallId).toBe(wall.id); expect(result.project.constructions[0]!.walls[0]!.start).not.toEqual(wall.start);
  });

  it("records rotation in session history so undo restores the exact project", () => {
    const project = { ...emptyProject("p", "Project"), places: [{ id: "world", name: "World", kind: "world" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle" as const, x: -100, y: -100, width: 200, height: 200 }, tags: [], access: [], properties: {} }], elements: [point("a", { x: 0, y: 0 }), point("b", { x: 10, y: 0 })] };
    const session = new EditorSession(project, { initialPlaceId: "world", createRoomName: (index) => `Room ${index}` }); const initial = session.getState().project;
    const result = rotateSelection(initial, "world", [{ kind: "element", id: "a" }, { kind: "element", id: "b" }], 33, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(session.executeTransaction({ id: "rotate", apply: () => result.project }).changed).toBe(true); expect(session.undo().changed).toBe(true); expect(session.getState().project).toEqual(initial);
  });

  it("rotates a transition through its construction owner without changing links", () => {
    const base = createStarterProject("p", "Project", "en"); const level = base.places.find(({ kind }) => kind === "level")!; const document = base.constructions.find(({ id }) => id === level.constructionId)!;
    const project = { ...base, constructions: [{ ...document, transitions: [{ id: "stairs", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 0, y: 0, width: 2, height: 4 }, sourceLevelId: level.id, targetLevelId: level.id, direction: 10 }] }] };
    const result = rotateSelection(project, "p:world", [{ kind: "transition", id: "stairs" }], 45, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const transition = result.project.constructions[0]!.transitions[0]!;
    expect(transition.sourceLevelId).toBe(level.id); expect(transition.targetLevelId).toBe(level.id); expect(transition.direction).toBeCloseTo(55); expect(transition.footprint.kind).toBe("polygon");
  });

  it("never detaches an opening when it is selected on its own", () => {
    const base = createStarterProject("p", "Project", "en"); const document = base.constructions[0]!; const project = { ...base, constructions: [{ ...document, openings: [{ id: "door", kind: "door" as const, wallId: document.walls[0]!.id, position: .5, width: 1 }] }] };
    expect(canRotateSelection(project, "p:world", [{ kind: "opening", id: "door" }])).toEqual({ can: false, reason: "anchored-opening" });
    expect(rotateSelection(project, "p:world", [{ kind: "opening", id: "door" }], 20, identity)).toEqual({ state: "blocked", project, reason: "anchored-opening" });
  });
});
