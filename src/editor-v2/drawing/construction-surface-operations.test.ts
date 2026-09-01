import { describe, expect, it } from "vitest";
import { addConstructionSurface, createPlace } from "../model/hierarchy-operations";
import { emptyProject, type ConstructionSurface } from "../model/project-model";
import { duplicateSelectedPlaces, mergeSelectedPlaces } from "./place-transformations";
import { cutRegionFromSelection } from "./cutout-operation";
import { addRegionToOutline } from "./add-to-outline-operation";
import { duplicateSelectedConstructionSurfaces, mergeSelectedConstructionSurfaces, moveConstructionSurface, moveConstructionSurfaceVertex, resizeConstructionSurface, transformSelectedConstructionSurfaces, updateConstructionSurface } from "./construction-surface-operations";
import { pointInRegion } from "../geometry/region-constraints";

function projectWithOwner() {
  return createPlace(emptyProject("p", "Project"), {
    id: "world",
    name: "World",
    kind: "world",
    boundary: { kind: "rectangle", x: -20, y: -20, width: 40, height: 40 },
  });
}

function surface(): Omit<ConstructionSurface, "belongsToId"> {
  return {
    id: "terrace",
    name: "Terrace",
    kind: "terrace",
    shape: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] },
    attachment: "free",
    elevation: 0,
    visible: true,
    locked: false,
    tags: [],
    access: [],
    properties: {},
  };
}

describe("construction surface operations", () => {
  it("creates a surface with the active place as its default owner", () => {
    const project = addConstructionSurface(projectWithOwner(), surface(), "world");
    expect(project.surfaces).toHaveLength(1);
    expect(project.surfaces[0]).toMatchObject({ id: "terrace", belongsToId: "world" });
  });

  it("moves, resizes and edits a surface vertex without mutating the source", () => {
    const project = addConstructionSurface(projectWithOwner(), surface(), "world");
    const moved = moveConstructionSurface(project, "terrace", { x: 2, y: -1 });
    expect(moved.state).toBe("applied");
    if (moved.state !== "applied") return;
    expect(moved.project.surfaces[0]!.shape.kind).toBe("polygon");
    if (moved.project.surfaces[0]!.shape.kind === "polygon") expect(moved.project.surfaces[0]!.shape.points).toEqual(expect.arrayContaining([{ x: 2, y: -1 }, { x: 6, y: -1 }]));
    expect(project.surfaces[0]!.shape.kind).toBe("polygon");
    if (project.surfaces[0]!.shape.kind === "polygon") expect(project.surfaces[0]!.shape.points).toEqual(expect.arrayContaining([{ x: 0, y: 0 }]));

    const resized = resizeConstructionSurface(moved.project, "terrace", "south-east", { x: 8, y: 5 });
    expect(resized.state).toBe("applied");
    if (resized.state !== "applied") return;
    expect(resized.project.surfaces[0]!.shape.kind).toBe("polygon");
    if (resized.project.surfaces[0]!.shape.kind === "polygon") expect(resized.project.surfaces[0]!.shape.points).toEqual(expect.arrayContaining([{ x: 2, y: -1 }, { x: 8, y: -1 }]));

    const vertex = moveConstructionSurfaceVertex(resized.project, "terrace", 0, 2, { x: 9, y: 6 });
    expect(vertex.state).toBe("applied");
    if (vertex.state !== "applied") return;
    expect(vertex.project.surfaces[0]!.shape.kind).toBe("polygon");
    expect(vertex.project.surfaces[0]!.shape.kind === "polygon" && vertex.project.surfaces[0]!.shape.points).toContainEqual({ x: 9, y: 6 });
  });

  it("updates surface metadata and refuses edits to a locked surface", () => {
    const project = addConstructionSurface(projectWithOwner(), surface(), "world");
    const updated = updateConstructionSurface(project, "terrace", { name: "Porch", description: "A covered platform", attachment: "attached", elevation: 1.2 });
    expect(updated.surfaces[0]).toMatchObject({ name: "Porch", description: "A covered platform", attachment: "attached", elevation: 1.2, belongsToId: "world" });

    const locked = updateConstructionSurface(updated, "terrace", { locked: true });
    const moved = moveConstructionSurface(locked, "terrace", { x: 1, y: 1 });
    expect(moved).toMatchObject({ state: "blocked", reason: "locked-outline" });
  });

  it("supports cutouts and connected additions on a surface", () => {
    const project = addConstructionSurface(projectWithOwner(), surface(), "world");
    const cut = cutRegionFromSelection(project, "world", { kind: "surface", id: "terrace" }, { kind: "rectangle", x: 1, y: 1, width: 1, height: 1 }, { createId: () => "cut", createRoomName: () => "Room" });
    expect(cut.state).toBe("applied");
    if (cut.state !== "applied") return;
    expect(pointInRegion({ x: 1.5, y: 1.5 }, cut.project.surfaces[0]!.shape)).toBe(false);

    const addition = addRegionToOutline(cut.project, "world", { kind: "surface", id: "terrace" }, { kind: "rectangle", x: 4, y: 0, width: 2, height: 3 }, { createId: () => "id", createRoomName: () => "Room" });
    expect(addition.state).toBe("applied");
    if (addition.state !== "applied") return;
    expect(pointInRegion({ x: 5, y: 1 }, addition.project.surfaces[0]!.shape)).toBe(true);

    const disconnected = addRegionToOutline(project, "world", { kind: "surface", id: "terrace" }, { kind: "rectangle", x: 10, y: 0, width: 2, height: 3 }, { createId: () => "id", createRoomName: () => "Room" });
    expect(disconnected).toMatchObject({ state: "blocked", reason: "disconnected" });
  });

  it("keeps surfaces when their containing location is duplicated or merged", () => {
    let project = projectWithOwner();
    project = createPlace(project, { id: "west", parentId: "world", name: "West", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 8, height: 8 } });
    project = createPlace(project, { id: "east", parentId: "world", name: "East", kind: "location", boundary: { kind: "rectangle", x: 6, y: 0, width: 8, height: 8 } });
    project = addConstructionSurface(project, { ...surface(), id: "west-surface", name: "West deck" }, "west");
    project = addConstructionSurface(project, { ...surface(), id: "east-surface", name: "East deck" }, "east");
    const identity = { createId: (() => { let index = 0; return () => `copy-${++index}`; })(), createRoomName: () => "Room" };

    const duplicated = duplicateSelectedPlaces(project, ["west"], identity, (name) => `${name} copy`);
    expect(duplicated.state).toBe("applied");
    if (duplicated.state !== "applied") return;
    expect(duplicated.project.surfaces).toHaveLength(3);
    expect(duplicated.project.surfaces.some(({ id, belongsToId }) => id !== "west-surface" && belongsToId !== "west")).toBe(true);

    const merged = mergeSelectedPlaces(project, ["west", "east"], "outer-only", identity);
    expect(merged.state).toBe("applied");
    if (merged.state !== "applied") return;
    expect(merged.project.surfaces.every(({ belongsToId }) => belongsToId === "west")).toBe(true);
  });

  it("duplicates, transforms and truly unions compatible surfaces", () => {
    let project = addConstructionSurface(projectWithOwner(), surface(), "world");
    project = addConstructionSurface(project, { ...surface(), id: "terrace-2", shape: { kind: "rectangle", x: 3, y: 0, width: 3, height: 3 } }, "world");
    const merged = mergeSelectedConstructionSurfaces(project, ["terrace", "terrace-2"]); expect(merged.state).toBe("applied");
    if (merged.state !== "applied") return; expect(merged.project.surfaces).toHaveLength(1); expect(pointInRegion({ x: 5, y: 1 }, merged.project.surfaces[0].shape)).toBe(true);
    const duplicated = duplicateSelectedConstructionSurfaces(merged.project, ["terrace"], () => "terrace-copy", (name) => `${name} copy`); expect(duplicated.state).toBe("applied");
    if (duplicated.state !== "applied") return; expect(duplicated.selectedIds).toEqual(["terrace-copy"]);
    const transformed = transformSelectedConstructionSurfaces(duplicated.project, ["terrace-copy"], { kind: "mirror", axis: "horizontal" }); expect(transformed.state).toBe("applied");
  });

  it("keeps separated compatible surfaces as one composite instead of swallowing one", () => {
    let project = addConstructionSurface(projectWithOwner(), surface(), "world");
    project = addConstructionSurface(project, { ...surface(), id: "terrace-2", shape: { kind: "rectangle", x: 10, y: 0, width: 3, height: 3 } }, "world");
    const merged = mergeSelectedConstructionSurfaces(project, ["terrace", "terrace-2"]);
    expect(merged.state).toBe("applied"); if (merged.state !== "applied") return;
    expect(merged.project.surfaces).toHaveLength(1);
    expect(merged.project.surfaces[0].shape).toMatchObject({ kind: "compound", polygons: [{}, {}] });
  });
});
