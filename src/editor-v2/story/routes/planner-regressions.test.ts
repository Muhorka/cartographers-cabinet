import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject } from "../../model/project-model";
import { findStoryRoutes } from "./planner";

const wall = (
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  role: CanonicalWall["role"] = "boundary",
): CanonicalWall => ({ id, start, end, role, thickness: 0.2 });

function branchingInteriorProject() {
  const walls = [
    wall("south", { x: 0, y: 0 }, { x: 15, y: 0 }),
    wall("east", { x: 15, y: 0 }, { x: 15, y: 10 }),
    wall("north", { x: 15, y: 10 }, { x: 0, y: 10 }),
    wall("west", { x: 0, y: 10 }, { x: 0, y: 0 }),
    wall("first-partition", { x: 5, y: 0 }, { x: 5, y: 10 }, "partition"),
    wall("second-partition", { x: 10, y: 0 }, { x: 10, y: 10 }, "partition"),
  ];
  let roomNumber = 0;
  const document = createConstructionDocument("construction", walls, {
    createId: () => `room-${roomNumber++}`,
    createName: (index) => `Room ${index}`,
  });
  document.openings = [
    { id: "common-door", kind: "door", wallId: "first-partition", position: 0.5, width: 1 },
    { id: "upper-door", kind: "door", wallId: "second-partition", position: 0.2, width: 1 },
    { id: "middle-door", kind: "door", wallId: "second-partition", position: 0.5, width: 1 },
    { id: "lower-door", kind: "door", wallId: "second-partition", position: 0.8, width: 1 },
  ];
  const project = emptyProject("branching", "Branching interior");
  project.places.push({ id: "level", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} });
  project.constructions.push(document);
  return project;
}

function buildingWithTwoEntries() {
  const walls = [
    wall("south", { x: 0, y: 0 }, { x: 10, y: 0 }),
    wall("east", { x: 10, y: 0 }, { x: 10, y: 10 }),
    wall("north", { x: 10, y: 10 }, { x: 0, y: 10 }),
    wall("west", { x: 0, y: 10 }, { x: 0, y: 0 }),
  ];
  let roomNumber = 0;
  const document = createConstructionDocument("construction", walls, {
    createId: () => `room-${roomNumber++}`,
    createName: (index) => `Room ${index}`,
  });
  document.openings = [
    { id: "far-entry", kind: "door", wallId: "west", position: 0.2, width: 1 },
    { id: "near-entry", kind: "door", wallId: "west", position: 0.8, width: 1 },
  ];
  const project = emptyProject("entries", "Two entries");
  project.places.push(
    { id: "grounds", name: "Grounds", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -20, y: -20, width: 50, height: 50 }, tags: [], access: [], properties: {} },
    { id: "building", parentId: "grounds", name: "House", kind: "building", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, tags: [], access: [], properties: {} },
    { id: "level", parentId: "building", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} },
  );
  project.constructions.push(document);
  return project;
}

describe("story route planner regressions", () => {
  it("does not report missing facts from an unused locked door on a ready route", () => {
    const project = branchingInteriorProject();
    project.story.objects.push({
      ref: { kind: "opening", id: "upper-door", scopeId: "construction" },
      metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "closed", lock: "locked", keyIds: ["missing-key"], guardIds: [], secretKnowledge: [] } },
    }, {
      ref: { kind: "opening", id: "middle-door", scopeId: "construction" },
      metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "closed", lock: "sealed", keyIds: [], guardIds: [], secretKnowledge: [] } },
    });

    const result = findStoryRoutes(project, {
      from: { placeId: "level", point: { x: 2, y: 5 } },
      to: { placeId: "level", point: { x: 13, y: 5 } },
    });

    expect(result.status).toBe("ready");
    expect(result.route?.usedOpeningIds).toEqual(["common-door", "lower-door"]);
    expect(result.missingFacts).toEqual([]);
    expect(result.reasons).toEqual([]);
  });

  it("keeps alternatives that share their first portal", () => {
    const result = findStoryRoutes(branchingInteriorProject(), {
      from: { placeId: "level", point: { x: 2, y: 5 } },
      to: { placeId: "level", point: { x: 13, y: 5 } },
    });

    expect(result.status).toBe("ready");
    expect(result.routes).toHaveLength(3);
    expect(result.routes.every(({ usedOpeningIds }) => usedOpeningIds.includes("common-door"))).toBe(true);
    expect(result.routes.map(({ usedOpeningIds }) => usedOpeningIds.find((id) => id !== "common-door")).toSorted()).toEqual(["lower-door", "middle-door", "upper-door"]);
  });

  it("chooses the shortest building entry instead of the first viable opening", () => {
    const result = findStoryRoutes(buildingWithTwoEntries(), {
      from: { placeId: "grounds", point: { x: -10, y: 2 } },
      to: { placeId: "level", point: { x: 2, y: 2 } },
    });

    expect(result.status).toBe("ready");
    expect(result.route?.usedOpeningIds).toEqual(["near-entry"]);
  });
});
