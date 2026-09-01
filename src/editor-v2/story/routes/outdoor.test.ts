import { describe, expect, it } from "vitest";
import { emptyProject } from "../../model/project-model";
import { pointInRegion } from "../../geometry/region-constraints";
import { findOutdoorRoute } from "./outdoor";

describe("outdoor boundary tolerance", () => {
  it("preserves the canonical near-edge point test for a rectangle", () => {
    const project = emptyProject("edge-tolerance", "Synthetic");
    const boundary = { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 10 };
    project.places.push({ id: "world", name: "World", kind: "world", boundary,
      transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    const from = { x: -5e-9, y: 5 }; const to = { x: 5, y: 5 };
    expect(pointInRegion(from, boundary)).toBe(true);
    const request = { from: { placeId: "world", point: from }, to: { placeId: "world", point: to }, width: 0 };
    expect(findOutdoorRoute(project, request)?.points).toEqual([from, to]);
    const outside = { x: -2e-7, y: 5 };
    expect(pointInRegion(outside, boundary)).toBe(false);
    expect(findOutdoorRoute(project, { ...request, from: { placeId: "world", point: outside } })).toBeUndefined();
  });
});
