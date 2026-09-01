import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "./construction-document";
import { deleteVerticalTransition, deleteWallOpening, moveWallOpening, placeVerticalTransition, placeWallOpening, resizeWallOpening } from "./wall-features";

function plan() {
  return createConstructionDocument("plan", [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: .3, role: "boundary" }], { createId: () => "room", createName: () => "Room" });
}

describe("wall openings", () => {
  it("anchors an opening to the nearest wall without a drawing instrument", () => {
    const result = placeWallOpening(plan(), { id: "door", kind: "door", point: { x: 4, y: .4 }, width: 1.2 });
    expect(result.state).toBe("placed");
    if (result.state === "placed") expect(result.opening).toMatchObject({ wallId: "wall", position: .4, width: 1.2 });
  });

  it("moves and resizes an opening while keeping its span on a wall", () => {
    const placed = placeWallOpening(plan(), { id: "window", kind: "window", point: { x: 4, y: 0 }, width: 1 });
    if (placed.state !== "placed") throw new Error("placement failed");
    const moved = moveWallOpening(placed.document, "window", { x: 7, y: .2 });
    expect(moved.state).toBe("moved");
    if (moved.state !== "moved") throw new Error("move failed");
    const resized = resizeWallOpening(moved.document, "window", 2.5);
    expect(resized.state).toBe("resized");
    if (resized.state === "resized") expect(resized.opening.width).toBe(2.5);
  });

  it("blocks overlap and removes an opening with one semantic operation", () => {
    const first = placeWallOpening(plan(), { id: "door", kind: "door", point: { x: 5, y: 0 }, width: 2 });
    if (first.state !== "placed") throw new Error("placement failed");
    expect(placeWallOpening(first.document, { id: "window", kind: "window", point: { x: 5.5, y: 0 }, width: 1 }).state).toBe("blocked");
    expect(deleteWallOpening(first.document, "door")).toMatchObject({ state: "deleted", document: { openings: [] } });
  });
});

describe("vertical transitions", () => {
  const enclosure = { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 8 };

  it("places stairs only inside one enclosing room and prevents overlap", () => {
    const placed = placeVerticalTransition(plan(), { id: "stairs", footprint: { kind: "rectangle", x: 2, y: 2, width: 3, height: 2 }, enclosure });
    expect(placed.state).toBe("placed");
    expect(placeVerticalTransition(placed.document, { id: "other", footprint: { kind: "rectangle", x: 4, y: 2, width: 2, height: 2 }, enclosure }).state).toBe("blocked");
    expect(placeVerticalTransition(placed.document, { id: "outside", footprint: { kind: "rectangle", x: 9, y: 2, width: 3, height: 2 }, enclosure }).state).toBe("outside-room");
  });

  it("deletes a stair footprint as one object", () => {
    const placed = placeVerticalTransition(plan(), { id: "stairs", footprint: { kind: "rectangle", x: 2, y: 2, width: 3, height: 2 }, enclosure });
    expect(deleteVerticalTransition(placed.document, "stairs").document.transitions).toEqual([]);
  });
});
