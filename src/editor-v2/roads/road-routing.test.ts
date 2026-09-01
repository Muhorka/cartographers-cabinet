import { describe, expect, it } from "vitest";
import { applyMapGesture } from "../drawing/map-gesture-command";
import { regionArea } from "../geometry/region-constraints";
import { ribbonShape } from "../geometry/ribbon-geometry";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { roadObstacles } from "./road-obstacles";
import { roadFitsBuildings, routeRoad } from "./road-routing";

const identity = { createId: (() => { let next = 0; return () => `road-${++next}`; })(), createRoomName: (index: number) => `Room ${index}` };
function fixture() {
  let project = emptyProject("roads", "Roads");
  project = createPlace(project, { id: "world", name: "World", kind: "world", boundary: { kind: "rectangle", x: 0, y: 0, width: 180, height: 100 } });
  project = createPlace(project, { id: "estate", parentId: "world", name: "Estate", kind: "location", transform: { x: 12, y: 8, rotation: 18 } });
  project = createPlace(project, { id: "house", parentId: "estate", name: "House", kind: "building", boundary: { kind: "rectangle", x: -12, y: -8, width: 24, height: 16 }, transform: { x: 64, y: 46, rotation: -25 }, properties: { subjectId: "building.house" } });
  project = createPlace(project, { id: "bridge", parentId: "estate", name: "Bridge", kind: "building", boundary: { kind: "rectangle", x: 50, y: 42, width: 18, height: 12 }, transform: { x: 0, y: 0, rotation: 0 }, properties: { subjectId: "building.bridge" } });
  project = createPlace(project, { id: "terrain", parentId: "world", name: "Terrain", kind: "location", boundary: { kind: "rectangle", x: 20, y: 20, width: 20, height: 15 } });
  return project;
}
function road(belongsToId = "world"): DrawingElement { return { id: "route", belongsToId, name: "Route", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 0, y: 72 }, { x: 130, y: 72 }], closed: false }, widthMeters: 10, widthProfile: [{ t: 0, left: 5, right: 5 }, { t: 1, left: 8, right: 6 }], visible: true, locked: false, tags: [], access: [], properties: {} }; }

describe("road routing and ribbon geometry", () => {
  it("routes a wide road around a rotated building, keeping its width clear", () => {
    const project = fixture(); const candidate = road();
    expect(roadObstacles(project, "world")).toHaveLength(1);
    expect(roadFitsBuildings(project, candidate)).toBe(false);
    const routed = routeRoad(project, candidate);
    expect(routed).toBeDefined();
    expect(routed?.geometry.kind).toBe("path");
    expect(routed && roadFitsBuildings(project, routed)).toBe(true);
    expect(routed && routed.geometry.kind === "path" && routed.geometry.points.length).toBeGreaterThan(2);
  });

  it("ignores bridges, terrain and location boundaries when finding road obstacles", () => {
    const project = fixture(); const clearRoad = { ...road(), geometry: { kind: "path" as const, points: [{ x: 0, y: 5 }, { x: 150, y: 5 }], closed: false } };
    expect(roadObstacles(project, "world")).toHaveLength(1);
    expect(roadFitsBuildings(project, clearRoad)).toBe(true);
  });

  it("creates a routed road through the shared map gesture command", () => {
    const project = fixture(); const result = applyMapGesture(project, { activePlaceId: "world", layerId: "roads", subjectId: "road.paved", widthMeters: 10, boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: 0, y: 72 }, { x: 130, y: 72 }] } }, identity, { nameFor: (subjectId, index) => `${subjectId} ${index}`, levelName: () => "Ground" });
    expect(result.state).toBe("applied");
    expect(result.project.elements[0]?.layerId).toBe("roads");
    expect(result.project.elements[0] && ribbonShape(result.project.elements[0]) && regionArea(ribbonShape(result.project.elements[0])!)).toBeGreaterThan(0);
  });
});
