import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject } from "../../model/project-model";
import { findStoryRoutes } from "./planner";

const LEVEL_ID = "9110c42a-a042-41f3-98a8-72e7e2cb421b";
const PASSAGE_ID = "6bc5bd8e-a3dd-47e8-b3b7-dfba8a34f1f5";
const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "boundary", thickness = .3): CanonicalWall => ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, role });

function silverLindensGatehouse() {
  const walls = [
    wall("east", 7, 6, 7, -6), wall("south-east", 7, -6, 0, -6), wall("south-west", 0, -6, -7, -6),
    wall("west", -7, -6, -7, 6), wall("north-west", -7, 6, 0, 6), wall("north-east", 0, 6, 7, 6),
    wall("partition", 0, -6, 0, 6, "partition", .22),
  ];
  let room = 0;
  const document = createConstructionDocument("79400f63-69c0-4381-8e00-c99ac5a2d5dd", walls, { createId: () => `gatehouse-room-${room++}`, createName: (index) => index ? "Gate Lodge" : "Gatekeeper's Room" });
  document.openings = [
    { id: "west-door", kind: "door", wallId: "west", position: .5, width: 1.6 },
    { id: PASSAGE_ID, kind: "door", wallId: "partition", position: .5, width: 1.3 },
    { id: "south-west-window", kind: "window", wallId: "south-west", position: .5, width: 1.4 },
    { id: "north-west-window", kind: "window", wallId: "north-west", position: .5, width: 1.4 },
    { id: "south-east-window", kind: "window", wallId: "south-east", position: .5, width: 1.4 },
    { id: "north-east-window", kind: "window", wallId: "north-east", position: .5, width: 1.4 },
    { id: "east-window-a", kind: "window", wallId: "east", position: .75, width: 1.4 },
    { id: "east-window-b", kind: "window", wallId: "east", position: .25, width: 1.4 },
  ];
  const project = emptyProject("silver-lindens-gatehouse", "Residence of the Silver Lindens — East Gatehouse");
  project.places.push({ id: LEVEL_ID, name: "East Gatehouse", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} });
  project.constructions.push(document);
  return project;
}

describe("Silver Lindens gatehouse route regression", () => {
  it("returns one 7 m physical route through the canonical internal opening", () => {
    const result = findStoryRoutes(silverLindensGatehouse(), { from: { placeId: LEVEL_ID, levelId: LEVEL_ID, point: { x: -3.5, y: 0 } }, to: { placeId: LEVEL_ID, levelId: LEVEL_ID, point: { x: 3.5, y: 0 } }, profile: "foot" });
    expect(result.status).toBe("ready"); expect(result.routes).toHaveLength(1); expect(result.route?.distance).toBeCloseTo(7, 6); expect(result.route?.usedOpeningIds).toEqual([PASSAGE_ID]);
  });

  it("calculates additional variants only when explicitly requested", () => {
    const project = silverLindensGatehouse();
    const request = { from: { placeId: LEVEL_ID, point: { x: -3.5, y: 0 } }, to: { placeId: LEVEL_ID, point: { x: 3.5, y: 0 } }, profile: "foot" as const };
    expect(findStoryRoutes(project, request).routes).toHaveLength(1);
    expect(findStoryRoutes(project, { ...request, preferences: { allowWindows: true }, alternativeLimit: 2 }).routes.length).toBeGreaterThanOrEqual(1);
  });
});
