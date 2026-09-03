import { describe, expect, it } from "vitest";
import { buildWallNetwork, materializeWallSegments } from "./wall-network-kernel";
import type { CanonicalWall } from "./geometry-types";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "wall"): CanonicalWall => ({
  id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: role === "partition" ? 0.18 : 0.3, role,
});

const shell = [
  wall("north", 0, 0, 10, 0, "boundary"), wall("east", 10, 0, 10, 10, "boundary"),
  wall("south", 10, 10, 0, 10, "boundary"), wall("west", 0, 10, 0, 0, "boundary"),
];

describe("editor v2 wall network kernel", () => {
  it("nodes every crossing while preserving source wall provenance", () => {
    const result = buildWallNetwork([wall("horizontal", 0, 5, 10, 5), wall("vertical", 5, 0, 5, 10)]);
    expect(result.segments).toHaveLength(4);
    expect(result.segments.filter(({ sourceWallId }) => sourceWallId === "horizontal")).toHaveLength(2);
    expect(result.segments.filter(({ sourceWallId }) => sourceWallId === "vertical")).toHaveLength(2);
    expect(result.segments.every(({ start, end }) => start.x === 5 || start.y === 5 || end.x === 5 || end.y === 5)).toBe(true);
  });

  it("materializes every noded piece as an independently editable wall", () => {
    const walls = materializeWallSegments([wall("horizontal", 0, 5, 10, 5), wall("vertical", 5, 0, 5, 10)]);
    expect(new Set(walls.map(({ id }) => id)).size).toBe(4);
    expect(walls.filter(({ sourceWallId }) => sourceWallId === "horizontal")).toHaveLength(2);
    expect(walls.filter(({ sourceWallId }) => sourceWallId === "vertical")).toHaveLength(2);
    expect(walls.every(({ start, end }) => Math.hypot(end.x - start.x, end.y - start.y) === 5)).toBe(true);
  });

  it("does not collide with an independent id that resembles an old derived segment", () => {
    const walls = materializeWallSegments([
      wall("horizontal", 0, 5, 10, 5), wall("vertical", 5, 0, 5, 10),
      wall("horizontal:1", 20, 0, 20, 4),
    ]);

    expect(new Set(walls.map(({ id }) => id)).size).toBe(walls.length);
    expect(walls.find(({ id }) => id === "horizontal:1")?.sourceWallId).toBeUndefined();
    expect(walls.filter(({ sourceWallId }) => sourceWallId === "horizontal")).toHaveLength(2);
  });

  it("keeps derived ids within the persisted identifier budget", () => {
    const longId = "w".repeat(512);
    const walls = materializeWallSegments([wall(longId, 0, 5, 10, 5), wall("vertical", 5, 0, 5, 10)]);

    expect(walls.every(({ id }) => id.length <= 512)).toBe(true);
    expect(walls.filter(({ sourceWallId }) => sourceWallId === longId)).toHaveLength(2);
  });

  it("derives rooms from walls instead of storing independent room geometry", () => {
    const result = buildWallNetwork([...shell, wall("partition", 5, 0, 5, 10, "partition")]);
    expect(result.faces).toHaveLength(2);
    expect(result.faces.map(({ area }) => area).toSorted()).toEqual([50, 50]);
    expect(result.faces.every(({ wallIds }) => wallIds.includes("partition"))).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("creates four rooms when two partitions cross", () => {
    const result = buildWallNetwork([
      ...shell, wall("vertical", 5, 0, 5, 10, "partition"), wall("horizontal", 0, 5, 10, 5, "partition"),
    ]);
    expect(result.faces).toHaveLength(4);
    expect(result.faces.map(({ area }) => area)).toEqual([25, 25, 25, 25]);
    expect(result.segments).toHaveLength(12);
  });

  it("keeps face identities stable when walls arrive in another order", () => {
    const walls = [...shell, wall("partition", 5, 0, 5, 10, "partition")];
    const first = buildWallNetwork(walls).faces.map(({ id }) => id);
    const second = buildWallNetwork([...walls].reverse()).faces.map(({ id }) => id);
    expect(second).toEqual(first);
  });

  it("reports unfinished construction instead of silently discarding it", () => {
    const result = buildWallNetwork([...shell, wall("unfinished", 2, 2, 4, 4, "partition")]);
    expect(result.faces).toHaveLength(1);
    expect(result.diagnostics.some(({ kind, wallIds }) => kind === "dangling-edge" && wallIds.includes("unfinished"))).toBe(true);
  });

  it("treats identical overlapping walls as one usable edge", () => {
    const result = buildWallNetwork([...shell, wall("duplicate-north", 0, 0, 10, 0, "partition")]);
    expect(result.faces).toHaveLength(1);
    expect(result.diagnostics).toEqual([]);
    expect(result.segments.filter(({ start, end }) => start.y === 0 && end.y === 0)).toHaveLength(1);
  });

  it("heals tiny endpoint gaps that are visually one junction", () => {
    const result = buildWallNetwork([
      ...shell,
      wall("left-half", 0, 5, 4.94, 5, "partition"),
      wall("right-half", 5.06, 5, 10, 5, "partition"),
    ]);
    expect(result.faces).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
    expect(result.segments.some(({ start, end }) => start.x === 4.94 && end.x === 5.06 || start.x === 5.06 && end.x === 4.94)).toBe(false);
  });

  it("does not heal a deliberately visible gap", () => {
    const result = buildWallNetwork([
      ...shell,
      wall("left-half", 0, 5, 4.8, 5, "partition"),
      wall("right-half", 5.2, 5, 10, 5, "partition"),
    ]);
    expect(result.faces).toHaveLength(1);
    expect(result.diagnostics.some(({ kind }) => kind === "dangling-edge")).toBe(true);
  });

  it("never snaps the two endpoints of one short wall onto each other", () => {
    const short = wall("short", 2, 2, 2.1, 2, "partition");

    const persisted = materializeWallSegments([short]);

    expect(persisted).toEqual([short]);
    expect(buildWallNetwork([short]).segments).toHaveLength(1);
  });

  it("does not grow a junction cluster beyond the healing tolerance", () => {
    const result = materializeWallSegments([
      wall("first", 0, 0, 0, 5, "partition"),
      wall("second", .1, 0, .1, 5, "partition"),
      wall("third", .2, 0, .2, 5, "partition"),
    ]);
    const starts = new Set(result.map(({ start }) => `${start.x}:${start.y}`));

    expect(starts.size).toBeGreaterThan(1);
  });

  it("joins a visually touching wall endpoint to the middle of another wall", () => {
    const result = buildWallNetwork([
      ...shell,
      wall("left", 2, .08, 5, 6, "partition"),
      wall("right", 5, 6, 8, .1, "partition"),
    ]);
    expect(result.faces).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports zero length walls without sending them to JSTS", () => {
    const result = buildWallNetwork([...shell, wall("bad", 2, 2, 2, 2)]);
    expect(result.faces).toHaveLength(1);
    expect(result.diagnostics).toContainEqual({ kind: "zero-length-wall", wallIds: ["bad"], points: [{ x: 2, y: 2 }, { x: 2, y: 2 }] });
  });
});
