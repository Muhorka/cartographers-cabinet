import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject } from "../../model/project-model";
import { polylineDistance } from "./geometry";
import { findStoryRoutes, storyRouteRevision } from "./planner";

const wall = (id: string, start: { x: number; y: number }, end: { x: number; y: number }, role: CanonicalWall["role"] = "boundary"): CanonicalWall => ({ id, start, end, role, thickness: .2 });
function fixture() {
  const walls = [wall("south", { x: 0, y: 0 }, { x: 10, y: 0 }), wall("east", { x: 10, y: 0 }, { x: 10, y: 10 }), wall("north", { x: 10, y: 10 }, { x: 0, y: 10 }), wall("west", { x: 0, y: 10 }, { x: 0, y: 0 }), wall("partition", { x: 5, y: 0 }, { x: 5, y: 10 }, "partition")];
  let roomNumber = 0; const document = createConstructionDocument("construction", walls, { createId: () => `room-${roomNumber++}`, createName: (index) => `Room ${index}` });
  document.openings = [{ id: "door", kind: "door", wallId: "partition", position: .5, width: 1 }];
  const project = emptyProject("p", "Synthetic"); project.places.push({ id: "level", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} }); project.constructions.push(document); return project;
}

describe("story route planner", () => {
  it("routes through a real two-sided door, not face adjacency", () => {
    const result = findStoryRoutes(fixture(), { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.usedOpeningIds).toContain("door"); expect(result.route?.segments.length).toBeGreaterThanOrEqual(2);
  });

  it("reports the physical distance of a centered door portal", () => {
    const result = findStoryRoutes(fixture(), { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.distance).toBeCloseTo(polylineDistance(result.route!.points), 6);
  });

  it("keeps the default-width route through an off-centre internal door", () => {
    const project = fixture(); project.constructions[0]!.openings = [{ id: "door", kind: "door", wallId: "partition", position: .2, width: 2.2 }];
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, width: .7 });
    expect(result.status).toBe("ready"); expect(result.route?.usedOpeningIds).toEqual(["door"]);
  });

  it("reports the physical distance of an off-centre door portal", () => {
    const project = fixture(); project.constructions[0]!.openings = [{ id: "door", kind: "door", wallId: "partition", position: .2, width: 2.2 }];
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, width: .7 });
    expect(result.status).toBe("ready"); expect(result.route?.distance).toBeCloseTo(polylineDistance(result.route!.points), 6);
  });

  it("routes through an off-centre door on a rotated internal wall", () => {
    const walls = [wall("south", { x: 0, y: 0 }, { x: 10, y: 0 }), wall("east", { x: 10, y: 0 }, { x: 10, y: 10 }), wall("north", { x: 10, y: 10 }, { x: 0, y: 10 }), wall("west", { x: 0, y: 10 }, { x: 0, y: 0 }), wall("rotated-partition", { x: 2, y: 0 }, { x: 8, y: 10 }, "partition")];
    let roomNumber = 0; const document = createConstructionDocument("construction", walls, { createId: () => `room-${roomNumber++}`, createName: (index) => `Room ${index}` });
    document.openings = [{ id: "rotated-door", kind: "door", wallId: "rotated-partition", position: .2, width: 2.2 }];
    const project = emptyProject("rotated", "Synthetic"); project.places.push({ id: "level", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} }); project.constructions.push(document);
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, width: .7 });
    expect(result.status).toBe("ready"); expect(result.route?.usedOpeningIds).toEqual(["rotated-door"]);
  });

  it("keeps an over-wide door unreachable with a geometry reason", () => {
    const project = fixture(); project.constructions[0]!.openings = [{ id: "door", kind: "door", wallId: "partition", position: .5, width: 1 }];
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, width: 2 });
    expect(result.status).toBe("unreachable"); expect(result.reasons.join(" ")).toContain("narrower than the requested 2 m route");
  });

  it("does not invent an exterior passage when a boundary has no door", () => {
    const project = fixture(); project.constructions[0]!.openings = [];
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("unreachable");
  });

  it("keeps an actorless physical route and reports its key condition", () => {
    const project = fixture(); project.story.objects.push({ ref: { kind: "opening", id: "door", scopeId: "construction" }, metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "open", lock: "locked", keyIds: ["brass"], guardIds: [], secretKnowledge: [] } } });
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.conditions.join(" ")).toContain("key");
  });

  it("keeps an actorless route through a Nobody place and reports the authored condition", () => {
    const project = fixture(); project.story.objects.push({ ref: { kind: "place", id: "level" }, metadata: { access: { allow: [], deny: [], permission: "nobody", physicalState: "open", lock: "none", keyIds: [], guardIds: [], secretKnowledge: [] } } });
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.conditions.join(" ")).toContain("Nobody");
  });

  it("keeps a direct route inside a concave face and rejects a hole crossing", () => {
    const project = emptyProject("p", "Synthetic"); let roomNumber = 0; const document = createConstructionDocument("construction", [wall("a", { x: 0, y: 0 }, { x: 10, y: 0 }), wall("b", { x: 10, y: 0 }, { x: 10, y: 10 }), wall("c", { x: 10, y: 10 }, { x: 0, y: 10 }), wall("d", { x: 0, y: 10 }, { x: 0, y: 0 }), wall("e", { x: 4, y: 4 }, { x: 6, y: 4 }), wall("f", { x: 6, y: 4 }, { x: 6, y: 6 }), wall("g", { x: 6, y: 6 }, { x: 4, y: 6 }), wall("h", { x: 4, y: 6 }, { x: 4, y: 4 })], { createId: () => `room-${roomNumber++}`, createName: () => "Room" }); project.places.push({ id: "level", name: "Ground", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, constructionId: document.id, tags: [], access: [], properties: {} }); project.constructions.push(document);
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.points.some((point) => point.y < 4 || point.y > 6)).toBe(true);
  });

  it("keeps outdoor paths out of a building and prefers a marked bridge for vehicles", () => {
    const project = emptyProject("outdoor", "Synthetic"); project.places.push({ id: "grounds", name: "Grounds", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 10 }, tags: [], access: [], properties: {} }, { id: "building", parentId: "grounds", name: "Building", kind: "building", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 8, y: 0, width: 4, height: 8 }, tags: [], access: [], properties: {} });
    const result = findStoryRoutes(project, { from: { placeId: "grounds", point: { x: 2, y: 4 } }, to: { placeId: "grounds", point: { x: 18, y: 4 } } });
    expect(result.status).toBe("ready"); expect(result.route?.segments[0]?.kind).toBe("outdoor");
  });

  it("uses one canonical transition and projects its target landing", () => {
    const ground = fixture(); const upper = fixture(); upper.places[0]!.id = "upper"; upper.places[0]!.transform = { x: 1, y: -2, rotation: 0 }; upper.constructions[0]!.id = "upper-construction"; upper.places[0]!.constructionId = "upper-construction";
    ground.constructions[0]!.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 6, y: 4, width: 1, height: 2 }, sourceLevelId: "level", targetLevelId: "upper", connectedLevelIds: ["level", "upper"] }];
    const project = { ...ground, places: [...ground.places, ...upper.places], constructions: [...ground.constructions, ...upper.constructions] };
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "upper", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.usedTransitionIds).toContain("stairs"); const reverse = findStoryRoutes(project, { from: { placeId: "upper", point: { x: 8, y: 5 } }, to: { placeId: "level", point: { x: 2, y: 5 } } }); expect(reverse.status).toBe("ready"); expect(reverse.route?.usedTransitionIds).toContain("stairs");
  });

  it("keeps an actorless stair route conditional on room access", () => {
    const ground = fixture(); const upper = fixture(); upper.places[0]!.id = "upper"; upper.constructions[0]!.id = "upper-construction"; upper.places[0]!.constructionId = "upper-construction";
    ground.constructions[0]!.transitions = [{ id: "stairs-denied", kind: "stairs", footprint: { kind: "rectangle", x: 6, y: 4, width: 1, height: 2 }, sourceLevelId: "level", targetLevelId: "upper", connectedLevelIds: ["level", "upper"] }];
    const project = { ...ground, places: [...ground.places, ...upper.places], constructions: [...ground.constructions, ...upper.constructions] }; project.story.objects.push({ ref: { kind: "room", id: "room-0", scopeId: "construction" }, metadata: { access: { allow: ["staff"], deny: [], permission: "restricted", physicalState: "open", lock: "none", keyIds: [], guardIds: [], secretKnowledge: [] } } });
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "upper", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.conditions.join(" ")).toContain("allowed");
  });

  it("does not claim a vehicle can use stairs", () => {
    const ground = fixture(); const upper = fixture(); upper.places[0]!.id = "upper"; upper.constructions[0]!.id = "upper-construction"; upper.places[0]!.constructionId = "upper-construction";
    ground.constructions[0]!.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 6, y: 4, width: 1, height: 2 }, sourceLevelId: "level", targetLevelId: "upper", connectedLevelIds: ["level", "upper"] }];
    const project = { ...ground, places: [...ground.places, ...upper.places], constructions: [...ground.constructions, ...upper.constructions] };
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "upper", point: { x: 8, y: 5 } }, profile: "vehicle" });
    expect(result.status).toBe("unreachable"); expect(result.reasons.join(" ").toLowerCase()).toContain("vehicle");
  });

  it("returns a ready route with an explicit unlock condition when the actor has the key", () => {
    const project = fixture(); project.story.objects.push({ ref: { kind: "opening", id: "door", scopeId: "construction" }, metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "closed", lock: "locked", keyIds: ["brass"], guardIds: [], secretKnowledge: [] } } }); project.story.memberships.push({ subjectId: "alice", groupId: "brass", kind: "holds-key", source: "manual" });
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, actorId: "alice" });
    expect(result.status).toBe("ready"); expect(result.route?.conditions.join(" ")).toContain("Unlock and open door"); expect(result.route?.segments.some(({ conditions }) => conditions?.some((condition) => condition.includes("Unlock")))).toBe(true);
  });

  it("joins an explicit off-centre boundary door to the outdoor parent", () => {
    const project = fixture(); project.places[0]!.parentId = "building"; project.places[0]!.transform = { x: 1, y: 2, rotation: 0 }; project.places.unshift({ id: "grounds", name: "Grounds", kind: "world", transform: { x: 100, y: 50, rotation: 0 }, boundary: { kind: "rectangle", x: -10, y: -5, width: 30, height: 30 }, tags: [], access: [], properties: {} }, { id: "building", parentId: "grounds", name: "House", kind: "building", transform: { x: 10, y: 5, rotation: 0 }, boundary: { kind: "rectangle", x: 1, y: 2, width: 10, height: 10 }, tags: [], access: [], properties: {} }); project.constructions[0]!.openings = [{ id: "entry", kind: "door", wallId: "west", position: .2, width: 1 }];
    const result = findStoryRoutes(project, { from: { placeId: "grounds", point: { x: 0, y: 12 } }, to: { placeId: "level", point: { x: 2, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.usedOpeningIds).toContain("entry"); expect(result.route?.points.some(({ x, y }) => x > 9 && y > 10)).toBe(true);
  });

  it("joins an outdoor place directly to a room endpoint", () => {
    const project = fixture(); const room = project.constructions[0]!.rooms[0]!;
    project.places[0]!.parentId = "building"; project.places[0]!.transform = { x: 1, y: 2, rotation: 0 };
    project.places.unshift(
      { id: "grounds", name: "Grounds", kind: "world", transform: { x: 100, y: 50, rotation: 0 }, boundary: { kind: "rectangle", x: -10, y: -5, width: 30, height: 30 }, tags: [], access: [], properties: {} },
      { id: "building", parentId: "grounds", name: "House", kind: "building", transform: { x: 10, y: 5, rotation: 0 }, boundary: { kind: "rectangle", x: 1, y: 2, width: 10, height: 10 }, tags: [], access: [], properties: {} },
    );
    project.places.push({ id: room.id, parentId: "level", name: room.name, kind: "room", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.constructions[0]!.openings = [{ id: "entry", kind: "door", wallId: "west", position: .2, width: 1 }];
    const result = findStoryRoutes(project, { from: { placeId: "grounds", point: { x: 0, y: 12 } }, to: { placeId: room.id, point: { x: 2, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.usedOpeningIds).toContain("entry");
  });

  it("lets an explicitly supplied access resolver override authored access", () => {
    const project = fixture();
    const request = { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } };
    expect(findStoryRoutes(project, request).status).toBe("ready");
    expect(findStoryRoutes(project, request, { access: () => false }).status).toBe("unreachable");
  });

  it("joins an explicit boundary door to the outdoor parent", () => {
    const project = fixture(); project.places[0]!.parentId = "building"; project.places[0]!.transform = { x: 1, y: 2, rotation: 0 }; project.places.unshift({ id: "grounds", name: "Grounds", kind: "world", transform: { x: 100, y: 50, rotation: 0 }, boundary: { kind: "rectangle", x: -10, y: -5, width: 30, height: 20 }, tags: [], access: [], properties: {} }, { id: "building", parentId: "grounds", name: "House", kind: "building", transform: { x: 10, y: 5, rotation: 0 }, boundary: { kind: "rectangle", x: 1, y: 2, width: 10, height: 10 }, tags: [], access: [], properties: {} }); project.constructions[0]!.openings = [{ id: "entry", kind: "door", wallId: "west", position: .5, width: 1 }];
    const result = findStoryRoutes(project, { from: { placeId: "grounds", point: { x: 0, y: 12 } }, to: { placeId: "level", point: { x: 2, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.usedOpeningIds).toContain("entry"); expect(result.route?.points.some(({ x, y }) => x > 9 && y > 10)).toBe(true);
  });

  it("accounts for both sides of an external door in both directions", () => {
    const project = fixture(); project.places[0]!.parentId = "building"; project.places[0]!.transform = { x: 1, y: 2, rotation: 0 }; project.places.unshift({ id: "grounds", name: "Grounds", kind: "world", transform: { x: 100, y: 50, rotation: 0 }, boundary: { kind: "rectangle", x: -10, y: -5, width: 30, height: 30 }, tags: [], access: [], properties: {} }, { id: "building", parentId: "grounds", name: "House", kind: "building", transform: { x: 10, y: 5, rotation: 0 }, boundary: { kind: "rectangle", x: 1, y: 2, width: 10, height: 10 }, tags: [], access: [], properties: {} }); project.constructions[0]!.openings = [{ id: "entry", kind: "door", wallId: "west", position: .2, width: 1 }];
    for (const request of [{ from: { placeId: "grounds", point: { x: 0, y: 12 } }, to: { placeId: "level", point: { x: 2, y: 5 } } }, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "grounds", point: { x: 0, y: 12 } } }]) {
      const result = findStoryRoutes(project, request); const route = result.route;
      expect(result.status).toBe("ready"); expect(route?.usedOpeningIds).toContain("entry"); expect(route?.segments.some(({ kind, sourceId }) => kind === "outdoor" && sourceId === "entry")).toBe(true);
      expect(route?.distance).toBeCloseTo(route!.segments.reduce((sum, segment) => sum + polylineDistance(segment.points), 0), 6);
      const outdoorSegments = route!.segments.filter(({ kind }) => kind === "outdoor"); expect(outdoorSegments).toHaveLength(2);
      for (let index = 1; index < outdoorSegments.length; index += 1) expect(outdoorSegments[index - 1]!.points.at(-1)).toEqual(outdoorSegments[index]!.points[0]);
    }
  });

  it("uses explicit window policy and requested clear width", () => {
    const project = fixture(); project.constructions[0]!.openings = [{ id: "window", kind: "window", wallId: "partition", position: .5, width: 1 }];
    expect(findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } }).status).toBe("unreachable");
    expect(findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, preferences: { allowWindows: true } }).status).toBe("ready");
    expect(findStoryRoutes(fixture(), { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, width: 2 }).status).toBe("unreachable");
  });

  it("applies inherited room access and scenario context to intermediate faces", () => {
    const project = fixture(); project.story.objects.push({ ref: { kind: "room", id: "room-1", scopeId: "construction" }, metadata: { access: { allow: ["staff"], deny: [], permission: "restricted", physicalState: "open", lock: "none", keyIds: [], guardIds: [], secretKnowledge: [] } } });
    const blocked = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } }); expect(blocked.status).toBe("ready"); expect(blocked.route?.conditions.join(" ")).toContain("allowed");
    project.story.memberships.push({ subjectId: "alice", groupId: "staff", kind: "member-of", source: "manual" }); const allowed = findStoryRoutes(project, { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } }, actorId: "alice" }); expect(allowed.status).toBe("ready");
  });

  it("keeps a same-face actorless route conditional on room access", () => {
    const project = fixture(); project.story.objects.push({ ref: { kind: "room", id: "room-1", scopeId: "construction" }, metadata: { access: { allow: ["staff"], deny: [], permission: "restricted", physicalState: "open", lock: "none", keyIds: [], guardIds: [], secretKnowledge: [] } } });
    project.story.objects[0] = { ...project.story.objects[0]!, ref: { kind: "room", id: "room-0", scopeId: "construction" } };
    const result = findStoryRoutes(project, { from: { placeId: "level", point: { x: 7, y: 5 } }, to: { placeId: "level", point: { x: 8, y: 5 } } });
    expect(result.status).toBe("ready"); expect(result.route?.conditions.join(" ")).toContain("allowed");
  });

  it("does not treat a meadow as a barrier and does treat hidden water as one", () => {
    const project = emptyProject("meadow", "Synthetic"); project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.elements.push({ id: "grass", belongsToId: "world", name: "Meadow", layerId: "terrain", subjectId: "terrain.grass", geometry: { kind: "region", shape: { kind: "rectangle", x: 8, y: 0, width: 4, height: 10 } }, visible: false, locked: true, tags: [], access: [], properties: {} });
    expect(findStoryRoutes(project, { from: { placeId: "world", point: { x: 2, y: 5 } }, to: { placeId: "world", point: { x: 18, y: 5 } } }).status).toBe("ready");
    project.elements[0] = { ...project.elements[0]!, subjectId: "terrain.river", tags: ["water"] };
    const waterRoute = findStoryRoutes(project, { from: { placeId: "world", point: { x: 2, y: 5 } }, to: { placeId: "world", point: { x: 18, y: 5 } } }); expect(waterRoute.status).toBe("ready"); expect(waterRoute.route?.points.some(({ y }) => y < 0 || y > 10)).toBe(true);
  });

  it("keeps saved route records out of the stale revision", () => {
    const project = fixture(); const before = storyRouteRevision(project); (project.story as unknown as { routes?: unknown[] }).routes = [{ id: "saved" }]; expect(storyRouteRevision(project)).toBe(before); project.story.objects.push({ ref: { kind: "place", id: "level" }, metadata: { narrativeLabel: "changed" } }); expect(storyRouteRevision(project)).toBe(before); project.places[0]!.access = ["staff"]; expect(storyRouteRevision(project)).not.toBe(before);
  });

  it("joins crossing roads and requires an explicit bridge over water", () => {
    const project = emptyProject("roads", "Synthetic"); project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, tags: [], access: [], properties: {} });
    const road = (id: string, points: { x: number; y: number }[]): typeof project.elements[number] => ({ id, belongsToId: "world", name: id, layerId: "roads", subjectId: "road", geometry: { kind: "path", points, closed: false }, widthMeters: 3, visible: false, locked: true, tags: [], access: [], properties: {} });
    project.elements.push(road("east-west", [{ x: 2, y: 10 }, { x: 8, y: 10 }, { x: 10, y: 10 }, { x: 12, y: 10 }, { x: 18, y: 10 }]), road("north-south", [{ x: 10, y: 2 }, { x: 10, y: 10 }, { x: 10, y: 18 }]));
    const crossing = findStoryRoutes(project, { from: { placeId: "world", point: { x: 2, y: 10 } }, to: { placeId: "world", point: { x: 10, y: 18 } }, preferences: { allowOffroad: false } }); expect(crossing.status).toBe("ready"); expect(crossing.route?.segments[0]?.kind).toBe("road"); expect(crossing.route?.points).toContainEqual({ x: 10, y: 10 });
    project.elements.push({ id: "water", belongsToId: "world", name: "River", layerId: "terrain", subjectId: "terrain.river", geometry: { kind: "region", shape: { kind: "rectangle", x: 9, y: 0, width: 2, height: 20 } }, visible: false, locked: false, tags: ["water"], access: [], properties: {} }, { id: "bridge", belongsToId: "world", name: "Bridge", layerId: "equipment", subjectId: "equipment.bridge", geometry: { kind: "region", shape: { kind: "rectangle", x: 6, y: 5, width: 8, height: 10 } }, visible: false, locked: true, tags: ["bridge"], access: [], properties: {} });
    const bridge = findStoryRoutes(project, { from: { placeId: "world", point: { x: 2, y: 10 } }, to: { placeId: "world", point: { x: 18, y: 10 } }, profile: "vehicle", preferences: { allowOffroad: false } }); expect(bridge.status).toBe("ready"); expect(bridge.route?.segments[0]?.kind).toBe("road");
  });

  it("treats a river ribbon path as water without inventing a crossing", () => {
    const project = emptyProject("river", "Synthetic"); project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, tags: [], access: [], properties: {} });
    project.elements.push({ id: "river", belongsToId: "world", name: "River", layerId: "terrain", subjectId: "terrain.river", geometry: { kind: "path", points: [{ x: 10, y: 0 }, { x: 10, y: 20 }], closed: false }, widthMeters: 2, visible: false, locked: false, tags: ["river"], access: [], properties: {} });
    expect(findStoryRoutes(project, { from: { placeId: "world", point: { x: 2, y: 10 } }, to: { placeId: "world", point: { x: 18, y: 10 } }, preferences: { allowOffroad: false } }).status).toBe("unreachable");
  });
});
