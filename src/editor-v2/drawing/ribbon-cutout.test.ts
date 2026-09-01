import { describe, expect, it } from "vitest";
import { emptyProject, type DrawingElement } from "../model/project-model";
import { cutRegionFromSelection } from "./cutout-operation";
import { preferredCutoutTarget } from "../components/workbench-helpers";
import { ribbonShape } from "../geometry/ribbon-geometry";
import { pointInRegion } from "../geometry/region-constraints";

describe("shared ribbon cutouts", () => {
  it.each(["road.paved", "terrain.river", "terrain.stream"])("cuts %s without losing its editable axis", (subjectId) => {
    const element: DrawingElement = { id: "band", belongsToId: "world", name: "Band", subjectId, layerId: subjectId.startsWith("road") ? "roads" : "terrain", widthMeters: 6, geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} };
    const project = { ...emptyProject("test", "Test"), elements: [element] };
    const target = { kind: "element" as const, id: element.id };
    expect(preferredCutoutTarget(project, target, "world")).toEqual(target);
    expect(preferredCutoutTarget(project, target, "world", false, "add")).toBeUndefined();
    const result = cutRegionFromSelection(project, "world", target, { kind: "circle", cx: 10, cy: 0, radius: 1 }, { createId: () => "unused", createRoomName: () => "Unused" });
    expect(result.state).toBe("applied");
    const changed = result.project.elements[0];
    expect(changed.geometry).toEqual(element.geometry);
    expect(changed.widthMeters).toBe(6);
    expect(pointInRegion({ x: 10, y: 0 }, ribbonShape(changed)!)).toBe(false);
    expect(pointInRegion({ x: 5, y: 0 }, ribbonShape(changed)!)).toBe(true);
    expect(preferredCutoutTarget({ ...project, elements: [{ ...element, locked: true }] }, target, "world")).toBeUndefined();
  });
});
