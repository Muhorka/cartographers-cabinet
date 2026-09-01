import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { filterSheetObjectGroups, sheetObjectGroups } from "./sheet-object-catalogue";
import type { SheetObjectListCopy } from "./sheet-object-list";

const copy: SheetObjectListCopy = {
  title: "Objects", places: "Places", terrain: "Terrain", equipment: "Equipment", sketch: "Sketch", rooms: "Rooms", walls: "Walls", features: "Features", empty: "Empty", noResults: "No results", search: "Search", show: "Show", hide: "Hide", lock: "Lock", unlock: "Unlock",
  wallName: (index) => `Wall ${index}`, openingName: (kind, index) => `${kind} ${index}`, stairsName: (index) => `Stairs ${index}`,
};

describe("sheet object catalogue", () => {
  it("searches names, descriptions and tags without requiring Polish diacritics", () => {
    const base = createStarterProject("project", "Project", "en");
    const project = { ...base, elements: [
      { id: "oak", belongsToId: "project:level", name: "Dąb", description: "Stare drzewo", layerId: "terrain" as const, subjectId: "terrain.forest", geometry: { kind: "point" as const, at: { x: 0, y: 0 } }, visible: true, locked: false, tags: ["święty"], access: [], properties: {} },
      { id: "chair", belongsToId: "project:level", name: "Chair", layerId: "equipment" as const, subjectId: "equipment.furniture", geometry: { kind: "point" as const, at: { x: 2, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
    ] };
    const groups = sheetObjectGroups(project, "project:level", copy);
    expect(filterSheetObjectGroups(groups, "stare swiety").flatMap(({ items }) => items.map(({ label }) => label))).toEqual(["Dąb"]);
    expect(filterSheetObjectGroups(groups, "chair").map(({ label }) => label)).toEqual(["Equipment"]);
  });

  it("includes terrain visible from related map levels, not only direct ownership", () => {
    const base = createStarterProject("project", "Project", "en");
    const project = { ...base, elements: [{ id: "river", belongsToId: "project:world", name: "River", layerId: "terrain" as const, subjectId: "terrain.water", geometry: { kind: "point" as const, at: { x: 0, y: 0 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] };
    const terrain = sheetObjectGroups(project, "project:place", copy).find(({ id }) => id === "terrain");
    expect(terrain?.items.map(({ label }) => label)).toContain("River");
  });
});
