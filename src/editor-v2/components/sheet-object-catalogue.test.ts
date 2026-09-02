import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { filterSheetObjectGroups, sheetObjectGroups } from "./sheet-object-catalogue";
import type { SheetObjectListCopy } from "./sheet-object-list";
import { workbenchCopy } from "../i18n/workbench-copy";

const copy: SheetObjectListCopy = {
  title: "Objects", places: "Places", terrain: "Terrain", equipment: "Equipment", sketch: "Sketch", rooms: "Rooms", walls: "Walls", features: "Features", empty: "Empty", noResults: "No results", search: "Search", show: "Show", hide: "Hide", lock: "Lock", unlock: "Unlock",
  wallName: (index) => `Wall ${index}`, openingName: (kind, index) => `${kind} ${index}`, stairsName: (index) => `Stairs ${index}`,
};

function structuralNamesFixture() {
  const project = createStarterProject("names", "Names", "en");
  const construction = project.constructions[0]!;
  const wallId = construction.walls[0]!.id;
  construction.openings = [{ id: "library-door", kind: "door", wallId, position: .5, width: 1 }];
  construction.transitions = [{ id: "service-stairs", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 } }];
  return { project, construction, activePlaceId: project.places.find(({ constructionId }) => constructionId === construction.id)!.id };
}

function featureLabels(project: ReturnType<typeof createStarterProject>, activePlaceId: string, listCopy: SheetObjectListCopy) {
  return sheetObjectGroups(project, activePlaceId, listCopy).find(({ id }) => id === "features")?.items.map(({ label }) => label) ?? [];
}

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

  it("uses an authored door label in both Polish and English catalogues", () => {
    const { project, construction, activePlaceId } = structuralNamesFixture();
    project.story.objects = [{ ref: { kind: "opening", id: "library-door", scopeId: construction.id }, metadata: { narrativeLabel: "Library threshold" } }];

    expect(featureLabels(project, activePlaceId, workbenchCopy.pl.objectList)).toContain("Library threshold");
    expect(featureLabels(project, activePlaceId, workbenchCopy.en.objectList)).toContain("Library threshold");
    expect(construction.openings[0]?.id).toBe("library-door");
  });

  it("uses an authored stairs label in both Polish and English catalogues", () => {
    const { project, construction, activePlaceId } = structuralNamesFixture();
    project.story.objects = [{ ref: { kind: "transition", id: "service-stairs", scopeId: construction.id }, metadata: { narrativeLabel: "Servants' stairs" } }];

    expect(featureLabels(project, activePlaceId, workbenchCopy.pl.objectList)).toContain("Servants' stairs");
    expect(featureLabels(project, activePlaceId, workbenchCopy.en.objectList)).toContain("Servants' stairs");
    expect(construction.transitions[0]?.footprint).toEqual({ kind: "rectangle", x: 1, y: 1, width: 2, height: 3 });
  });

  it("keeps localized technical fallbacks when no Story label exists", () => {
    const { project, activePlaceId } = structuralNamesFixture();
    const before = structuredClone(project);

    expect(featureLabels(project, activePlaceId, workbenchCopy.pl.objectList)).toEqual(["Drzwi 1", "Schody 1"]);
    expect(featureLabels(project, activePlaceId, workbenchCopy.en.objectList)).toEqual(["Door 1", "Stairs 1"]);
    expect(project).toEqual(before);
  });
});
