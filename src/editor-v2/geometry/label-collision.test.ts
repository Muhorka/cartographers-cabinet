import { describe, expect, it } from "vitest";
import { createLabelCollisionRegistry } from "./label-collision";
import { prepareLabelFace } from "./label-prepared-geometry";
import { labelObstacleForLayout, roomLabelLayout } from "./room-label-layout";

const face = (x: number) => ({ outer: [{ x, y: -20 }, { x: x + 40, y: -20 }, { x: x + 40, y: 20 }, { x, y: 20 }] });

describe("render-only label collision registry", () => {
  it("moves a later label away from an earlier label from another object class", () => {
    const registry = createLabelCollisionRegistry();
    const first = roomLabelLayout("Rezydencja", face(0), 1)!;
    registry.register(first);
    const second = roomLabelLayout("Altana", face(0), 1, { obstacles: registry.obstaclesFor() });

    expect(second).toBeTruthy();
    expect(second!.x).not.toBe(first.x);
    const firstObstacle = prepareLabelFace(labelObstacleForLayout(first));
    const secondObstacle = prepareLabelFace(labelObstacleForLayout(second!));
    expect(secondObstacle.outer.points.some((point) => firstObstacle.contains(point))).toBe(false);
  });

  it("converts obstacles between place-owner coordinate frames without changing the anchor when there is no collision", () => {
    const registry = createLabelCollisionRegistry();
    const first = roomLabelLayout("Pierwszy", face(0), 1)!;
    registry.register(first, [1, 0, 0, 1, 100, 0]);
    const second = roomLabelLayout("Drugi", face(0), 1, { obstacles: registry.obstaclesFor([1, 0, 0, 1, 0, 0]) });

    expect(second).toBeTruthy();
    expect(second!.x).toBe(roomLabelLayout("Drugi", face(0), 1)!.x);
    expect(second!.y).toBe(roomLabelLayout("Drugi", face(0), 1)!.y);
  });
});
