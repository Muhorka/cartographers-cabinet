import { describe, expect, it } from "vitest";
import { addContainingScale, addMapLevel } from "./add-containing-scale";
import { createPlace } from "./hierarchy-operations";
import { emptyProject } from "./project-model";

function identity() { let value = 0; return { createId: () => `added-${++value}` }; }

describe("adding a containing map scale", () => {
  it("creates all sensible missing scales around an independent room", () => {
    const source = createPlace(emptyProject("p", "P"), { id: "room", name: "Scene", kind: "standalone-room", boundary: { kind: "rectangle", x: 0, y: 0, width: 8, height: 6 } });
    const result = addContainingScale(source, "room", "world", "My world", "en", identity());
    expect(result?.project.places.map(({ kind }) => kind)).toEqual(["building", "level", "room", "location", "world"]);
    expect(result?.project.places.find(({ kind }) => kind === "world")?.name).toBe("My world");
    expect(result?.project.places.find(({ kind }) => kind === "room")?.parentId).toBe(result?.project.places.find(({ kind }) => kind === "level")?.id);
  });

  it("adds a named custom collecting scale without inventing structural behaviour", () => {
    const source = createPlace(emptyProject("p", "P"), { id: "place", name: "Village", kind: "location" });
    const result = addContainingScale(source, "place", "custom", "Marches", "en", identity());
    expect(result?.project.places.find(({ kind }) => kind === "custom")).toMatchObject({ name: "Marches" });
    expect(result?.project.places.find(({ id }) => id === "place")?.parentId).toBe(result?.openedId);
  });

  it("adds a location inside an open world instead of offering only a custom scale", () => {
    const source = createPlace(emptyProject("p", "P"), { id: "world", name: "World", kind: "world" });
    const result = addMapLevel(source, "world", "location", "Valley", "en", identity());
    const location = result?.project.places.find(({ name }) => name === "Valley");
    expect(location).toMatchObject({ kind: "location", parentId: "world" });
    expect(location?.boundary).toBeUndefined();
  });
});
