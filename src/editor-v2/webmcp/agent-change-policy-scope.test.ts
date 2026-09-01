import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import { emptyProject, type EditorProject } from "../model/project-model";
import { assertAgentLocks } from "./agent-change-policy";

function projectWithAmbiguousRooms(): EditorProject {
  const project = emptyProject("scope-lock", "Synthetic scope lock");
  const walls = [
    { id: "north", start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, thickness: .2, role: "boundary" as const },
    { id: "east", start: { x: 4, y: 0 }, end: { x: 4, y: 4 }, thickness: .2, role: "boundary" as const },
    { id: "south", start: { x: 4, y: 4 }, end: { x: 0, y: 4 }, thickness: .2, role: "boundary" as const },
    { id: "west", start: { x: 0, y: 4 }, end: { x: 0, y: 0 }, thickness: .2, role: "boundary" as const },
  ];
  const first = createConstructionDocument("plan-a", walls, { createId: () => "room-a", createName: () => "Room" });
  const second = structuredClone(first); second.id = "plan-b"; second.rooms[0]!.locked = true;
  project.constructions = [first, second];
  project.places = [
    { id: "level-a", name: "A", kind: "level", constructionId: "plan-a", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
    { id: "level-b", name: "B", kind: "level", constructionId: "plan-b", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
  ];
  return project;
}

describe("agent lock policy for ambiguous story scopes", () => {
  it("allows an unchanged malformed legacy annotation during an unrelated edit", () => {
    const before = projectWithAmbiguousRooms();
    before.story.objects = [{ ref: { kind: "room", id: "room-a" }, metadata: { properties: { flag: false } } }];
    const after = structuredClone(before); after.places[0]!.name = "Renamed level";
    expect(() => assertAgentLocks(before, after)).not.toThrow();
  });

  it.each(["added", "changed", "removed"] as const)("blocks an ambiguous annotation when it is %s", (operation) => {
    const before = projectWithAmbiguousRooms();
    if (operation !== "added") {
      before.story.objects = [{ ref: { kind: "room", id: "room-a" }, metadata: { properties: { flag: false } } }];
    }
    const after = structuredClone(before);
    if (operation === "added") {
      after.story.objects = [{ ref: { kind: "room", id: "room-a" }, metadata: { properties: { flag: false } } }];
    }
    if (operation === "changed") after.story.objects[0]!.metadata.properties!.flag = true;
    if (operation === "removed") after.story.objects = [];
    expect(() => assertAgentLocks(before, after)).toThrow("Object is locked for editing");
  });
});
