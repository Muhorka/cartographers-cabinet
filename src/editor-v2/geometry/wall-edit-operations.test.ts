import { describe, expect, it } from "vitest";
import type { CanonicalWall } from "./geometry-types";
import { buildWallNetwork } from "./wall-network-kernel";
import { moveJunction, offsetWall } from "./wall-edit-operations";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "wall"): CanonicalWall => ({
  id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, role,
});
const shell = [wall("north", 0, 0, 10, 0, "boundary"), wall("east", 10, 0, 10, 10, "boundary"), wall("south", 10, 10, 0, 10, "boundary"), wall("west", 0, 10, 0, 0, "boundary")];

describe("editor v2 wall editing", () => {
  it("offsets a partition and derives changed rooms without moving the building boundary", () => {
    const source = [...shell, wall("partition", 5, 0, 5, 10, "partition")];
    const result = offsetWall(source, "partition", -2);
    expect(result.issues).toEqual([]);
    expect(result.walls.find(({ id }) => id === "partition")).toMatchObject({ start: { x: 7, y: 0 }, end: { x: 7, y: 10 } });
    expect(result.walls.filter(({ role }) => role === "boundary")).toEqual(shell);
    expect(buildWallNetwork(result.walls).faces.map(({ area }) => area).toSorted((a, b) => a - b)).toEqual([30, 70]);
  });

  it("moves only the chosen segment while keeping neighbouring walls fixed", () => {
    const source = [wall("moving", 2, 2, 8, 2), wall("left", 2, 8, 2, 2), wall("right", 8, 2, 8, 8)];
    const result = offsetWall(source, "moving", 2);
    expect(result.issues).toEqual([]);
    expect(result.walls.find(({ id }) => id === "moving")).toMatchObject({ start: { x: 2, y: 4 }, end: { x: 8, y: 4 } });
    expect(result.walls.find(({ id }) => id === "left")).toEqual(source[1]);
    expect(result.walls.find(({ id }) => id === "right")).toEqual(source[2]);
  });

  it("does not reject a segment merely because its junction has several neighbouring pieces", () => {
    const source = [
      wall("moving", 5, 0, 5, 10, "partition"),
      wall("top-left", 0, 0, 5, 0), wall("top-right", 5, 0, 10, 0),
      wall("bottom-left", 0, 10, 5, 10), wall("bottom-right", 5, 10, 10, 10),
    ];
    const result = offsetWall(source, "moving", -2);
    expect(result.issues).toEqual([]);
    expect(result.walls.find(({ id }) => id === "moving")).toMatchObject({ start: { x: 7, y: 0 }, end: { x: 7, y: 10 } });
    expect(result.walls.filter(({ id }) => id !== "moving")).toEqual(source.slice(1));
  });

  it("offsets an angled wall along its own normal rather than locking to screen axes", () => {
    const result = offsetWall([wall("diagonal", 0, 0, 10, 10)], "diagonal", Math.SQRT2);
    expect(result.walls[0]).toMatchObject({ start: { x: -1, y: 1 }, end: { x: 9, y: 11 } });
  });

  it("moves an explicit junction without dragging unrelated endpoints", () => {
    const source = [wall("a", 0, 0, 5, 5), wall("b", 5, 5, 10, 0), wall("elsewhere", 20, 20, 30, 30)];
    const result = moveJunction(source, { x: 5, y: 5 }, { x: 6, y: 7 });
    expect(result.walls[0].end).toEqual({ x: 6, y: 7 });
    expect(result.walls[1].start).toEqual({ x: 6, y: 7 });
    expect(result.walls[2]).toEqual(source[2]);
  });
});
