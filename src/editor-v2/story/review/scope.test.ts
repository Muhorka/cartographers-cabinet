import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../../construction/construction-document";
import { constructionNetwork } from "../../construction/construction-network";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject, type EditorProject, type RegionShape } from "../../model/project-model";
import { emptyStoryData, type StoryObjectRef } from "../types";
import { canonicalReviewRef, intentionRefs, intentionsForScope, validateIntentionEndpoints, validateRouteEvidenceGeometry } from "./scope";

const rectangle: RegionShape = { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 };
const shell = [
  { id: "north", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: .2, role: "boundary" as const },
  { id: "east", start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, thickness: .2, role: "boundary" as const },
  { id: "south", start: { x: 10, y: 10 }, end: { x: 0, y: 10 }, thickness: .2, role: "boundary" as const },
  { id: "west", start: { x: 0, y: 10 }, end: { x: 0, y: 0 }, thickness: .2, role: "boundary" as const },
];

function level(id: string, constructionId: string) {
  return { id, name: id, kind: "level" as const, constructionId, transform: { x: 0, y: 0, rotation: 0 }, boundary: rectangle, tags: [], access: [], properties: {} };
}

function construction(id: string, walls: CanonicalWall[] = shell, enclosure: RegionShape | undefined = rectangle) {
  return createConstructionDocument(id, walls, { createId: () => `${id}-room`, createName: () => `${id} room` }, enclosure);
}

function duplicateRoomProject(): { project: EditorProject; first: StoryObjectRef; second: StoryObjectRef } {
  const project = emptyProject("scope", "Synthetic scope");
  const firstConstruction = construction("floor-a");
  const secondConstruction = construction("floor-b");
  firstConstruction.rooms[0]!.id = "same-room";
  secondConstruction.rooms[0]!.id = "same-room";
  project.places.push(level("level-a", firstConstruction.id), level("level-b", secondConstruction.id));
  project.constructions.push(firstConstruction, secondConstruction);
  return { project, first: { kind: "room", id: "same-room", scopeId: "floor-a" }, second: { kind: "room", id: "same-room", scopeId: "floor-b" } };
}

function intention(subject: StoryObjectRef, target?: StoryObjectRef, kind: "reachability" | "must-pass" | "avoid-zone" = "reachability") {
  return { id: `${kind}-${subject.id}-${target?.id ?? "none"}`, subject, target, kind, text: "synthetic", status: "accepted" as const };
}

describe("story intention review scope", () => {
  it("deduplicates canonical subject, target, through, and avoid-zone members", () => {
    const project = emptyProject("scope", "Synthetic scope");
    project.places.push({ id: "yard", name: "Yard", kind: "location", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    const subject = { kind: "place" as const, id: "yard" };
    project.story = { ...emptyStoryData(), zones: [{ id: "zone", name: "Zone", ownerPlaceId: "yard", members: [{ ref: subject, relation: "inside", partial: false }], tags: [] }] };
    const item = { ...intention(subject, undefined, "avoid-zone"), avoidZoneId: "zone" };
    expect(intentionRefs(project, item)).toEqual([subject]);
  });

  it("distinguishes omitted scope from an explicitly empty scope", () => {
    const project = emptyProject("scope", "Synthetic scope");
    project.places.push({ id: "one", name: "One", kind: "location", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.story.intentions.push(intention({ kind: "place", id: "one" }));
    expect(intentionsForScope(project)).toHaveLength(1);
    expect(intentionsForScope(project, [])).toEqual([]);
  });

  it("matches only exact canonical scoped references and does not expand a project scope", () => {
    const { project, first, second } = duplicateRoomProject();
    project.story.intentions.push(intention(first), intention(second));
    expect(intentionsForScope(project, [first])).toHaveLength(1);
    expect(intentionsForScope(project, [{ kind: "room", id: "same-room" }])).toEqual([]);
  });

  it("uses the room face on the requested level and rejects the identical id on another level", () => {
    const { project, first, second } = duplicateRoomProject();
    const item = intention(first, second);
    const query = { from: { placeId: "level-a", point: { x: 2, y: 2 } }, to: { placeId: "level-b", point: { x: 2, y: 2 } } };
    expect(validateIntentionEndpoints(project, item, query)).toEqual({ valid: true });
    expect(validateIntentionEndpoints(project, item, { ...query, from: { placeId: "level-b", point: { x: 2, y: 2 } } })).toEqual({ valid: false, reason: "endpoint-mismatch" });
    expect(validateIntentionEndpoints(project, intention({ kind: "room", id: "same-room" }, second), query)).toEqual({ valid: false, reason: "endpoint-unresolved" });
  });

  it("canonicalizes an explicit owning-level room scope without guessing", () => {
    const { project, first } = duplicateRoomProject();
    const levelScoped = { kind: "room" as const, id: "same-room", scopeId: "level-a" };
    expect(intentionRefs(project, intention(levelScoped))).toEqual([first]);
    expect(validateIntentionEndpoints(project, intention(levelScoped, first), { from: { placeId: "level-a", point: { x: 2, y: 2 } }, to: { placeId: "level-a", point: { x: 8, y: 8 } } })).toEqual({ valid: true });
  });

  it("rejects a point in an adjacent room and a point in a room face hole", () => {
    const partitioned = construction("partitioned", [...shell, { id: "partition", start: { x: 5, y: 0 }, end: { x: 5, y: 10 }, thickness: .2, role: "partition" as const }]);
    const partitionedFaces = constructionNetwork(partitioned.walls, partitioned.enclosure).faces;
    for (const room of partitioned.rooms) {
      const face = partitionedFaces.find(({ id }) => id === room.faceId)!;
      room.id = face.outer.reduce((sum, point) => sum + point.x, 0) / face.outer.length < 5 ? "left" : "right";
    }
    const holeEnclosure: RegionShape = { kind: "compound", polygons: [{ outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], holes: [[{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }]] }] };
    const withHole = construction("hole-floor", [...shell, { id: "hole-north", start: { x: 3, y: 3 }, end: { x: 7, y: 3 }, thickness: .2, role: "boundary" as const }, { id: "hole-east", start: { x: 7, y: 3 }, end: { x: 7, y: 7 }, thickness: .2, role: "boundary" as const }, { id: "hole-south", start: { x: 7, y: 7 }, end: { x: 3, y: 7 }, thickness: .2, role: "boundary" as const }, { id: "hole-west", start: { x: 3, y: 7 }, end: { x: 3, y: 3 }, thickness: .2, role: "boundary" as const }], holeEnclosure);
    withHole.rooms[0]!.id = "hole-room";
    const project = emptyProject("geometry", "Synthetic geometry");
    project.places.push(level("level", partitioned.id), level("hole-level", withHole.id));
    project.constructions.push(partitioned, withHole);
    expect(validateIntentionEndpoints(project, intention({ kind: "room", id: "left", scopeId: "partitioned" }, { kind: "room", id: "right", scopeId: "partitioned" }, "must-pass"), { from: { placeId: "level", point: { x: 8, y: 2 } }, to: { placeId: "level", point: { x: 2, y: 2 } } })).toEqual({ valid: false, reason: "endpoint-mismatch" });
    expect(validateIntentionEndpoints(project, intention({ kind: "room", id: "hole-room", scopeId: "hole-floor" }, undefined, "avoid-zone"), { from: { placeId: "hole-level", point: { x: 5, y: 5 } }, to: { placeId: "hole-level", point: { x: 1, y: 1 } } })).toEqual({ valid: false, reason: "endpoint-mismatch" });
  });

  it("requires a target for reachability and reports unsupported endpoint refs as unresolved", () => {
    const { project, first } = duplicateRoomProject();
    expect(validateIntentionEndpoints(project, intention(first), { from: { placeId: "level-a", point: { x: 1, y: 1 } }, to: { placeId: "level-a", point: { x: 2, y: 2 } } })).toEqual({ valid: false, reason: "target-required" });
    expect(validateIntentionEndpoints(project, intention({ kind: "opening", id: "door", scopeId: "floor-a" }, first), { from: { placeId: "level-a", point: { x: 1, y: 1 } }, to: { placeId: "level-a", point: { x: 2, y: 2 } } })).toEqual({ valid: false, reason: "endpoint-unresolved" });
  });

  it("accepts an untransformed point in a uniquely place-backed room", () => {
    const project = emptyProject("place-room", "Synthetic place room");
    project.places.push(level("level", "unused"), { id: "room", parentId: "level", name: "Room", kind: "room", transform: { x: 100, y: 100, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 4, height: 4 }, tags: [], access: [], properties: {} });
    const room = { kind: "room" as const, id: "room" };
    const item = intention(room, { kind: "place", id: "level" }, "must-pass");
    const query = { from: { placeId: "room", point: { x: 2, y: 2 } }, to: { placeId: "level", point: { x: 2, y: 2 } } };
    expect(validateIntentionEndpoints(project, item, query)).toEqual({ valid: true });
  });

  it("requires authored geometry for outdoor evidence and keeps points inside its boundary", () => {
    const project = emptyProject("outdoor", "Synthetic outdoor");
    project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    const noBoundary = { from: { placeId: "world", point: { x: 1, y: 1 } }, to: { placeId: "world", point: { x: 2, y: 2 } } };
    expect(validateRouteEvidenceGeometry(project, noBoundary)).toEqual({ valid: false, reason: "endpoint-unresolved" });
    project.places[0]!.boundary = rectangle;
    expect(validateRouteEvidenceGeometry(project, { ...noBoundary, to: { placeId: "world", point: { x: 20, y: 2 } } })).toEqual({ valid: false, reason: "endpoint-mismatch" });
    expect(validateRouteEvidenceGeometry(project, noBoundary)).toEqual({ valid: true });
  });

  it("requires a level construction face for both explicit route endpoints", () => {
    const { project } = duplicateRoomProject();
    const valid = { from: { placeId: "level-a", point: { x: 2, y: 2 } }, to: { placeId: "level-a", point: { x: 8, y: 8 } } };
    expect(validateRouteEvidenceGeometry(project, valid)).toEqual({ valid: true });
    expect(validateRouteEvidenceGeometry(project, { ...valid, from: { placeId: "level-a", levelId: "wrong-level", point: { x: 2, y: 2 } } })).toEqual({ valid: false, reason: "endpoint-mismatch" });
    project.places.find(({ id }) => id === "level-a")!.constructionId = "missing";
    expect(validateRouteEvidenceGeometry(project, valid)).toEqual({ valid: false, reason: "endpoint-unresolved" });
  });

  it("does not pretend that room-local or building-local points have a planner frame", () => {
    const project = emptyProject("frames", "Synthetic frames");
    project.places.push({ id: "building", name: "Building", kind: "building", transform: { x: 0, y: 0, rotation: 0 }, boundary: rectangle, tags: [], access: [], properties: {} }, { id: "room", parentId: "building", name: "Room", kind: "standalone-room", transform: { x: 0, y: 0, rotation: 0 }, boundary: rectangle, tags: [], access: [], properties: {} });
    const query = { from: { placeId: "room", point: { x: 2, y: 2 } }, to: { placeId: "building", point: { x: 2, y: 2 } } };
    expect(validateRouteEvidenceGeometry(project, query)).toEqual({ valid: false, reason: "endpoint-unresolved" });
    expect(canonicalReviewRef(project, { kind: "room", id: "room" })).toEqual({ kind: "room", id: "room", scopeId: "place:room" });
  });
});
