import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { moveSelectionGroup } from "./group-selection-operations";

describe("mixed group movement", () => {
  it("moves a location and a terrain object together", () => {
    const project: EditorProject = { ...emptyProject("p", "Atlas"), places: [
      { id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 60 }, tags: [], access: [], properties: {} },
      { id: "village", parentId: "world", name: "Village", kind: "location", transform: { x: 10, y: 10, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, tags: [], access: [], properties: {} },
    ], elements: [{ id: "river", belongsToId: "world", name: "River", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "path", points: [{ x: 0, y: 4 }, { x: 20, y: 4 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }], constructions: [] };
    const result = moveSelectionGroup(project, { activePlaceId: "world", selections: [{ kind: "place", id: "village" }, { kind: "element", id: "river" }], delta: { x: 3, y: 2 }, boundaryEditing: false }, { createId: () => "id", createRoomName: () => "Room" });
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.places.find(({ id }) => id === "village")?.transform).toMatchObject({ x: 13, y: 12 });
    expect(result.project.elements[0].geometry).toMatchObject({ kind: "path", points: [{ x: 3, y: 6 }, { x: 23, y: 6 }] });
  });
});
