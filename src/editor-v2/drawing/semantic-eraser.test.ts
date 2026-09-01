import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import { addConstructionSurface, addElement, createBuildingWithDefaultLevel, createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { eraseCurrentLayer } from "./semantic-eraser";
import { createStarterProject } from "../model/starter-project";
import { buildWallNetwork } from "../geometry/wall-network-kernel";

const identity = { createId: (() => { let id = 0; return () => `new-${++id}`; })(), createName: (index: number) => `Room ${index}` };

describe("one semantic eraser", () => {
  it("erases the whole note when the stroke lands inside its visible field", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    project = addElement(project, { id: "note", name: "Note", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, width: 10, height: 4, text: "Keep this" }, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    const result = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "sketch", points: [{ x: 5, y: 2 }], radius: .2, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    expect(result.project.elements).toHaveLength(0);
  });

  it("hits a rotated note and a swept stroke through its box, preserving whole-object deletion", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    project = addElement(project, { id: "rotated-note", name: "Rotated note", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, width: 10, height: 4, rotation: 90, text: "Rotated" }, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    project = addElement(project, { id: "swept-note", name: "Swept note", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 20, y: 0 }, width: 10, height: 4, text: "Swept" }, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    const rotated = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "sketch", points: [{ x: -2, y: 5 }], radius: .2, boundaryEditing: false }, identity);
    expect(rotated.state).toBe("erased");
    expect(rotated.project.elements.map(({ id }) => id)).toEqual(["swept-note"]);
    const swept = eraseCurrentLayer(rotated.project, { activePlaceId: "map", layerId: "sketch", points: [{ x: 19, y: 2 }, { x: 31, y: 2 }], radius: .2, boundaryEditing: false }, identity);
    expect(swept.state).toBe("erased");
    expect(swept.project.elements).toHaveLength(0);
  });

  it("keeps the eraser radius circular at note corners and rejects far collinear strokes", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    project = addElement(project, { id: "note", name: "Note", layerId: "sketch", subjectId: "sketch.note", geometry: { kind: "note", at: { x: 0, y: 0 }, width: 10, height: 4, text: "Keep this" }, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    const cornerMiss = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "sketch", points: [{ x: -.9, y: -.9 }], radius: 1, boundaryEditing: false }, identity);
    expect(cornerMiss.state).toBe("nothing");
    expect(cornerMiss.project).toBe(project);
    const farCollinear = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "sketch", points: [{ x: 20, y: 0 }, { x: 30, y: 0 }], radius: 1, boundaryEditing: false }, identity);
    expect(farCollinear.state).toBe("nothing");
    const edgeHit = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "sketch", points: [{ x: -1, y: 0 }], radius: 1, boundaryEditing: false }, identity);
    expect(edgeHit.state).toBe("erased");
  });

  it("cuts a loose sketch line in the middle into two remaining strokes", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    project = addElement(project, { id: "line", name: "Sketch", layerId: "sketch", subjectId: "sketch.stroke", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    const result = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "sketch", points: [{ x: 5, y: -1 }, { x: 5, y: 1 }], radius: .2, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased"); expect(result.project.elements).toHaveLength(2);
    expect(result.project.elements.flatMap((element) => element.geometry.kind === "path" ? element.geometry.points : []).some(({ x }) => x > 4.7 && x < 5.3)).toBe(true);
  });

  it("cuts a pen curve at the erased place instead of deleting the whole curve", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    project = addElement(project, { id: "curve", name: "Curve", layerId: "sketch", subjectId: "sketch.stroke", geometry: { kind: "bezier", nodes: [{ anchor: { x: 0, y: 0 }, outHandle: { x: 3, y: 4 } }, { anchor: { x: 10, y: 0 }, inHandle: { x: 7, y: 4 } }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    const result = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "sketch", points: [{ x: 5, y: -1 }, { x: 5, y: 5 }], radius: .25, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    expect(result.project.elements).toHaveLength(2);
    expect(result.project.elements.every(({ geometry }) => geometry.kind === "path")).toBe(true);
  });

  it("cuts a terrain area with the visible eraser stroke instead of deleting the whole area", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    project = addElement(project, { id: "field", name: "Field", layerId: "terrain", subjectId: "terrain.field", geometry: { kind: "region", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 4 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    const result = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "terrain", points: [{ x: 5, y: -1 }, { x: 5, y: 5 }], radius: .4, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    expect(result.project.elements).toHaveLength(1);
    expect(result.project.elements[0]).toMatchObject({ name: "Field", geometry: { kind: "region", shape: { kind: "compound", polygons: [{}, {}] } } });
  });

  it("deletes a whole equipment object with a broad stroke", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "room", name: "Room", kind: "standalone-room", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 } });
    project = addElement(project, { id: "table", name: "Table", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "region", shape: { kind: "rectangle", x: 2, y: 2, width: 3, height: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "room");
    const result = eraseCurrentLayer(project, { activePlaceId: "room", layerId: "equipment", points: [{ x: 3, y: 1 }, { x: 3, y: 6 }], radius: .5, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    expect(result.project.elements).toHaveLength(0);
  });

  it("cuts a construction surface with the same freehand eraser", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    project = addConstructionSurface(project, { id: "deck", name: "Deck", kind: "platform", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 4 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }, "map");
    const result = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "construction", points: [{ x: 5, y: -1 }, { x: 5, y: 5 }], radius: .4, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    expect(result.project.surfaces).toHaveLength(1);
    expect(result.project.surfaces[0]).toMatchObject({ name: "Deck", shape: { kind: "compound", polygons: [{}, {}] } });
  });

  it("erases internal walls but never the locked exterior unless boundary editing is explicit", () => {
    const construction = createConstructionDocument("plan", [
      { id: "edge", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: .3, role: "boundary" },
      { id: "partition", start: { x: 5, y: 0 }, end: { x: 5, y: 8 }, thickness: .2, role: "partition" },
    ], identity);
    const project = { ...emptyProject("p", "P"), places: [{ id: "floor", name: "Floor", kind: "level" as const, constructionId: "plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }], constructions: [construction] };
    const result = eraseCurrentLayer(project, { activePlaceId: "floor", layerId: "construction", points: [{ x: 4, y: 4 }, { x: 6, y: 4 }], radius: .3, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    const partitions = result.project.constructions[0].walls.filter(({ role }) => role === "partition");
    expect(partitions).toHaveLength(2);
    expect(partitions.some(({ start, end }) => Math.max(start.y, end.y) < 4)).toBe(true);
    expect(partitions.some(({ start, end }) => Math.min(start.y, end.y) > 4)).toBe(true);
    expect(eraseCurrentLayer(result.project, { activePlaceId: "floor", layerId: "construction", points: [{ x: 2, y: -1 }, { x: 2, y: 1 }], radius: .3, boundaryEditing: false }, identity).state).toBe("nothing");
  });

  it("uses the real level construction when a one-level building is open", () => {
    const project = createStarterProject("p", "P", "en"); const document = project.constructions[0];
    const withPartition = { ...project, constructions: [{ ...document, walls: [...document.walls, { id: "partition", start: { x: 0, y: -11 }, end: { x: 0, y: 11 }, thickness: .2, role: "partition" as const }] }] };
    const result = eraseCurrentLayer(withPartition, { activePlaceId: "p:building", layerId: "construction", points: [{ x: -1, y: 0 }, { x: 1, y: 0 }], radius: .2, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    const partitions = result.project.constructions[0].walls.filter(({ role }) => role === "partition");
    expect(partitions).toHaveLength(2);
    expect(partitions.every(({ start, end }) => Math.min(Math.abs(start.y), Math.abs(end.y)) > .1)).toBe(true);
  });

  it("hits a building where it is drawn on its containing map, not at its local origin", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
    project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "floor", constructionId: "plan", parentId: "map", name: "House", levelName: "Floor", boundary: { kind: "rectangle", x: -5, y: -4, width: 10, height: 8 }, transform: { x: 30, y: 20, rotation: 0 } }, identity);
    expect(eraseCurrentLayer(project, { activePlaceId: "map", layerId: "buildings", points: [{ x: 30, y: 20 }], radius: .5, boundaryEditing: false }, identity)).toMatchObject({ state: "review-required", candidateIds: ["house"] });
    expect(eraseCurrentLayer(project, { activePlaceId: "map", layerId: "buildings", points: [{ x: 0, y: 0 }], radius: .5, boundaryEditing: false }, identity).state).toBe("nothing");
  });

  it("does not delete a derived room when the eraser touches only its interior", () => {
    const project = createStarterProject("p", "P", "en"); const document = project.constructions[0];
    const withPartitionDocument = createConstructionDocument(document.id, [...document.walls, { id: "partition", start: { x: 0, y: -11 }, end: { x: 0, y: 11 }, thickness: .2, role: "partition" }], identity);
    const withRooms = { ...project, constructions: [withPartitionDocument] };
    const result = eraseCurrentLayer(withRooms, { activePlaceId: "p:level", layerId: "construction", points: [{ x: 8, y: 0 }], radius: .6, boundaryEditing: false }, identity);
    expect(result.state).toBe("nothing");
    expect(result.project.constructions[0].walls).toEqual(withPartitionDocument.walls);
    expect(result.project.constructions[0].rooms).toEqual(withPartitionDocument.rooms);
  });

  it("does not erase a neighbouring room wall from the opened room", () => {
    const project = createStarterProject("p", "P", "en");
    const base = project.constructions[0]; const divided = createConstructionDocument(base.id, [...base.walls, { id: "partition", start: { x: 0, y: -11 }, end: { x: 0, y: 11 }, thickness: .2, role: "partition" }], identity);
    const network = buildWallNetwork(divided.walls); const leftFace = network.faces.find(({ outer }) => outer.some(({ x }) => x < 0))!; const leftRoom = divided.rooms.find(({ faceId }) => faceId === leftFace.id)!;
    const withRoom = { ...project, constructions: [divided], places: [...project.places.filter(({ kind }) => kind !== "room"), { id: leftRoom.id, parentId: "p:level", name: leftRoom.name, kind: "room" as const, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "polygon" as const, points: leftFace.outer }, tags: [], access: [], properties: {} }] };
    const result = eraseCurrentLayer(withRoom, { activePlaceId: leftRoom.id, layerId: "construction", points: [{ x: 16, y: -2 }, { x: 16, y: 2 }], radius: .4, boundaryEditing: true }, identity);
    expect(result.state).toBe("nothing"); expect(result.project.constructions[0].walls).toHaveLength(divided.walls.length);
  });

  it("erases doors, windows and stairs with the same forgiving stroke", () => {
    const project = createStarterProject("p", "P", "en"); const document = project.constructions[0];
    const withFeatures = { ...project, constructions: [{ ...document, openings: [{ id: "door", kind: "door" as const, wallId: document.walls[0].id, position: .5, width: 1.2 }], transitions: [{ id: "stairs", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 5, y: 2, width: 3, height: 4 } }] }] };
    const door = eraseCurrentLayer(withFeatures, { activePlaceId: "p:level", layerId: "openings", points: [{ x: 0, y: -13 }, { x: 0, y: -9 }], radius: 1, boundaryEditing: false }, identity);
    expect(door.state).toBe("erased");
    expect(door.project.constructions[0].openings).toHaveLength(0);
    const stairs = eraseCurrentLayer(door.project, { activePlaceId: "p:level", layerId: "openings", points: [{ x: 2, y: 4 }, { x: 10, y: 4 }], radius: 1, boundaryEditing: false }, identity);
    expect(stairs.state).toBe("erased");
    expect(stairs.project.constructions[0].transitions).toHaveLength(0);
  });
});
