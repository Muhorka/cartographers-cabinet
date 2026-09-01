import { describe, expect, it } from "vitest";
import { alignmentDeltas, distributionDeltas, insertBezierNode, insertRegionVertex, joinPaths, planningInsertionTarget, polygonArea, removeRegionVertex, setBezierNodeSmooth, splitPathAt, splitPolygonByLine } from "./planning-geometry";
import { angleBetween, boundsDimensions, distanceBetween, geometryDimensions } from "./planning-measurements";
import { alignPlanningItems, distributePlanningItems, insertGeometryNode, insertGeometryNodeAt, removeGeometryNode, splitPathGeometry, splitPlanningElement, splitRegionGeometry, type PlanningGeometry } from "./planning-operations";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";

describe("planning geometry", () => {
  const items = [{ id: "a", bounds: { minX: 0, minY: 0, maxX: 10, maxY: 4 } }, { id: "b", bounds: { minX: 20, minY: 8, maxX: 25, maxY: 12 } }, { id: "c", bounds: { minX: 40, minY: 2, maxX: 48, maxY: 6 } }];
  it("aligns without changing the perpendicular axis", () => {
    expect(alignmentDeltas(items, "horizontal", "start")).toEqual({ a: { x: 0, y: 0 }, b: { x: -20, y: 0 }, c: { x: -40, y: 0 } });
    expect(alignmentDeltas(items, "vertical", "center").b.y).toBeCloseTo(-4.6667, 3);
  });
  it("distributes centres evenly and leaves the ends anchored", () => {
    const result = distributionDeltas(items, "horizontal");
    expect(result.a).toEqual({ x: 0, y: 0 }); expect(result.c).toEqual({ x: 0, y: 0 }); expect(result.b).toEqual({ x: 2, y: 0 });
  });
  it("applies selection deltas through caller-owned geometry adapters", () => {
    const move = (item: typeof items[number], delta: { x: number; y: number }) => ({ ...item, bounds: { minX: item.bounds.minX + delta.x, minY: item.bounds.minY + delta.y, maxX: item.bounds.maxX + delta.x, maxY: item.bounds.maxY + delta.y } });
    expect(alignPlanningItems(items, "horizontal", "start", move).map(({ bounds }) => bounds.minX)).toEqual([0, 0, 0]);
    expect(distributePlanningItems(items, "horizontal", move)[1].bounds.minX).toBe(22);
    const geometry: PlanningGeometry = { kind: "path", points: [{ x: 0, y: 0 }, { x: 2, y: 0 }], closed: false }; expect(geometry.kind).toBe("path");
  });
  it("measures region dimensions and area", () => {
    expect(geometryDimensions({ kind: "rectangle", x: 2, y: 3, width: 4, height: 6 })).toMatchObject({ width: 4, height: 6, area: 24 });
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5); expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90); expect(boundsDimensions({ minX: 0, minY: 0, maxX: 4, maxY: 6 })).toEqual({ width: 4, height: 6 });
  });
  it("inserts and removes polygon vertices while protecting the ring", () => {
    const square = { kind: "polygon" as const, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
    const inserted = insertRegionVertex(square, { x: 5, y: .1 }); expect(inserted?.kind).toBe("polygon"); if (!inserted || inserted.kind !== "polygon") throw new Error("expected polygon"); expect(inserted.points).toHaveLength(5);
    expect(removeRegionVertex(inserted!, 0, 1)?.kind).toBe("polygon"); expect(removeRegionVertex(square, 0, 0)).toBeDefined();
    expect(insertGeometryNode({ kind: "region", shape: square }, { near: { x: 4, y: 0 } })?.kind).toBe("region"); expect(removeGeometryNode({ kind: "region", shape: inserted! }, 0, 1)?.kind).toBe("region");
  });
  it("changes Bezier node smoothness and inserts a true node", () => {
    const nodes = [{ anchor: { x: 0, y: 0 } }, { anchor: { x: 10, y: 10 } }, { anchor: { x: 20, y: 0 } }];
    const smooth = setBezierNodeSmooth(nodes, 1, true); expect(smooth?.[1].inHandle).toBeDefined(); expect(smooth?.[1].outHandle).toBeDefined();
    expect(setBezierNodeSmooth(smooth!, 1, false)?.[1]).toEqual({ anchor: { x: 10, y: 10 } }); const inserted = insertBezierNode(nodes, 0); expect(inserted).toHaveLength(4); expect(inserted?.[1]).toMatchObject({ anchor: { x: 5, y: 5 }, inHandle: { x: 2.5, y: 2.5 }, outHandle: { x: 7.5, y: 7.5 } }); expect(nodes).toEqual([{ anchor: { x: 0, y: 0 } }, { anchor: { x: 10, y: 10 } }, { anchor: { x: 20, y: 0 } }]);
  });
  it("inserts an open path vertex on the selected segment", () => {
    const path: PlanningGeometry = { kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }], closed: false }; const changed = insertGeometryNode(path, { segmentIndex: 1 });
    expect(changed).toEqual({ kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 5 }, { x: 20, y: 10 }], closed: false }); expect(path).toEqual({ kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }], closed: false });
  });
  it("projects a controlled insertion click and refuses existing anchors", () => {
    const path: PlanningGeometry = { kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }], closed: false }; const target = planningInsertionTarget(path, { x: 6, y: 2 });
    expect(target).toMatchObject({ segmentIndex: 0, point: { x: 6, y: 0 } }); expect(target?.ratio).toBeCloseTo(.6); expect(target?.distance).toBe(2); const insertedPath = insertGeometryNodeAt(path, { x: 6, y: 2 }); expect(insertedPath?.kind === "path" && insertedPath.points[1]).toEqual({ x: 6, y: 0 }); expect(insertedPath?.kind === "path" && insertedPath.points).toHaveLength(4); expect(insertGeometryNodeAt(path, { x: 0, y: 0 })).toBeUndefined();
    const polygon: PlanningGeometry = { kind: "region", shape: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] } }; const polygonTarget = planningInsertionTarget(polygon, { x: 4, y: 1 }); expect(polygonTarget).toMatchObject({ point: { x: 4, y: 0 }, segmentIndex: 0, polygonIndex: 0 }); const insertedPolygon = insertGeometryNodeAt(polygon, { x: 4, y: 1 }); expect(insertedPolygon?.kind === "region" && insertedPolygon.shape.kind === "polygon" && insertedPolygon.shape.points[1]).toEqual({ x: 4, y: 0 }); expect(insertedPolygon?.kind === "region" && insertedPolygon.shape.kind === "polygon" && insertedPolygon.shape.points).toHaveLength(5);
  });
  it("inserts a Bezier node at the clicked curve sample without mutating handles", () => {
    const bezier: PlanningGeometry = { kind: "bezier", closed: false, nodes: [{ anchor: { x: 0, y: 0 }, outHandle: { x: 0, y: 10 } }, { anchor: { x: 10, y: 10 }, inHandle: { x: 10, y: 0 } }] }; const source = structuredClone(bezier); const target = planningInsertionTarget(bezier, { x: 5, y: 5 }); const changed = insertGeometryNodeAt(bezier, { x: 5, y: 5 });
    expect(target?.segmentIndex).toBe(0); expect(target?.ratio).toBeCloseTo(.5); expect(target?.distance).toBeCloseTo(0); expect(changed?.kind === "bezier" && changed.nodes).toHaveLength(3); expect(changed?.kind === "bezier" && changed.nodes[1]).toMatchObject({ anchor: { x: 5, y: 5 }, inHandle: { x: 2.5, y: 5 }, outHandle: { x: 7.5, y: 5 } }); expect(bezier).toEqual(source);
  });
  it("refines Bezier projection between coarse samples", () => {
    const bezier: PlanningGeometry = { kind: "bezier", closed: false, nodes: [{ anchor: { x: 0, y: 0 }, outHandle: { x: 4, y: 9 } }, { anchor: { x: 14, y: 5 }, inHandle: { x: 9, y: -3 } }] }; const ratio = .37; const inverse = 1 - ratio;
    const near = { x: inverse ** 3 * 0 + 3 * inverse ** 2 * ratio * 4 + 3 * inverse * ratio ** 2 * 9 + ratio ** 3 * 14, y: inverse ** 3 * 0 + 3 * inverse ** 2 * ratio * 9 + 3 * inverse * ratio ** 2 * -3 + ratio ** 3 * 5 }; const target = planningInsertionTarget(bezier, near);
    expect(target?.segmentIndex).toBe(0); expect(target?.ratio).toBeCloseTo(ratio, 5); expect(target?.point.x).toBeCloseTo(near.x, 5); expect(target?.point.y).toBeCloseTo(near.y, 5); expect(target?.distance).toBeCloseTo(0, 5);
  });
  it("splits and joins paths and rejects a non-crossing polygon cut", () => {
    const path = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 }]; const split = splitPathAt(path, 1); expect(split).toHaveLength(2); expect(joinPaths(...split!)).toEqual(path); const splitGeometry = splitPathGeometry({ kind: "path", points: path, closed: false }, 1); expect(splitGeometry?.every(({ kind }) => kind === "path")).toBe(true); expect(splitGeometry?.map((geometry) => geometry.kind === "path" ? geometry.points : [])).toEqual([path.slice(0, 2), path.slice(1)]); expect(splitPathGeometry({ kind: "path", points: path, closed: true }, 1)).toBeUndefined();
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]; const halves = splitPolygonByLine(square, { x: 5, y: -1 }, { x: 5, y: 11 }); expect(halves).toBeDefined(); expect(halves!.every((ring) => polygonArea(ring) > 0)).toBe(true); expect(splitRegionGeometry({ kind: "polygon", points: square }, { x: 5, y: -1 }, { x: 5, y: 11 })).toHaveLength(2); expect(splitPolygonByLine(square, { x: 20, y: 0 }, { x: 20, y: 10 })).toBeUndefined();
  });
  it("splits open Beziers without sharing or losing the split-anchor handles", () => {
    const geometry = { kind: "bezier" as const, closed: false, nodes: [
      { anchor: { x: 0, y: 0 }, outHandle: { x: 2, y: 0 } },
      { anchor: { x: 5, y: 2 }, inHandle: { x: 3, y: 2 }, outHandle: { x: 7, y: 2 } },
      { anchor: { x: 10, y: 0 }, inHandle: { x: 8, y: 0 }, outHandle: { x: 12, y: 0 } },
      { anchor: { x: 15, y: 2 }, inHandle: { x: 13, y: 2 } },
    ]};
    const source = structuredClone(geometry); const pieces = splitPathGeometry(geometry, 1);
    expect(pieces?.[0]).toMatchObject({ kind: "bezier", nodes: [{ outHandle: { x: 2 } }, { inHandle: { x: 3 }, outHandle: undefined }] });
    expect(pieces?.[1]).toMatchObject({ kind: "bezier" }); expect(pieces?.[1]?.kind === "bezier" && pieces[1].nodes[0]).toEqual({ anchor: { x: 5, y: 2 }, inHandle: undefined, outHandle: { x: 7, y: 2 } }); expect(pieces?.[1]?.kind === "bezier" && pieces[1].nodes[1].inHandle).toEqual({ x: 8, y: 0 });
    expect(geometry).toEqual(source);
  });
  it("splits road width stations and cutout masks in one undoable serializable change", () => {
    const project = emptyProject("road-split", "Road split");
    project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }];
    const road: DrawingElement = { id: "road", belongsToId: "world", name: "Road", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {}, widthMeters: 8, widthProfile: [{ t: 0, left: 4, right: 4 }, { t: .5, left: 5, right: 6 }, { t: 1, left: 7, right: 8 }], ribbonCutouts: [{ kind: "rectangle", x: 3, y: -5, width: 5, height: 10 }] };
    project.elements = [road]; const source = structuredClone(project); const pieces = splitPlanningElement(road, 1, () => "road-2", "Road (part 2)");
    expect(pieces).toHaveLength(2); expect(pieces?.[0]?.widthProfile?.[0]).toEqual({ t: 0, left: 4, right: 4 }); expect(pieces?.[0]?.widthProfile?.[1]?.t).toBe(1); expect(pieces?.[0]?.widthProfile?.[1]?.left).toBeCloseTo(14 / 3); expect(pieces?.[0]?.widthProfile?.[1]?.right).toBeCloseTo(16 / 3); expect(pieces?.[1]?.widthProfile?.[0]?.t).toBe(0); expect(pieces?.[1]?.widthProfile?.[0]?.left).toBeCloseTo(14 / 3); expect(pieces?.[1]?.widthProfile?.[0]?.right).toBeCloseTo(16 / 3); expect(pieces?.[1]?.widthProfile?.[1]?.t).toBeCloseTo(.25); expect(pieces?.[1]?.widthProfile?.[1]?.left).toBe(5); expect(pieces?.[1]?.widthProfile?.[1]?.right).toBe(6); expect(pieces?.[1]?.widthProfile?.[2]).toEqual({ t: 1, left: 7, right: 8 }); expect(pieces?.[0]?.ribbonCutouts).toHaveLength(1); expect(pieces?.[1]?.ribbonCutouts).toHaveLength(1); expect(project).toEqual(source);
    const session = new EditorSession(project, { initialPlaceId: "world", createId: () => "road-2" }); const next = { ...project, elements: pieces ?? project.elements }; expect(session.executeTransaction({ id: "planning:split-road", apply: () => next }).changed).toBe(true); expect(session.getState().project.elements).toHaveLength(2); expect(parseProjectFile(serializeProjectFile(session.getState().project)).project).toEqual(session.getState().project); expect(session.undo().changed).toBe(true); expect(session.getState().project).toEqual(project);
  });
});
