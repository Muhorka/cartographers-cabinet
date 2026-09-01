import { describe, expect, it } from "vitest";
import type { CanonicalWall } from "../geometry/geometry-types";
import { commitConstructionTransaction, createConstructionDocument, previewRoomRemoval, previewWallAddition, previewWallOffset, previewWallRemoval } from "./construction-document";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, role: CanonicalWall["role"] = "wall"): CanonicalWall => ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, role });
const shell = [wall("north", 0, 0, 10, 0, "boundary"), wall("east", 10, 0, 10, 10, "boundary"), wall("south", 10, 10, 0, 10, "boundary"), wall("west", 0, 10, 0, 0, "boundary")];
const identities = () => { let value = 0; return { createId: () => `room-${++value}`, createName: (index: number) => `Room ${index}` }; };

describe("editor v2 construction transactions", () => {
  it("keeps a preview separate from the saved document", () => {
    const identity = identities(); const document = createConstructionDocument("plan", [...shell, wall("partition", 5, 0, 5, 10)], identity);
    const preview = previewWallOffset(document, "partition", -2, identity);
    expect(document.walls.find(({ id }) => id === "partition")?.start.x).toBe(5);
    expect(preview.after.walls.find(({ id }) => id === "partition")?.start.x).toBe(7);
    expect(document.revision).toBe(0); expect(preview.after.revision).toBe(1);
  });

  it("commits the same geometry that room navigation will read", () => {
    const identity = identities(); const document = createConstructionDocument("plan", [...shell, wall("partition", 5, 0, 5, 10)], identity);
    const preview = previewWallOffset(document, "partition", -2, identity);
    const result = commitConstructionTransaction(document, preview);
    expect(result.state).toBe("committed");
    expect(result.document.rooms.map(({ faceId }) => faceId).toSorted()).toEqual(preview.afterNetwork.faces.map(({ id }) => id).toSorted());
  });

  it("reports room creation when a wall closes a new face", () => {
    const identity = identities(); const document = createConstructionDocument("plan", shell, identity);
    const preview = previewWallAddition(document, [wall("partition", 5, 0, 5, 10)], identity);
    expect(preview.effects.some(({ kind }) => kind === "room-split")).toBe(true);
    expect(preview.effects.some(({ kind }) => kind === "rooms-created")).toBe(true);
    expect(preview.after.rooms).toHaveLength(2);
  });

  it("keeps a face when normalization moves its edge microscopically past the stored enclosure", () => {
    const identity = identities();
    const enclosure = { kind: "rectangle" as const, x: .0000005, y: .0000005, width: 9.999999, height: 9.999999 };
    expect(createConstructionDocument("plan", shell, identity, enclosure).rooms).toHaveLength(1);
  });

  it("keeps the existing exterior wall when a new figure overlaps it", () => {
    const identity = identities(); const document = createConstructionDocument("plan", shell, identity);
    const preview = previewWallAddition(document, [
      wall("shared", 0, 0, 10, 0, "partition"),
      wall("inner-right", 10, 0, 10, 5, "partition"),
      wall("inner-bottom", 10, 5, 0, 5, "partition"),
      wall("inner-left", 0, 5, 0, 0, "partition"),
    ], identity);
    expect(commitConstructionTransaction(document, preview).state).toBe("committed");
    expect(preview.after.walls.filter(({ start, end }) => start.y === 0 && end.y === 0)).toHaveLength(1);
    expect(preview.after.walls.find(({ start, end }) => start.y === 0 && end.y === 0)?.role).toBe("boundary");
    expect(preview.after.rooms).toHaveLength(2);
  });

  it("persists crossed walls as separate segments and keeps an opening on the matching piece", () => {
    const identity = identities();
    const base = createConstructionDocument("plan", [...shell, wall("horizontal", 0, 5, 10, 5)], identity);
    const document = { ...base, openings: [{ id: "door", kind: "door" as const, wallId: "horizontal", position: .2, width: .8 }] };
    const preview = previewWallAddition(document, [wall("vertical", 5, 0, 5, 10)], identity);
    expect(preview.after.walls.filter(({ id }) => id.startsWith("horizontal:"))).toHaveLength(2);
    expect(preview.after.openings).toHaveLength(1);
    expect(preview.after.openings[0].wallId).toBe("horizontal:1");
    expect(preview.after.openings[0].position).toBeCloseTo(.4);
  });

  it("rejects stale previews instead of applying them to another revision", () => {
    const identity = identities(); const document = createConstructionDocument("plan", shell, identity);
    const preview = previewWallAddition(document, [wall("partition", 5, 0, 5, 10)], identity);
    const changed = { ...document, revision: 4 };
    expect(commitConstructionTransaction(changed, preview)).toEqual({ state: "stale", document: changed });
  });

  it("removes openings together with the wall they are anchored to", () => {
    const identity = identities(); const base = createConstructionDocument("plan", [...shell, wall("partition", 5, 0, 5, 10)], identity);
    const document = { ...base, openings: [{ id: "door", kind: "door" as const, wallId: "partition", position: .5, width: 1.2 }] };
    const preview = previewWallRemoval(document, ["partition"], identity);
    expect(preview.after.openings).toEqual([]);
    expect(preview.effects).toContainEqual({ kind: "openings-removed", ids: ["door"] });
    expect(commitConstructionTransaction(document, preview).state).toBe("committed");
  });

  it("turns deleting a room into removal of its shared interior wall", () => {
    const identity = identities(); const document = createConstructionDocument("plan", [...shell, wall("partition", 5, 0, 5, 10)], identity);
    const candidate = previewRoomRemoval(document, document.rooms[0].id, identity);
    expect(candidate.state).toBe("ready"); if (candidate.state !== "ready") return;
    expect(candidate.wallIds).toEqual(["partition"]);
    expect(candidate.transaction.after.rooms).toHaveLength(1);
    expect(candidate.transaction.after.walls.map(({ id }) => id)).not.toContain("partition");
  });
});
