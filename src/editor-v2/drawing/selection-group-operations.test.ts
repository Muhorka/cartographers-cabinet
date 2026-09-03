import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import { deleteSelectionGroup, moveSelectionGroup } from "./group-selection-operations";
import { projectWithHouse } from "./selection-operations-fixtures";

describe("group selection operations", () => {
  it("moves several selected buildings atomically without treating their old positions as collisions", () => {
    const prepared = projectWithHouse();
    const second = { ...prepared.project.places.find(({ id }) => id === "house")!, id: "annex", name: "Annex", transform: { x: 65, y: 45, rotation: 0 } };
    const project = { ...prepared.project, places: [...prepared.project.places, second] };
    const moved = moveSelectionGroup(project, { activePlaceId: "map", selections: [{ kind: "place", id: "house" }, { kind: "place", id: "annex" }], delta: { x: 3, y: 2 }, boundaryEditing: false }, prepared.identity);
    expect(moved.state).toBe("applied"); if (moved.state !== "applied") return;
    expect(moved.project.places.find(({ id }) => id === "house")?.transform).toMatchObject({ x: 33, y: 29 });
    expect(moved.project.places.find(({ id }) => id === "annex")?.transform).toMatchObject({ x: 68, y: 47 });
  });

  it("deletes several selected ordinary objects in one project change", () => {
    const { project, identity } = projectWithHouse();
    const object = (id: string, x: number) => ({ id, belongsToId: "floor", name: id, layerId: "equipment" as const, subjectId: "equipment.object", geometry: { kind: "point" as const, at: { x, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const prepared = { ...project, elements: [object("a", 0), object("b", 2)] };
    const deleted = deleteSelectionGroup(prepared, { activePlaceId: "floor", selections: [{ kind: "element", id: "a" }, { kind: "element", id: "b" }], boundaryEditing: false }, identity);
    expect(deleted.state).toBe("applied"); if (deleted.state === "applied") expect(deleted.project.elements).toEqual([]);
  });

  it("deletes a mixed room and wall selection as one construction operation", () => {
    const { project, identity } = projectWithHouse(); const base = project.constructions[0];
    const document = createConstructionDocument(base.id, [...base.walls, { id: "partition", start: { x: 0, y: -7 }, end: { x: 0, y: 7 }, thickness: .2, role: "partition" }], { createId: identity.createId, createName: identity.createRoomName });
    const deleted = deleteSelectionGroup({ ...project, constructions: [document] }, { activePlaceId: "floor", selections: [{ kind: "room", id: document.rooms[0].id }, { kind: "wall", id: "partition" }], boundaryEditing: false }, identity);
    expect(deleted.state).toBe("applied"); if (deleted.state !== "applied") return;
    expect(deleted.project.constructions[0].walls.map(({ id }) => id)).not.toContain("partition");
    expect(deleted.project.constructions[0].rooms).toHaveLength(1);
  });

  it("moves only the selected atomic wall segments as one group", () => {
    const { project, identity } = projectWithHouse();
    const base = project.constructions[0];
    const document = createConstructionDocument(base.id, [
      ...base.walls,
      { id: "horizontal", start: { x: -8, y: 0 }, end: { x: 8, y: 0 }, thickness: .2, role: "partition" },
      { id: "vertical", start: { x: 0, y: -5 }, end: { x: 0, y: 5 }, thickness: .2, role: "partition" },
    ], { createId: identity.createId, createName: identity.createRoomName });
    const prepared = { ...project, constructions: [document] };
    const selected = [
      document.walls.find(({ sourceWallId }) => sourceWallId === "horizontal")!,
      document.walls.find(({ sourceWallId }) => sourceWallId === "vertical")!,
    ];
    const untouched = document.walls.find(({ sourceWallId, id }) => sourceWallId === "horizontal" && id !== selected[0].id)!;
    const result = moveSelectionGroup(prepared, { activePlaceId: "floor", selections: selected.map(({ id }) => ({ kind: "wall" as const, id })), delta: { x: 1, y: 2 }, boundaryEditing: false }, identity);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const movedFamily = result.project.constructions[0].walls.filter(({ id, sourceWallId }) => selected.some(({ id: sourceId }) => id === sourceId || sourceWallId === sourceId));
    expect(movedFamily.some(({ start, end }) => [start, end].some((point) => point.x === selected[0].start.x + 1 && point.y === selected[0].start.y + 2))).toBe(true);
    const untouchedFamily = result.project.constructions[0].walls.filter(({ id, sourceWallId }) => id === untouched.id || sourceWallId === untouched.id);
    expect(untouchedFamily.flatMap(({ start, end }) => [start, end])).toContainEqual(untouched.end);
  });
});
