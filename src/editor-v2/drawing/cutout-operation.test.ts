import { describe, expect, it } from "vitest";
import { relativePlaceMatrix, transformRegion } from "../geometry/affine-transform";
import { pointInRegion } from "../geometry/region-constraints";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { addConstructionSurface, addElement, createLevelForBuilding, createPlace } from "../model/hierarchy-operations";
import { cutRegionFromSelection } from "./cutout-operation";
import { movePlaceBoundaryVertex } from "./place-boundary-operations";
import { repairProjectConstructions } from "../model/construction-repair";
import { assessPathConstraint } from "../geometry/path-constraints";

function identity() { let index = 0; return { createId: () => `cut-${++index}`, createRoomName: (room: number) => `Room ${room}` }; }

describe("cutout operation", () => {
  it("cuts an island-shaped void from one terrain object", () => {
    const lake: DrawingElement = { id: "lake", belongsToId: "world", name: "Lake", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "region", shape: { kind: "rectangle", x: 0, y: 0, width: 20, height: 12 } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const project = { ...emptyProject("p", "P"), elements: [lake] };
    const result = cutRegionFromSelection(project, "world", { kind: "element", id: "lake" }, { kind: "circle", cx: 10, cy: 6, radius: 2 }, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const shape = result.project.elements[0].geometry.kind === "region" ? result.project.elements[0].geometry.shape : undefined;
    expect(shape).toMatchObject({ kind: "compound", polygons: [{ holes: [expect.any(Array)] }] });
    expect(pointInRegion({ x: 10, y: 6 }, shape!)).toBe(false);
  });

  it("turns an interior building cut into a courtyard instead of another room", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!;
    const localCut = { kind: "rectangle" as const, x: -2, y: -2, width: 4, height: 4 };
    const cutOnParentMap = transformRegion(relativePlaceMatrix(project, building.parentId!, building.id), localCut);
    const result = cutRegionFromSelection(project, building.parentId!, { kind: "place", id: building.id }, cutOnParentMap, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changedBuilding = result.project.places.find(({ id }) => id === building.id)!; const changedLevel = result.project.places.find(({ id }) => id === level.id)!;
    expect(changedBuilding.boundary?.kind).toBe("compound"); expect(changedLevel.boundary?.kind).toBe("compound");
    expect(pointInRegion({ x: 0, y: 0 }, changedLevel.boundary!)).toBe(false);
    const construction = result.project.constructions.find(({ id }) => id === level.constructionId)!;
    const network = buildWallNetwork(construction.walls);
    expect(construction.rooms).toHaveLength(1);
    expect(construction.walls.filter(({ role }) => role === "boundary")).toHaveLength(8);
    expect(network.faces.filter((face) => construction.rooms.some(({ faceId }) => faceId === face.id)).some((face) => pointInRegion({ x: 0, y: 0 }, { kind: "compound", polygons: [{ outer: face.outer, holes: face.holes }] }))).toBe(false);
  });

  it("cuts only the edited level while the other floors keep their own outline", () => {
    let project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const ground = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!;
    project = createLevelForBuilding(project, { id: "upper", constructionId: "upper-plan", buildingId: building.id, name: "Upper floor" }, identity());
    const result = cutRegionFromSelection(project, ground.id, { kind: "place", id: ground.id }, { kind: "rectangle", x: -2, y: -2, width: 4, height: 4 }, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changedGround = result.project.places.find(({ id }) => id === ground.id)!; const upper = result.project.places.find(({ id }) => id === "upper")!;
    expect(pointInRegion({ x: 0, y: 0 }, changedGround.boundary!)).toBe(false);
    expect(pointInRegion({ x: 0, y: 0 }, upper.boundary!)).toBe(true);
  });

  it("keeps a courtyard empty after rebuilding the edited level boundary", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!;
    const cutOnParentMap = transformRegion(relativePlaceMatrix(project, building.parentId!, building.id), { kind: "rectangle", x: -2, y: -2, width: 4, height: 4 });
    const cut = cutRegionFromSelection(project, building.parentId!, { kind: "place", id: building.id }, cutOnParentMap, identity());
    expect(cut.state).toBe("applied"); if (cut.state !== "applied") return;
    const changed = cut.project.places.find(({ id }) => id === level.id)!; const outer = changed.boundary?.kind === "compound" ? changed.boundary.polygons[0].outer : [];
    const rebuilt = movePlaceBoundaryVertex(cut.project, level.id, 0, 1, { x: outer[1].x + 0.5, y: outer[1].y });
    expect(rebuilt.state).toBe("applied"); if (rebuilt.state !== "applied") return;
    const construction = rebuilt.project.constructions.find(({ id }) => id === level.constructionId)!;
    expect(construction.rooms).toHaveLength(1);
    expect(pointInRegion({ x: 0, y: 0 }, rebuilt.project.places.find(({ id }) => id === level.id)!.boundary!)).toBe(false);
  });

  it("keeps the courtyard empty through the session construction repair pass", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!;
    const cutOnParentMap = transformRegion(relativePlaceMatrix(project, building.parentId!, building.id), { kind: "rectangle", x: -2, y: -2, width: 4, height: 4 });
    const cut = cutRegionFromSelection(project, building.parentId!, { kind: "place", id: building.id }, cutOnParentMap, identity());
    expect(cut.state).toBe("applied"); if (cut.state !== "applied") return;
    const repaired = repairProjectConstructions(cut.project, { ...identity(), createName: (index) => `Room ${index}` }); const level = repaired.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!;
    expect(repaired.constructions.find(({ id }) => id === level.constructionId)?.rooms).toHaveLength(1);
    expect(pointInRegion({ x: 0, y: 0 }, level.boundary!)).toBe(false);
  });

  it("clips a floor-edge notch and rebuilds only the resulting enclosure walls", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!;
    const cutOnParentMap = transformRegion(relativePlaceMatrix(project, building.parentId!, building.id), { kind: "rectangle", x: 12, y: -3, width: 10, height: 6 });
    const result = cutRegionFromSelection(project, building.parentId!, { kind: "place", id: level.id }, cutOnParentMap, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changed = result.project.places.find(({ id }) => id === level.id)!; const construction = result.project.constructions.find(({ id }) => id === changed.constructionId)!;
    expect(pointInRegion({ x: 15, y: 0 }, changed.boundary!)).toBe(false);
    expect(pointInRegion({ x: 0, y: 0 }, changed.boundary!)).toBe(true);
    expect(construction.walls.every(({ start, end }) => assessPathConstraint([start, end], changed.boundary).state !== "outside")).toBe(true);
    expect(construction.walls.some(({ start, end }) => start.x > 16 || end.x > 16)).toBe(false);
  });

  it("clips a cutter crossing a corner on every region-like target", () => {
    let project = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world", boundary: { kind: "rectangle", x: -20, y: -20, width: 40, height: 40 } });
    project = createPlace(project, { id: "location", parentId: "world", name: "Location", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 } });
    project = addElement(project, { id: "terrain", name: "Terrain", layerId: "terrain", subjectId: "terrain.ground", geometry: { kind: "region", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "world");
    project = addElement(project, { id: "equipment", name: "Equipment", layerId: "equipment", subjectId: "equipment.object", geometry: { kind: "region", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 } }, visible: true, locked: false, tags: [], access: [], properties: {} }, "world");
    project = addConstructionSurface(project, { id: "surface", name: "Terrace", kind: "terrace", shape: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }, "world");
    const cut = { kind: "rectangle" as const, x: 8, y: 8, width: 5, height: 5 };
    for (const target of [{ kind: "element" as const, id: "terrain" }, { kind: "element" as const, id: "equipment" }, { kind: "surface" as const, id: "surface" }, { kind: "place" as const, id: "location" }]) {
      const result = cutRegionFromSelection(project, "world", target, cut, identity()); expect(result.state).toBe("applied"); if (result.state !== "applied") continue;
      const element = target.kind === "element" ? result.project.elements.find(({ id }) => id === target.id) : undefined;
      const shape = element?.geometry.kind === "region" ? element.geometry.shape : target.kind === "surface" ? result.project.surfaces.find(({ id }) => id === target.id)?.shape : result.project.places.find(({ id }) => id === target.id)?.boundary;
      const region = shape;
      expect(region && pointInRegion({ x: 9, y: 9 }, region)).toBe(false); expect(region && pointInRegion({ x: 2, y: 2 }, region)).toBe(true);
    }
  });

  it("applies a boundary-crossing cut independently to floors with different outlines", () => {
    let project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const ground = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!;
    project = createLevelForBuilding(project, { id: "upper", constructionId: "upper-plan", buildingId: building.id, name: "Upper floor" }, identity());
    project = { ...project, places: project.places.map((place) => place.id === "upper" ? { ...place, boundary: { kind: "rectangle", x: -8, y: -6, width: 16, height: 12 } } : place) };
    const cutOnParentMap = transformRegion(relativePlaceMatrix(project, building.parentId!, building.id), { kind: "rectangle", x: 6, y: -10, width: 20, height: 20 });
    const result = cutRegionFromSelection(project, building.parentId!, { kind: "place", id: building.id }, cutOnParentMap, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changedGround = result.project.places.find(({ id }) => id === ground.id)!; const changedUpper = result.project.places.find(({ id }) => id === "upper")!; const changedBuilding = result.project.places.find(({ id }) => id === building.id)!;
    expect(pointInRegion({ x: 10, y: 0 }, changedGround.boundary!)).toBe(false); expect(pointInRegion({ x: 7, y: 0 }, changedUpper.boundary!)).toBe(false); expect(pointInRegion({ x: 0, y: 0 }, changedUpper.boundary!)).toBe(true);
    expect(pointInRegion({ x: -10, y: 0 }, changedBuilding.boundary!)).toBe(true);
  });

  it("blocks a cutter that would remove an entire editable outline", () => {
    const project = createStarterProject("project", "Project", "en"); const level = project.places.find(({ kind }) => kind === "level")!;
    const result = cutRegionFromSelection(project, level.id, { kind: "place", id: level.id }, { kind: "rectangle", x: -100, y: -100, width: 200, height: 200 }, identity());
    expect(result).toMatchObject({ state: "blocked" });
    expect(pointInRegion({ x: 0, y: 0 }, project.places.find(({ id }) => id === level.id)!.boundary!)).toBe(true);
  });

  it("preserves an opening on an untouched exterior wall after an edge notch", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!; const document = project.constructions.find(({ id }) => id === level.constructionId)!;
    const north = document.walls.find(({ role, start, end }) => role === "boundary" && start.y === -11 && end.y === -11)!;
    const withOpening = { ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? { ...candidate, openings: [{ id: "window", kind: "window" as const, wallId: north.id, position: .2, width: 1 }] } : candidate) };
    const cutOnParentMap = transformRegion(relativePlaceMatrix(withOpening, building.parentId!, building.id), { kind: "rectangle", x: 12, y: -3, width: 10, height: 6 });
    const result = cutRegionFromSelection(withOpening, building.parentId!, { kind: "place", id: level.id }, cutOnParentMap, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changed = result.project.constructions.find(({ id }) => id === document.id)!;
    expect(changed.openings).toEqual([{ id: "window", kind: "window", wallId: north.id, position: .2, width: 1 }]);
    expect(changed.walls.find(({ id }) => id === north.id)).toMatchObject({ start: north.start, end: north.end });
  });

  it("preserves an opening on the outer wall when a courtyard hole is rebuilt", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!; const document = project.constructions.find(({ id }) => id === level.constructionId)!;
    const north = document.walls.find(({ role, start, end }) => role === "boundary" && start.y === -11 && end.y === -11)!;
    const withOpening = { ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? { ...candidate, openings: [{ id: "door", kind: "door" as const, wallId: north.id, position: .25, width: 1 }] } : candidate) };
    const cutOnParentMap = transformRegion(relativePlaceMatrix(withOpening, building.parentId!, building.id), { kind: "rectangle", x: -2, y: -2, width: 4, height: 4 });
    const result = cutRegionFromSelection(withOpening, building.parentId!, { kind: "place", id: building.id }, cutOnParentMap, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changedLevel = result.project.places.find(({ id }) => id === level.id)!; const changed = result.project.constructions.find(({ id }) => id === document.id)!;
    expect(changedLevel.boundary?.kind).toBe("compound"); expect(changed.openings).toEqual([{ id: "door", kind: "door", wallId: north.id, position: .25, width: 1 }]);
  });

  it("remaps an opening on a shortened wall by its original absolute point", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ parentId, kind }) => parentId === building.id && kind === "level")!; const document = project.constructions.find(({ id }) => id === level.constructionId)!;
    const east = document.walls.find(({ role, start, end }) => role === "boundary" && start.x === 16 && end.x === 16)!;
    const pointAt = (wall: typeof east, position: number) => ({ x: wall.start.x + (wall.end.x - wall.start.x) * position, y: wall.start.y + (wall.end.y - wall.start.y) * position });
    const preservedPoint = pointAt(east, .2);
    const withOpenings = { ...project, constructions: project.constructions.map((candidate) => candidate.id === document.id ? { ...candidate, openings: [{ id: "kept", kind: "window" as const, wallId: east.id, position: .2, width: 1 }, { id: "cut-away", kind: "window" as const, wallId: east.id, position: .5, width: 1 }] } : candidate) };
    const cutOnParentMap = transformRegion(relativePlaceMatrix(withOpenings, building.parentId!, building.id), { kind: "rectangle", x: 12, y: -3, width: 10, height: 6 });
    const result = cutRegionFromSelection(withOpenings, building.parentId!, { kind: "place", id: level.id }, cutOnParentMap, identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const changed = result.project.constructions.find(({ id }) => id === document.id)!; const opening = changed.openings.find(({ id }) => id === "kept")!; const wall = changed.walls.find(({ id }) => id === opening.wallId)!;
    expect(changed.openings.map(({ id }) => id)).toEqual(["kept"]);
    expect(pointAt(wall, opening.position).x).toBeCloseTo(preservedPoint.x); expect(pointAt(wall, opening.position).y).toBeCloseTo(preservedPoint.y);
    expect(opening.wallId).toMatch(new RegExp(`^${east.id}:outline:`));
  });
});
