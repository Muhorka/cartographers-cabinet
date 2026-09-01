import { describe, expect, it } from "vitest";
import type { DrawingElement, EditorProject } from "../model/project-model";
import { emptyProject } from "../model/project-model";
import { joinRoads, roadJoinNoticeKey, type RoadJoinBlockedReason } from "./road-joining";
import { reconcileRoadRoutes } from "./road-transaction";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";

const identity = { createId: (() => { let index = 0; return () => `junction-${++index}`; })() };

function projectWithRoads(roads: DrawingElement[]): EditorProject {
  const project = emptyProject("roads", "Roads"); project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }]; project.elements = roads; return project;
}

function pathRoad(id: string, points: { x: number; y: number }[], overrides: Partial<DrawingElement> = {}): DrawingElement {
  return { id, belongsToId: "world", name: id, layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points, closed: false }, visible: true, locked: false, tags: [], access: [], properties: {}, ...overrides };
}

describe("road joining", () => {
  it("maps every join rejection to a dedicated user-facing reason", () => {
    const reasons: RoadJoinBlockedReason[] = ["locked", "not-found", "different-owner", "too-far", "unsupported", "already-joined", "routing"];
    expect(reasons.map(roadJoinNoticeKey)).toEqual(["locked-outline", "road-not-found", "road-different-owner", "road-too-far", "road-unsupported", "road-already-joined", "road-routing"]);
  });

  it("joins close endpoints into one editable path and keeps local metadata", () => {
    const first = pathRoad("first", [{ x: 0, y: 0 }, { x: 5, y: 0 }], { widthMeters: 4, widthProfile: [{ t: 0, left: 2, right: 3 }, { t: 1, left: 3, right: 4 }], ribbonCutouts: [{ kind: "rectangle", x: 1, y: -1, width: 1, height: 1 }], tags: ["main"] });
    const second = pathRoad("second", [{ x: 8, y: 0 }, { x: 5.5, y: 0 }], { widthMeters: 6, widthProfile: [{ t: 0, left: 4, right: 5 }, { t: 1, left: 6, right: 7 }], ribbonCutouts: [{ kind: "rectangle", x: 6, y: -1, width: 1, height: 1 }], tags: ["branch"] });
    const project = projectWithRoads([first, second]); const source = structuredClone(project); const result = joinRoads(project, [first.id, second.id], identity, 1);
    expect(result.state).toBe("joined"); if (result.state !== "joined") return;
    expect(result.project.elements).toHaveLength(1); expect(result.project.elements[0]).toMatchObject({ id: "first", tags: ["main", "branch"], geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 8, y: 0 }] } });
    expect(result.project.elements[0]?.widthProfile).toEqual([{ t: 0, left: 2, right: 3 }, { t: (5 - .075) / 7.5, left: 3, right: 4 }, { t: (5 + .075) / 7.5, left: 7, right: 6 }, { t: 1, left: 5, right: 4 }]); expect(result.project.elements[0]?.ribbonCutouts).toHaveLength(2); expect(project).toEqual(source);
  });

  it("joins mixed path and Bezier roads as a Bezier without losing anchors", () => {
    const first = pathRoad("path", [{ x: 0, y: 0 }, { x: 5, y: 0 }]); const second: DrawingElement = { ...pathRoad("curve", [{ x: 5, y: 0 }, { x: 8, y: 2 }]), geometry: { kind: "bezier", closed: false, nodes: [{ anchor: { x: 5, y: 0 }, outHandle: { x: 6, y: 0 } }, { anchor: { x: 8, y: 2 }, inHandle: { x: 7, y: 2 } }] } };
    const result = joinRoads(projectWithRoads([first, second]), [first.id, second.id], identity);
    expect(result.state).toBe("joined"); if (result.state !== "joined") return; const geometry = result.project.elements[0]?.geometry; expect(geometry?.kind).toBe("bezier"); if (geometry?.kind !== "bezier") return; expect(geometry.nodes.map(({ anchor }) => anchor)).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 8, y: 2 }]); expect(geometry.nodes[1]).toMatchObject({ outHandle: { x: 6, y: 0 } }); expect(geometry.nodes[1]).not.toHaveProperty("inHandle");
  });

  it("records an interior crossing as a junction and leaves both roads editable", () => {
    const horizontal = pathRoad("horizontal", [{ x: 0, y: 5 }, { x: 10, y: 5 }]); const vertical = pathRoad("vertical", [{ x: 5, y: 0 }, { x: 5, y: 10 }]); const project = projectWithRoads([horizontal, vertical]); const result = joinRoads(project, [horizontal.id, vertical.id], identity);
    expect(result.state).toBe("junctions-created"); if (result.state !== "junctions-created") return; expect(result.junctions).toHaveLength(1); expect(result.junctions[0]).toMatchObject({ point: { x: 5, y: 5 }, roadIds: ["horizontal", "vertical"] }); expect(result.project.elements).toEqual(project.elements); expect(parseProjectFile(serializeProjectFile(result.project)).project.roadJunctions).toEqual(result.project.roadJunctions);
    expect(joinRoads(result.project, [horizontal.id, vertical.id], identity).state).toBe("blocked");
    const moved = { ...result.project, elements: result.project.elements.map((road) => road.id === "vertical" ? { ...road, geometry: { kind: "path" as const, points: [{ x: 7, y: 0 }, { x: 7, y: 10 }], closed: false } } : road) }; const updated = reconcileRoadRoutes(result.project, moved)!;
    expect(updated.roadJunctions?.[0]?.point).toEqual({ x: 7, y: 5 }); const removed = reconcileRoadRoutes(updated, { ...updated, elements: updated.elements.filter(({ id }) => id !== "vertical") })!; expect(removed.roadJunctions).toEqual([]);
  });

  it("recognizes a crossing at another road's interior anchor", () => {
    const horizontal = pathRoad("horizontal", [{ x: 0, y: 5 }, { x: 10, y: 5 }]); const vertical = pathRoad("vertical", [{ x: 5, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 10 }]); const result = joinRoads(projectWithRoads([horizontal, vertical]), [horizontal.id, vertical.id], identity);
    expect(result.state).toBe("junctions-created"); if (result.state !== "junctions-created") return; expect(result.junctions[0]?.point).toEqual({ x: 5, y: 5 });
  });

  it("records a T-junction when one road ends on another road's body", () => {
    const main = pathRoad("main", [{ x: 0, y: 5 }, { x: 10, y: 5 }]); const branch = pathRoad("branch", [{ x: 5, y: 5 }, { x: 5, y: 10 }]);
    const result = joinRoads(projectWithRoads([main, branch]), [main.id, branch.id], identity);
    expect(result.state).toBe("junctions-created"); if (result.state !== "junctions-created") return; expect(result.junctions[0]?.point).toEqual({ x: 5, y: 5 });
  });

  it("snaps a near-touching endpoint to the other road's interior axis", () => {
    const main = pathRoad("main-near", [{ x: 0, y: 5 }, { x: 10, y: 5 }]); const branch = pathRoad("branch-near", [{ x: 5, y: 5.8 }, { x: 5, y: 10 }]);
    const result = joinRoads(projectWithRoads([main, branch]), [main.id, branch.id], identity);
    expect(result.state).toBe("junctions-created"); if (result.state !== "junctions-created") return; expect(result.junctions[0]?.point).toEqual({ x: 5, y: 5 });
  });

  it("rejects locked, distant and cross-owner roads without mutation", () => {
    const locked = pathRoad("locked", [{ x: 0, y: 0 }, { x: 5, y: 0 }], { locked: true }); const other = pathRoad("other", [{ x: 5, y: 0 }, { x: 10, y: 0 }]); const project = projectWithRoads([locked, other]); const source = structuredClone(project);
    expect(joinRoads(project, [locked.id, other.id], identity)).toMatchObject({ state: "blocked", reason: "locked" }); expect(project).toEqual(source);
    const distant = pathRoad("distant", [{ x: 50, y: 0 }, { x: 60, y: 0 }]); expect(joinRoads(projectWithRoads([other, distant]), [other.id, distant.id], identity, .1)).toMatchObject({ state: "blocked", reason: "too-far" });
    const foreign = { ...other, id: "foreign", belongsToId: "missing" }; expect(joinRoads(projectWithRoads([other, foreign]), [other.id, foreign.id], identity)).toMatchObject({ state: "blocked", reason: "different-owner" });
  });
});
