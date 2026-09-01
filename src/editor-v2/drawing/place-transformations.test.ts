import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { duplicateSelectedPlaces, mergeSelectedPlaces, transformSelectedPlaces } from "./place-transformations";

function identity() { let index = 0; return { createId: () => `copy-${++index}`, createRoomName: (room: number) => `Room ${room}` }; }

describe("place transformations", () => {
  it("duplicates a building together with its level and construction", () => {
    const project = createStarterProject("project", "Project", "en"); const building = project.places.find(({ kind }) => kind === "building")!;
    const result = duplicateSelectedPlaces(project, [building.id], identity(), (name) => `${name} copy`);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const copy = result.project.places.find(({ id }) => id === result.selectedIds[0])!;
    const level = result.project.places.find(({ parentId, kind }) => parentId === copy.id && kind === "level");
    expect(copy.name).toContain("copy"); expect(level?.constructionId).toBeTruthy(); expect(result.project.constructions.some(({ id }) => id === level?.constructionId)).toBe(true);
  });

  it("rotates several buildings around one shared centre without losing their contents", () => {
    const project = createStarterProject("project", "Project", "en"); const first = project.places.find(({ kind }) => kind === "building")!;
    const second = { ...structuredClone(first), id: "second", transform: { ...first.transform, x: first.transform.x + 8 } }; project.places.push(second);
    const result = transformSelectedPlaces(project, [first.id, second.id], { kind: "rotate", degrees: 90 });
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.places.find(({ id }) => id === first.id)?.transform.rotation).toBe(90);
    expect(result.project.places.some(({ parentId }) => parentId === first.id)).toBe(true);
  });

  it("merges compatible locations and reparents everything owned by the secondary location", () => {
    const project: EditorProject = { ...emptyProject("p", "Atlas"), places: [
      { id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 60 }, tags: [], access: [], properties: {} },
      { id: "a", parentId: "world", name: "A", kind: "location", transform: { x: 10, y: 10, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, tags: [], access: [], properties: {} },
      { id: "b", parentId: "world", name: "B", kind: "location", transform: { x: 25, y: 10, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, tags: [], access: [], properties: {} },
      { id: "house", parentId: "b", name: "House", kind: "building", transform: { x: 4, y: 4, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 5, height: 5 }, tags: [], access: [], properties: {} },
    ], elements: [{ id: "pond", belongsToId: "b", name: "Pond", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "region", shape: { kind: "circle", cx: 8, cy: 8, radius: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} }], constructions: [] };
    const result = mergeSelectedPlaces(project, ["a", "b"], "outer-only", identity());
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    expect(result.project.places.some(({ id }) => id === "b")).toBe(false); expect(result.project.places.find(({ id }) => id === "house")?.parentId).toBe("a"); expect(result.project.elements[0].belongsToId).toBe("a");
  });
});
