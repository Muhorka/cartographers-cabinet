import { describe, expect, it } from "vitest";
import { createBuildingWithDefaultLevel, createLevelForBuilding, createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { buildingOverlapGroups, mergeBuildingOverlapGroup } from "./building-overlap-operations";

function fixture() {
  let counter = 0; const identity = { createId: () => `id-${++counter}`, createRoomName: (index: number) => `Room ${index}` };
  let project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 80 } });
  project = createBuildingWithDefaultLevel(project, { id: "house", levelId: "house-floor", constructionId: "house-plan", parentId: "map", name: "House", levelName: "Floor", boundary: { kind: "rectangle", x: -10, y: -7, width: 20, height: 14 }, transform: { x: 35, y: 35, rotation: 0 } }, identity);
  project = createBuildingWithDefaultLevel(project, { id: "annex", levelId: "annex-floor", constructionId: "annex-plan", parentId: "map", name: "Annex", levelName: "Floor", boundary: { kind: "rectangle", x: -8, y: -6, width: 16, height: 12 }, transform: { x: 46, y: 35, rotation: 0 } }, identity);
  return { project, identity };
}

describe("deferred building overlap", () => {
  it("finds a real positive-area overlap but does not merge it prematurely", () => {
    const { project } = fixture();
    expect(buildingOverlapGroups(project, "map").map((group) => group.map(({ id }) => id))).toEqual([["house", "annex"]]);
    expect(project.places.filter(({ kind }) => kind === "building")).toHaveLength(2);
  });

  it("merges one-level buildings to one outer outline and retains their equipment", () => {
    const { project, identity } = fixture();
    const chair = { id: "chair", belongsToId: "annex-floor", name: "Chair", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "point" as const, at: { x: 0, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const result = mergeBuildingOverlapGroup({ ...project, elements: [chair] }, ["house", "annex"], "outer-only", identity);
    expect(result.state).toBe("merged"); if (result.state !== "merged") return;
    expect(result.project.places.filter(({ kind }) => kind === "building").map(({ id }) => id)).toEqual(["house"]);
    expect(result.project.places.filter(({ parentId, kind }) => parentId === "house" && kind === "level")).toHaveLength(1);
    expect(result.project.constructions).toHaveLength(1);
    expect(result.project.constructions[0].rooms).toHaveLength(1);
    expect(result.project.elements[0].belongsToId).not.toBe("annex-floor");
  });

  it("can retain the old outlines as internal partitions", () => {
    const { project, identity } = fixture();
    const result = mergeBuildingOverlapGroup(project, ["house", "annex"], "keep-partitions", identity);
    expect(result.state).toBe("merged"); if (result.state !== "merged") return;
    expect(result.project.constructions[0].walls.some(({ role }) => role === "partition")).toBe(true);
    expect(result.project.constructions[0].rooms.length).toBeGreaterThan(1);
  });

  it("pairs and merges corresponding floors without flattening a multi-storey building", () => {
    const prepared = fixture();
    let project = createLevelForBuilding(prepared.project, { id: "house-upper", constructionId: "house-upper-plan", buildingId: "house", name: "Upper floor" }, prepared.identity);
    project = createLevelForBuilding(project, { id: "annex-upper", constructionId: "annex-upper-plan", buildingId: "annex", name: "Upper annex" }, prepared.identity);
    const result = mergeBuildingOverlapGroup(project, ["house", "annex"], "outer-only", prepared.identity);
    expect(result.state).toBe("merged"); if (result.state !== "merged") return;
    const levels = result.project.places.filter(({ parentId, kind }) => parentId === "house" && kind === "level");
    expect(levels.map(({ id }) => id)).toEqual(["house-floor", "house-upper"]);
    expect(result.project.constructions).toHaveLength(2);
    expect(result.project.places.some(({ id }) => id === "annex-upper")).toBe(false);
  });
});
