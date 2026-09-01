import { createConstructionDocument } from "../../construction/construction-document";
import type { CanonicalWall } from "../../geometry/geometry-types";
import { emptyProject } from "../../model/project-model";
import { defaultStoryAccessPolicy } from "../types";

export function reviewFixture() {
  const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "boundary"): CanonicalWall => ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, role, thickness: .2 });
  let number = 0;
  const document = createConstructionDocument("construction", [wall("s", 0, 0, 20, 0), wall("e", 20, 0, 20, 10), wall("n", 20, 10, 0, 10), wall("w", 0, 10, 0, 0), wall("partition", 10, 0, 10, 10, "partition")], { createId: () => `room-${number++}`, createName: (index) => `Room ${index}` });
  document.openings = [{ id: "door", kind: "door", wallId: "partition", position: .5, width: 1.2 }];
  const project = emptyProject("scene-review", "Synthetic review");
  project.places.push({ id: "level", name: "Hall level", kind: "level", constructionId: document.id, transform: { x: 0, y: 0, rotation: 0 }, access: [], tags: [], properties: {} });
  project.constructions.push(document);
  project.story.world = [{ id: "alice", kind: "character", name: "Alice", tags: [], properties: {} }, { id: "staff", kind: "access-group", name: "Staff", tags: [], properties: {} }, { id: "brass", kind: "key", name: "Brass key", tags: [], properties: {} }];
  project.story.intentions = [
    { id: "reach", subject: { kind: "place", id: "level" }, target: { kind: "place", id: "level" }, kind: "reachability", text: "Reach the east room", status: "accepted" },
    { id: "pass", subject: { kind: "place", id: "level" }, kind: "must-pass", through: [{ kind: "opening", id: "door", scopeId: document.id }], text: "The route passes through the door", status: "draft" },
    { id: "access", subject: { kind: "opening", id: "door", scopeId: document.id }, kind: "access-rule", text: "Alice may enter", status: "accepted", accessEntryId: "alice" },
  ];
  return project;
}

export const reviewQuery = { from: { placeId: "level", point: { x: 2, y: 5 } }, to: { placeId: "level", point: { x: 18, y: 5 } } };
export const closedDoorAccess = { ...defaultStoryAccessPolicy(), physicalState: "closed" as const, lock: "locked" as const, keyIds: ["brass"] };
