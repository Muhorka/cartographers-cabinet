import { describe, expect, it } from "vitest";
import type { DrawingElement } from "../../model/project-model";
import { emptyProject } from "../../model/project-model";
import { findStoryRoutes } from "./planner";
import type { StoryRouteRequest } from "./types";

const WORLD_ID = "qa:route:world";
const FROM = { x: 8, y: 80 };
const TO = { x: 232, y: 80 };
const ROW_Y = [20, 71, 122] as const;

type Point = { x: number; y: number };
type Rectangle = { x: number; y: number; width: number; height: number };

function barrierRectangle(row: number, column: number): Rectangle {
  return { x: 25 + 25 * column, y: ROW_Y[row]!, width: 18, height: 18 };
}

function segmentIntersectsRectangle(from: Point, to: Point, rectangle: Rectangle) {
  const delta = { x: to.x - from.x, y: to.y - from.y };
  let lower = 0; let upper = 1;
  const edges: Array<[number, number]> = [
    [-delta.x, from.x - rectangle.x],
    [delta.x, rectangle.x + rectangle.width - from.x],
    [-delta.y, from.y - rectangle.y],
    [delta.y, rectangle.y + rectangle.height - from.y],
  ];
  for (const [direction, distance] of edges) {
    if (direction === 0) { if (distance < 0) return false; continue; }
    const ratio = distance / direction;
    if (direction < 0) lower = Math.max(lower, ratio);
    else upper = Math.min(upper, ratio);
    if (lower > upper) return false;
  }
  return true;
}

function barrier(row: number, column: number): DrawingElement {
  return {
    id: `qa:barrier:r${row}:c${column}`,
    belongsToId: WORLD_ID,
    name: `Barrier ${row + 1}.${column + 1}`,
    layerId: "terrain",
    subjectId: "terrain.wall",
    geometry: {
      kind: "region",
      shape: { kind: "rectangle", ...barrierRectangle(row, column) },
    },
    visible: true,
    locked: false,
    tags: ["wall"],
    access: [],
    properties: {},
  };
}

function heavyOutdoorProject() {
  const project = emptyProject("qa-route-outdoor-grid-v1", "QA route outdoor grid");
  project.places.push({
    id: WORLD_ID,
    name: "QA grounds",
    kind: "world",
    transform: { x: 0, y: 0, rotation: 0 },
    boundary: { kind: "rectangle", x: 0, y: 0, width: 240, height: 160 },
    tags: [],
    access: [],
    properties: {},
  });
  project.elements = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 8 }, (_, column) => barrier(row, column)),
  ).flat();
  return project;
}

const request: StoryRouteRequest = {
  from: { placeId: WORLD_ID, point: FROM },
  to: { placeId: WORLD_ID, point: TO },
  profile: "foot",
  width: 0.8,
  preferences: { preferRoads: false, allowOffroad: true },
};

describe("story route planner heavy synthetic fixture", () => {
  it("deterministically routes around a dense outdoor barrier grid", () => {
    const first = findStoryRoutes(heavyOutdoorProject(), request);
    const second = findStoryRoutes(heavyOutdoorProject(), request);

    expect(first.status).toBe("ready");
    expect(first.routes).toHaveLength(1);
    expect(first.route?.segments).toHaveLength(1);
    expect(first.route?.segments[0]?.kind).toBe("outdoor");
    expect(first.route?.points[0]).toEqual(FROM);
    expect(first.route?.points.at(-1)).toEqual(TO);
    expect(first.route?.usedOpeningIds).toEqual([]);
    expect(first.route?.usedTransitionIds).toEqual([]);
    expect(first.route?.distance).toBeGreaterThan(224);
    expect(first.route?.distance).toBeLessThan(260);
    expect(first.route?.points.every(({ x, y }) => x >= 0 && x <= 240 && y >= 0 && y <= 160)).toBe(true);
    const clearance = request.width! / 2;
    const expandedBarriers = Array.from({ length: 3 }, (_, row) => Array.from({ length: 8 }, (_, column) => {
      const rectangle = barrierRectangle(row, column);
      return { x: rectangle.x - clearance, y: rectangle.y - clearance, width: rectangle.width + clearance * 2, height: rectangle.height + clearance * 2 };
    })).flat();
    expect(first.route?.points.slice(1).every((point, index) =>
      expandedBarriers.every((rectangle) => !segmentIntersectsRectangle(first.route!.points[index]!, point, rectangle)),
    )).toBe(true);

    expect(second.status).toBe(first.status);
    expect(second.sourceRevision).toBe(first.sourceRevision);
    expect(second.route?.distance).toBeCloseTo(first.route!.distance, 6);
  }, 45_000);
});
