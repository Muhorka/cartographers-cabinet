import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import { createStarterProject } from "../model/starter-project";
import { duplicateSelectedRooms, transformSelectedRooms } from "./room-transformations";

function identity() {
  let index = 0;
  return { createId: () => `room-op-${++index}`, createRoomName: (room: number) => `Room ${room}` };
}

function projectWithInnerRoom() {
  const ids = identity(); const project = createStarterProject("project", "Project", "en"); const base = project.constructions[0];
  const inner = [
    { id: "inner-n", start: { x: -4, y: -3 }, end: { x: 0, y: -3 }, thickness: .2, role: "partition" as const },
    { id: "inner-e", start: { x: 0, y: -3 }, end: { x: 0, y: 1 }, thickness: .2, role: "partition" as const },
    { id: "inner-s", start: { x: 0, y: 1 }, end: { x: -4, y: 1 }, thickness: .2, role: "partition" as const },
    { id: "inner-w", start: { x: -4, y: 1 }, end: { x: -4, y: -3 }, thickness: .2, role: "partition" as const },
  ];
  const document = createConstructionDocument(base.id, [...base.walls, ...inner], { createId: ids.createId, createName: ids.createRoomName });
  const next = syncConstructionRooms({ ...project, constructions: [document] }, document);
  const network = buildWallNetwork(document.walls); const smallest = network.faces.toSorted((a, b) => a.area - b.area)[0];
  return { project: next, room: document.rooms.find(({ faceId }) => faceId === smallest.id)!, identity: ids };
}

describe("room transformations", () => {
  it("rotates an interior room and its owned equipment as one construction edit", () => {
    const prepared = projectWithInnerRoom(); const chair = { id: "chair", belongsToId: prepared.room.id, name: "Chair", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "point" as const, at: { x: -3, y: -2 } }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const result = transformSelectedRooms({ ...prepared.project, elements: [chair] }, "project:level", [prepared.room.id], { kind: "rotate", degrees: 90 }, false, prepared.identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.elements[0].geometry).not.toEqual(chair.geometry);
    expect(result.selectedIds).toHaveLength(1);
  });

  it("duplicates a room as new partition walls instead of copying a coloured face", () => {
    const prepared = projectWithInnerRoom(); const beforeWalls = prepared.project.constructions[0].walls.length;
    const result = duplicateSelectedRooms(prepared.project, "project:level", [prepared.room.id], prepared.identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.constructions[0].walls.length).toBeGreaterThan(beforeWalls);
    expect(result.selectedIds.length).toBeGreaterThan(0);
  });
});
