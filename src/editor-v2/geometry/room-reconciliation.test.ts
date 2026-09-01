import { describe, expect, it } from "vitest";
import type { CanonicalWall } from "./geometry-types";
import { reconcileRooms, roomsForFaces } from "./room-reconciliation";
import { buildWallNetwork } from "./wall-network-kernel";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "wall"): CanonicalWall => ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, role });
const shell = [wall("north", 0, 0, 10, 0, "boundary"), wall("east", 10, 0, 10, 10, "boundary"), wall("south", 10, 10, 0, 10, "boundary"), wall("west", 0, 10, 0, 0, "boundary")];
const ids = () => { let value = 0; return () => `new-${++value}`; };

describe("editor v2 room reconciliation", () => {
  it("preserves room identity, name and metadata after a wall moves", () => {
    const before = buildWallNetwork([...shell, wall("partition", 5, 0, 5, 10)]).faces.toSorted((a, b) => a.outer[0].x - b.outer[0].x);
    const previous = roomsForFaces(before, ids(), (index) => index === 1 ? "Library" : "Salon");
    previous[0].description = "Quiet and lined with maps"; previous[1].tags = ["public"];
    const after = buildWallNetwork([...shell, wall("partition", 7, 0, 7, 10)]).faces;
    const result = reconcileRooms(before, after, previous, ids(), (index) => `Room ${index}`);
    expect(result.createdRoomIds).toEqual([]);
    expect(result.removedRoomIds).toEqual([]);
    expect(result.rooms.find(({ name }) => name === "Library")?.description).toBe("Quiet and lined with maps");
    expect(result.rooms.find(({ name }) => name === "Salon")?.tags).toEqual(["public"]);
  });

  it("reports a split and creates metadata only for the additional room", () => {
    const before = buildWallNetwork(shell).faces;
    const previous = roomsForFaces(before, ids(), () => "Great Hall");
    const after = buildWallNetwork([...shell, wall("partition", 5, 0, 5, 10)]).faces;
    const result = reconcileRooms(before, after, previous, ids(), (index) => `Room ${index}`);
    expect(result.splitRoomIds).toEqual([previous[0].id]);
    expect(result.createdRoomIds).toHaveLength(1);
    expect(result.rooms.map(({ name }) => name)).toContain("Great Hall");
  });

  it("reports a merge and removes only the redundant room record", () => {
    const before = buildWallNetwork([...shell, wall("partition", 5, 0, 5, 10)]).faces;
    const previous = roomsForFaces(before, ids(), (index) => `Chamber ${index}`);
    const after = buildWallNetwork(shell).faces;
    const result = reconcileRooms(before, after, previous, ids(), (index) => `Room ${index}`);
    expect(result.mergedFaceIds).toEqual([after[0].id]);
    expect(result.removedRoomIds).toHaveLength(1);
    expect(result.rooms).toHaveLength(1);
  });
});
