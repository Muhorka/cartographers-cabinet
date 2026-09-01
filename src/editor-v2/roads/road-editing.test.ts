import { describe, expect, it } from "vitest";
import { ribbonEdges, ribbonShape } from "../geometry/ribbon-geometry";
import { pointInRegion, regionArea } from "../geometry/region-constraints";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { createPlace, changeElementOwnership } from "../model/hierarchy-operations";
import { moveSelection } from "../drawing/selection-operations";
import { transformSelectedElements } from "../drawing/element-transformations";
import { EditorSession } from "../state/editor-session";
import { reshapeRoad } from "./road-editing";
import { roadFitsBuildings } from "./road-routing";
import { buildRoadEdit, roadEditingHandles } from "../webmcp/agent-road-command";

const identity = { createId: () => crypto.randomUUID(), createRoomName: (i: number) => `Room ${i}` };
const road: DrawingElement = { id: "road", belongsToId: "world", name: "Road", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], closed: false }, widthMeters: 4, visible: true, locked: false, tags: [], access: [], properties: {} };
function fixture() {
  const project = createPlace(emptyProject("test", "Test"), { id: "world", name: "World", kind: "world" });
  return { ...project, elements: [structuredClone(road)] };
}
describe("road handles and canonical history", () => {
  it("uses an actual middle edge handle on a two-anchor road", () => {
    const edges = ribbonEdges(road); expect(edges).toHaveLength(3);
    expect(edges[1].t).toBe(.5);
    const changed = reshapeRoad(road, 1, 1, { x: 50, y: 10 })!;
    expect(changed.widthProfile).toEqual([{ t: .5, left: 10, right: 2 }]);
    const shape = ribbonShape(changed)!;
    expect(pointInRegion({ x: 50, y: 9 }, shape)).toBe(true);
    expect(pointInRegion({ x: 0, y: 9 }, shape)).toBe(false);
    expect(pointInRegion({ x: 50, y: -3 }, shape)).toBe(false);
    expect(regionArea(shape)).toBeCloseTo(800);
  });
  it("shares numeric and edge editing with the agent, undo and redo", () => {
    const project = fixture(); const handles = roadEditingHandles(project, "road");
    const middle = handles.edges.find((handle) => handle.channel === 1 && handle.t === .5)!;
    const change = buildRoadEdit(project, { id: "road", channel: middle.channel, index: middle.index, point: { x: 50, y: 8 } });
    const session = new EditorSession(project, { initialPlaceId: "world" });
    expect(session.executeTransaction({ id: "width", apply: () => change.project }).changed).toBe(true);
    expect(session.getState().project.elements[0].widthProfile?.[0].left).toBe(8);
    session.undo(); expect(session.getState().project.elements[0].widthProfile).toBeUndefined();
    session.redo(); expect(session.getState().project.elements[0].widthProfile?.[0].left).toBe(8);
  });
  it("reroutes when a building moves onto a road in the same history entry", () => {
    const project = createPlace(fixture(), { id: "house", parentId: "world", name: "House", kind: "building", boundary: { kind: "rectangle", x: -5, y: -5, width: 10, height: 10 }, transform: { x: 50, y: 30, rotation: 0 } });
    const session = new EditorSession(project);
    const moved = { ...project, places: project.places.map((place) => place.id === "house" ? { ...place, transform: { ...place.transform, y: 0 } } : place) };
    expect(session.executeTransaction({ id: "move-building", apply: () => moved }).changed).toBe(true);
    const current = session.getState().project;
    expect(roadFitsBuildings(current, current.elements[0])).toBe(true);
    expect(current.elements[0].geometry).not.toEqual(road.geometry);
    session.undo(); expect(session.getState().project.elements[0].geometry).toEqual(road.geometry);
    expect(session.getState().project.places.find(({ id }) => id === "house")?.transform.y).toBe(30);
  });
  it("never reroutes a locked road or silently commits an impossible crossing", () => {
    const project = fixture(); project.elements[0].locked = true; const session = new EditorSession(project);
    const crossing = createPlace(project, { id: "house", parentId: "world", name: "House", kind: "building", boundary: { kind: "rectangle", x: 40, y: -5, width: 10, height: 10 } });
    expect(session.executeTransaction({ id: "house", apply: () => crossing }).code).toBe("road-obstacle");
    expect(session.getState().project.places).toHaveLength(1);
    expect(session.getHistoryState().canUndo).toBe(false);
  });
  it("keeps metadata-only edits on an existing malformed road without rerouting", () => {
    const malformed = { ...road, geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }], closed: false } };
    const project = { ...fixture(), elements: [malformed] };
    const session = new EditorSession(project);
    const result = session.executeTransaction({ id: "rename-road", apply: (current) => ({ ...current, elements: current.elements.map((element) => element.id === road.id ? { ...element, name: "Renamed" } : element) }) });
    expect(result).toMatchObject({ code: "committed", changed: true });
    expect(session.getState().project.elements[0]?.name).toBe("Renamed");
    expect(session.getState().project.elements[0]?.geometry).toEqual(malformed.geometry);
  });
  it("still validates a real geometry change after a metadata-only edit", () => {
    const malformed = { ...road, locked: true, geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }], closed: false } };
    const withBuilding = createPlace({ ...fixture(), elements: [malformed] }, { id: "house", parentId: "world", name: "House", kind: "building", boundary: { kind: "rectangle", x: 40, y: -5, width: 10, height: 10 } });
    const session = new EditorSession(withBuilding);
    expect(session.executeTransaction({ id: "rename-road", apply: (current) => ({ ...current, elements: current.elements.map((element) => ({ ...element, name: "Renamed" })) }) }).changed).toBe(true);
    const geometryChange = { ...session.getState().project, elements: session.getState().project.elements.map((element) => ({ ...element, geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], closed: false } })) };
    expect(session.executeTransaction({ id: "reshape-road", apply: () => geometryChange })).toMatchObject({ code: "road-obstacle", changed: false });
  });
  it("validates a newly added road instead of treating it as unchanged", () => {
    const project = createPlace(fixture(), { id: "house", parentId: "world", name: "House", kind: "building", boundary: { kind: "rectangle", x: 40, y: -5, width: 10, height: 10 } });
    const invalidRoad = { ...road, id: "new-road", geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }], closed: false } };
    const session = new EditorSession(project);
    const result = session.executeTransaction({ id: "add-road", apply: (current) => ({ ...current, elements: [...current.elements, invalidRoad] }) });
    expect(result).toMatchObject({ code: "road-obstacle", changed: false });
    expect(session.getState().project.elements.map(({ id }) => id)).toEqual(["road"]);
  });
  it("rechecks an existing road when a bridge becomes a building", () => {
    const project = createPlace(fixture(), { id: "bridge", parentId: "world", name: "Bridge", kind: "building", boundary: { kind: "rectangle", x: 40, y: -5, width: 10, height: 10 } });
    project.places.find(({ id }) => id === "bridge")!.properties.semanticType = "bridge";
    const session = new EditorSession(project);
    expect(roadFitsBuildings(project, project.elements[0])).toBe(true);
    const changed = { ...project, places: project.places.map((place) => place.id === "bridge" ? { ...place, properties: { semanticType: "building" } } : place) };
    expect(session.executeTransaction({ id: "bridge-to-building", apply: () => changed }).changed).toBe(true);
    const current = session.getState().project;
    expect(current.elements[0].geometry).not.toEqual(project.elements[0].geometry);
    expect(roadFitsBuildings(current, current.elements[0])).toBe(true);
  });
  it("moves, mirrors and reparents erased areas together with the road", () => {
    const project = fixture(); project.elements[0].ribbonCutouts = [{ kind: "rectangle", x: 40, y: -5, width: 5, height: 10 }];
    const moved = moveSelection(project, { activePlaceId: "world", selection: { kind: "element", id: "road" }, delta: { x: 10, y: 0 }, boundaryEditing: false }, identity);
    expect(moved.state).toBe("applied");
    expect(pointInRegion({ x: 52, y: 0 }, ribbonShape(moved.project.elements[0])!)).toBe(false);
    const mirrored = transformSelectedElements(project, ["road"], { kind: "mirror", axis: "horizontal" });
    expect(pointInRegion({ x: 58, y: 0 }, ribbonShape(mirrored.project.elements[0])!)).toBe(false);
    const container = createPlace(project, { id: "location", parentId: "world", name: "Location", kind: "location", transform: { x: 10, y: 0, rotation: 0 } });
    const reparented = changeElementOwnership(container, "road", "location");
    expect(pointInRegion({ x: 32, y: 0 }, ribbonShape(reparented.elements[0])!)).toBe(false);
  });
});
