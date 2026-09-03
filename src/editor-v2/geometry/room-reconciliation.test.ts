import { describe, expect, it } from "vitest";
import type { CanonicalWall } from "./geometry-types";
import { reconcileRooms, roomsForFaces } from "./room-reconciliation";
import { buildWallNetwork } from "./wall-network-kernel";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "wall"): CanonicalWall => ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, role });
const shell = [wall("north", 0, 0, 10, 0, "boundary"), wall("east", 10, 0, 10, 10, "boundary"), wall("south", 10, 10, 0, 10, "boundary"), wall("west", 0, 10, 0, 0, "boundary")];
const ids = () => { let value = 0; return () => `new-${++value}`; };
const face = (id: string, outer: { x: number; y: number }[], area: number) => ({ id, outer, holes: [], area, wallIds: [] });
const rectangle = (id: string, x: number, y: number, width: number, height: number) => face(id, [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }], width * height);

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

  it("uses the globally best one-to-one assignment instead of a greedy first win", () => {
    // The old partition has areas 10 and 5. The new L-shaped face overlaps
    // them by 6 and 5, while its companion overlaps only the first by 4.
    // Greedy matching would spend the L-shaped face on the first room (6),
    // leaving the second room unmatched; the global optimum is 5 + 4.
    const before = [rectangle("old-a", 0, 0, 10, 1), rectangle("old-b", 0, 1, 5, 1)];
    const after = [
      face("new-x", [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 0, y: 2 }], 11),
      rectangle("new-y", 6, 0, 4, 1),
    ];
    const previous = roomsForFaces(before, ids(), (index) => `Room ${index}`);
    const result = reconcileRooms(before, after, previous, ids(), (index) => `New ${index}`);
    expect(result.rooms.find(({ faceId }) => faceId === "new-x")?.id).toBe(previous[1].id);
    expect(result.rooms.find(({ faceId }) => faceId === "new-y")?.id).toBe(previous[0].id);
    expect(result.removedRoomIds).toEqual([]);
  });

  it("does not let a tiny adjacent overlap inherit room metadata", () => {
    const before = [rectangle("old", 0, 0, 10, 10)];
    const after = [rectangle("main", 0, 0, 10, 9.9), rectangle("sliver", 9.9, 9.9, 0.2, 0.2)];
    const identity = ids();
    const previous = roomsForFaces(before, identity, () => "Library");
    previous[0].description = "Keep this description";
    const result = reconcileRooms(before, after, previous, identity, (index) => `Room ${index}`);
    expect(result.rooms.find(({ faceId }) => faceId === "main")?.id).toBe(previous[0].id);
    expect(result.rooms.find(({ faceId }) => faceId === "main")?.description).toBe("Keep this description");
    expect(result.rooms.find(({ faceId }) => faceId === "sliver")?.id).not.toBe(previous[0].id);
    expect(result.splitRoomIds).toEqual([]);
  });

  it("keeps equal split outcomes stable across repeated reconciliation", () => {
    const before = [rectangle("old", 0, 0, 10, 10)];
    const after = [rectangle("left", 0, 0, 5, 10), rectangle("right", 5, 0, 5, 10)];
    const previous = roomsForFaces(before, ids(), () => "Hall");
    const first = reconcileRooms(before, after, previous, ids(), (index) => `Room ${index}`);
    const second = reconcileRooms(before, after, previous, ids(), (index) => `Room ${index}`);
    expect(first.rooms).toEqual(second.rooms);
    expect(first.splitRoomIds).toEqual([previous[0].id]);
  });
});
