import { describe, expect, it } from "vitest";
import { createLabelLayoutPlan } from "./label-collision";
import { prepareLabelFace } from "./label-prepared-geometry";
import { labelObstacleForLayout, roomLabelLayout, type RoomLabelLayout } from "./room-label-layout";

const face = (x: number) => ({ outer: [{ x, y: -20 }, { x: x + 40, y: -20 }, { x: x + 40, y: 20 }, { x, y: 20 }] });

describe("render-only label collision registry", () => {
  it("moves a later label away from an earlier label from another object class", () => {
    const plan = createLabelLayoutPlan([
      { key: "first", bounds: face(0), layout: (obstacles) => roomLabelLayout("Rezydencja", face(0), 1, { obstacles }) },
      { key: "second", bounds: face(0), layout: (obstacles) => roomLabelLayout("Altana", face(0), 1, { obstacles }) },
    ]);
    const first = plan.get("first") as RoomLabelLayout | undefined;
    const second = plan.get("second") as RoomLabelLayout | undefined;

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second!.x).not.toBe(first!.x);
    const firstObstacle = prepareLabelFace(labelObstacleForLayout(first!));
    const secondObstacle = prepareLabelFace(labelObstacleForLayout(second!));
    expect(secondObstacle.outer.points.some((point) => firstObstacle.contains(point))).toBe(false);
  });

  it("converts obstacles between place-owner coordinate frames without changing the anchor when there is no collision", () => {
    const plan = createLabelLayoutPlan([
      { key: "first", matrix: [1, 0, 0, 1, 100, 0], bounds: face(0), layout: (obstacles) => roomLabelLayout("Pierwszy", face(0), 1, { obstacles }) },
      { key: "second", matrix: [1, 0, 0, 1, 0, 0], bounds: face(0), layout: (obstacles) => roomLabelLayout("Drugi", face(0), 1, { obstacles }) },
    ]);
    const second = plan.get("second") as RoomLabelLayout | undefined;

    expect(second).toBeTruthy();
    expect(second!.x).toBe(roomLabelLayout("Drugi", face(0), 1)!.x);
    expect(second!.y).toBe(roomLabelLayout("Drugi", face(0), 1)!.y);
  });

  it("is pure across a StrictMode-style double planning pass", () => {
    const entries = [
      { key: "first", bounds: face(0), layout: (obstacles: readonly ReturnType<typeof labelObstacleForLayout>[]) => roomLabelLayout("Pierwszy", face(0), 1, { obstacles }) },
      { key: "second", bounds: face(0), layout: (obstacles: readonly ReturnType<typeof labelObstacleForLayout>[]) => roomLabelLayout("Drugi", face(0), 1, { obstacles }) },
    ];
    const firstPass = createLabelLayoutPlan(entries);
    const secondPass = createLabelLayoutPlan(entries);

    expect(secondPass.get("first")).toEqual(firstPass.get("first"));
    expect(secondPass.get("second")).toEqual(firstPass.get("second"));
  });

  it("uses a moving transform for collision scope without moving the local anchor", () => {
    const base = roomLabelLayout("Pierwszy", face(0), 1)!;
    const stationary = createLabelLayoutPlan([
      { key: "first", bounds: face(0), layout: (obstacles) => roomLabelLayout("Pierwszy", face(0), 1, { obstacles }) },
      { key: "second", bounds: face(0), layout: (obstacles) => roomLabelLayout("Drugi", face(0), 1, { obstacles }) },
    ]).get("second") as RoomLabelLayout | undefined;
    const moved = createLabelLayoutPlan([
      { key: "first", matrix: [1, 0, 0, 1, 100, 0], bounds: face(0), layout: (obstacles) => roomLabelLayout("Pierwszy", face(0), 1, { obstacles }) },
      { key: "second", bounds: face(0), layout: (obstacles) => roomLabelLayout("Drugi", face(0), 1, { obstacles }) },
    ]).get("second") as RoomLabelLayout | undefined;

    expect(stationary!.x).not.toBe(base.x);
    expect(moved).toEqual(roomLabelLayout("Drugi", face(0), 1));
  });
});
