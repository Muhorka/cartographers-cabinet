import { describe, expect, it } from "vitest";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { pointInRegion } from "../geometry/region-constraints";
import { ribbonShape } from "../geometry/ribbon-geometry";
import { eraseCurrentLayer } from "../drawing/semantic-eraser";
import { applyRoadGesture } from "./road-gesture";
import { eraseRibbon } from "./road-eraser";

const identity = { createId: (() => { let id = 0; return () => `cut-${++id}`; })(), createName: () => "Room" };
const road = (overrides = {}) => ({ id: "road", belongsToId: "map", name: "Road", layerId: "roads" as const, subjectId: "road.paved", geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false }, widthMeters: 6, visible: true, locked: false, tags: [], access: [], properties: {}, ...overrides });

describe("road eraser", () => {
  it("builds a Bézier road for an arc even when nodes were not supplied", () => {
    const result = applyRoadGesture(emptyProject("p", "Project"), { activePlaceId: "map", layerId: "roads", subjectId: "road.paved", boundaryEditing: false, gesture: { instrumentId: "arc", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }] } }, "road-1", "Road");
    expect(result.state).toBe("applied");
    expect(result.project.elements[0]?.geometry).toMatchObject({ kind: "bezier", nodes: expect.any(Array) });
  });

  it("stores the actual eraser field while preserving the axis and profile", () => {
    const source: DrawingElement = road({ widthProfile: [{ t: 0, left: 1, right: 1 }, { t: .5, left: 2, right: 3 }, { t: 1, left: 4, right: 5 }] });
    const pieces = eraseRibbon(source, [{ x: 10, y: -1 }, { x: 10, y: 1 }], .25);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.geometry).toEqual(source.geometry);
    expect(pieces[0]?.widthProfile).toEqual(source.widthProfile);
    expect(pieces[0]?.ribbonCutouts).toHaveLength(1);
    expect(pieces[0]?.ribbonCutouts?.[0]).toMatchObject({ kind: "polygon" });
  });

  it("is reachable through the shared semantic eraser", () => {
    const project = { ...emptyProject("p", "Project"), elements: [road()] };
    const result = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "roads", points: [{ x: 10, y: -1 }, { x: 10, y: 1 }], radius: .25, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased");
    expect(result.project.elements).toHaveLength(1);
    expect(result.project.elements[0]?.ribbonCutouts).toHaveLength(1);
  });

  it("uses the same mask eraser for rivers without changing terrain ownership or profile", () => {
    const river: DrawingElement = { ...road({ id: "river", layerId: "terrain", subjectId: "terrain.river", widthProfile: [{ t: 0, left: 2, right: 2 }, { t: 1, left: 3, right: 3 }] }), belongsToId: "map" };
    const project = { ...emptyProject("p", "Project"), elements: [river] };
    const result = eraseCurrentLayer(project, { activePlaceId: "map", layerId: "terrain", points: [{ x: 10, y: -1 }, { x: 10, y: 1 }], radius: .25, boundaryEditing: false }, identity);
    expect(result.state).toBe("erased"); expect(result.project.elements[0]).toMatchObject({ layerId: "terrain", subjectId: "terrain.river", widthProfile: river.widthProfile }); expect(result.project.elements[0]?.ribbonCutouts).toHaveLength(1);
    expect(eraseRibbon(river, [{ x: 40, y: 40 }], .1)).toEqual([river]);
  });

  it("nibbles only the visible edge and deletes a fully covered band", () => {
    const source = road({ geometry: { kind: "path" as const, points: [{ x: 0, y: 0 }, { x: 2, y: 0 }], closed: false } });
    const nibble = eraseRibbon(source, [{ x: 1, y: 2.9 }], .1);
    expect(nibble).toHaveLength(1);
    expect(nibble[0]?.ribbonCutouts).toHaveLength(1);
    const center = eraseRibbon(source, [{ x: 1, y: 0 }], .1);
    expect(pointInRegion({ x: 1, y: 0 }, ribbonShape(center[0])!)).toBe(false);
    expect(pointInRegion({ x: 1, y: 0 }, ribbonShape(nibble[0])!)).toBe(true);
    expect(eraseRibbon(source, [{ x: 1, y: 0 }], 10)).toEqual([]);
    expect(eraseRibbon(source, [{ x: 40, y: 40 }], .1)).toEqual([source]);
  });
});
