import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createConstructionDocument } from "../construction/construction-document";
import { emptyProject } from "../model/project-model";
import type { SheetObjectListCopy } from "../components/sheet-object-list";
import { createProjectStoryLabelResolver, storyObjectBaseDisplayName, storyObjectDisplayName } from "./object-display-name";
import { parseProjectFile } from "../persistence/project-file";
import { createProjectStoryObjectResolver } from "./project-effective";
import { workbenchCopy } from "../i18n/workbench-copy";

const copy: SheetObjectListCopy = {
  title: "Objects", places: "Places", terrain: "Terrain", equipment: "Equipment", sketch: "Sketch", rooms: "Rooms", walls: "Walls", features: "Features", empty: "Empty", noResults: "None", search: "Search", show: "Show", hide: "Hide", lock: "Lock", unlock: "Unlock",
  wallName: (index) => `Wall ${index}`, openingName: (kind, index) => `${kind} ${index}`, stairsName: (index) => `Stairs ${index}`, elevatorName: (index) => `Lift ${index}`,
};
const polish: SheetObjectListCopy = { ...copy, wallName: (index) => `Ściana ${index}`, openingName: (kind, index) => `${kind} ${index}`, stairsName: (index) => `Schody ${index}`, elevatorName: (index) => `Winda ${index}` };

function fixture() {
  const project = emptyProject("names", "Names"); const walls = [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "boundary" as const, thickness: .2 }];
  const first = createConstructionDocument("plan-a", walls, { createId: () => "room-a", createName: () => "Room" }); const second = createConstructionDocument("plan-b", walls, { createId: () => "room-b", createName: () => "Room" });
  for (const construction of [first, second]) { construction.openings = [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1 }, { id: "window", kind: "window", wallId: "wall", position: .8, width: 1 }]; construction.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 1, height: 1 } }, { id: "lift", kind: "elevator", footprint: { kind: "rectangle", x: 2, y: 1, width: 1, height: 1 } }]; }
  project.constructions.push(first, second); project.places.push({ id: "ground", name: "Ground", kind: "level", constructionId: "plan-a", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }, { id: "upper", name: "Upper", kind: "level", constructionId: "plan-b", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }); return project;
}

describe("story object display names", () => {
  it("uses the sheet catalogue copy and exact construction indices", () => {
    const project = fixture(); project.constructions = project.constructions.slice(0, 1); project.places = project.places.slice(0, 1);
    expect(storyObjectDisplayName(project, { ref: { kind: "wall", id: "wall", scopeId: "plan-a" }, name: "Wall wall" }, copy)).toBe("Wall 1");
    expect(storyObjectDisplayName(project, { ref: { kind: "opening", id: "window", scopeId: "plan-a" }, name: "window window" }, copy)).toBe("window 2");
    expect(storyObjectDisplayName(project, { ref: { kind: "transition", id: "lift", scopeId: "plan-a" }, name: "elevator lift" }, copy)).toBe("Lift 2");
    expect(storyObjectDisplayName(project, { ref: { kind: "place", id: "ground" }, name: "Ground" }, copy)).toBe("Ground");
  });

  it("disambiguates duplicate scoped ids by the owning level and preserves authored names", () => {
    const project = fixture();
    expect(storyObjectDisplayName(project, { ref: { kind: "wall", id: "wall", scopeId: "plan-b" }, name: "Wall wall", ownerPlaceId: "upper" }, copy)).toBe("Wall 1 · Upper");
    expect(storyObjectDisplayName(project, { ref: { kind: "opening", id: "door", scopeId: "plan-a" }, name: "Front door", metadata: { narrativeLabel: "Front door" } }, copy)).toBe("Front door");
    expect(storyObjectDisplayName(project, { ref: { kind: "opening", id: "door", scopeId: "plan-a" }, name: "Front door", metadata: { narrativeLabel: "Front door" } }, copy)).not.toContain("Door 1");
    expect(storyObjectDisplayName(project, { ref: { kind: "transition", id: "stairs", scopeId: "plan-a" }, name: "stairs stairs" }, polish)).toBe("Schody 1 · Ground");
    expect(storyObjectDisplayName(project, { ref: { kind: "transition", id: "stairs", scopeId: "plan-a" }, name: "Emergency stairs" }, polish)).toBe("Emergency stairs");
  });

  it("resolves authored labels through level scope aliases without crossing construction scopes", () => {
    const project = fixture();
    project.story.objects = [
      { ref: { kind: "opening", id: "door", scopeId: "ground" }, metadata: { narrativeLabel: "Front threshold" } },
      { ref: { kind: "transition", id: "stairs", scopeId: "upper" }, metadata: { narrativeLabel: "Private stair" } },
    ];
    const label = createProjectStoryLabelResolver(project);

    expect(label({ kind: "opening", id: "door", scopeId: "plan-a" }, "Door 1")).toBe("Front threshold");
    expect(label({ kind: "opening", id: "door", scopeId: "plan-b" }, "Door 1 · Upper")).toBe("Door 1 · Upper");
    expect(label({ kind: "transition", id: "stairs", scopeId: "plan-b" }, "Stairs 1")).toBe("Private stair");
    expect(project.constructions.map(({ id }) => id)).toEqual(["plan-a", "plan-b"]);
  });

  it("does not merge equal raw transition ids across distant scopes or different kinds", () => {
    const project = fixture(); const levels = ["ground", "upper"];
    project.constructions[0]!.transitions = [
      { id: "shared", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, sourceLevelId: "ground", connectedLevelIds: levels },
      { id: "mixed", kind: "elevator", footprint: { kind: "rectangle", x: 4, y: 1, width: 2, height: 3 }, sourceLevelId: "ground", connectedLevelIds: levels },
    ];
    project.constructions[1]!.transitions = [
      { id: "shared", kind: "stairs", footprint: { kind: "rectangle", x: 10, y: 1, width: 2, height: 3 }, sourceLevelId: "upper", connectedLevelIds: levels },
      { id: "mixed", kind: "stairs", footprint: { kind: "rectangle", x: 4, y: 1, width: 2, height: 3 }, sourceLevelId: "upper", connectedLevelIds: levels },
    ];
    project.story.objects = [
      { ref: { kind: "transition", id: "shared", scopeId: "plan-a" }, metadata: { narrativeLabel: "West stair" } },
      { ref: { kind: "transition", id: "mixed", scopeId: "plan-a" }, metadata: { narrativeLabel: "Service lift" } },
    ];
    const label = createProjectStoryLabelResolver(project);

    expect(label({ kind: "transition", id: "shared", scopeId: "plan-a" }, "Stairs 1")).toBe("West stair");
    expect(label({ kind: "transition", id: "shared", scopeId: "plan-b" }, "Stairs 1")).toBe("Stairs 1");
    expect(label({ kind: "transition", id: "mixed", scopeId: "plan-a" }, "Lift 2")).toBe("Service lift");
    expect(label({ kind: "transition", id: "mixed", scopeId: "plan-b" }, "Stairs 2")).toBe("Stairs 2");
  });

  it.each([copy, polish])("shares a connected stair name and technical ordinal across level landings", (localized) => {
    const project = fixture();
    const atticConstruction = createConstructionDocument("plan-c", project.constructions[0]!.walls, { createId: () => "room-c", createName: () => "Room" });
    project.constructions.push(atticConstruction);
    project.places.push({ id: "attic", name: "Attic", kind: "level", constructionId: "plan-c", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    const levels = ["ground", "upper", "attic"];
    project.constructions[0]!.transitions = [
      { id: "other", kind: "stairs", footprint: { kind: "rectangle", x: 4, y: 1, width: 1, height: 1 }, sameLevelRise: true },
      { id: "west-ground", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, sourceLevelId: "ground", connectedLevelIds: levels },
      { id: "east-ground", kind: "stairs", footprint: { kind: "rectangle", x: 8, y: 1, width: 2, height: 3 }, sourceLevelId: "ground", connectedLevelIds: levels },
    ];
    project.constructions[1]!.transitions = [
      { id: "west-upper", kind: "stairs", footprint: { kind: "rectangle", x: 1.1, y: 1, width: 2, height: 3 }, sourceLevelId: "upper", connectedLevelIds: levels },
      { id: "east-upper", kind: "stairs", footprint: { kind: "rectangle", x: 8, y: 1, width: 2, height: 3 }, sourceLevelId: "upper", connectedLevelIds: levels },
    ];
    project.constructions[2]!.transitions = [
      { id: "west-attic", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, sourceLevelId: "attic", connectedLevelIds: levels },
      { id: "east-attic", kind: "stairs", footprint: { kind: "rectangle", x: 8, y: 1, width: 2, height: 3 }, sourceLevelId: "attic", connectedLevelIds: levels },
    ];
    project.story.objects = [
      { ref: { kind: "transition", id: "west-ground", scopeId: "plan-a" }, metadata: { narrativeLabel: "Service stair" } },
      { ref: { kind: "transition", id: "east-ground", scopeId: "plan-a" }, metadata: { narrativeLabel: "Grand stair" } },
    ];
    const label = createProjectStoryLabelResolver(project);
    const ground = { ref: { kind: "transition" as const, id: "west-ground", scopeId: "plan-a" }, name: "Service stair", metadata: { narrativeLabel: "Service stair" } };
    const upper = { ref: { kind: "transition" as const, id: "west-upper", scopeId: "plan-b" }, name: "stairs west-upper" };
    const attic = { ref: { kind: "transition" as const, id: "west-attic", scopeId: "plan-c" }, name: "stairs west-attic" };

    expect(label(ground.ref, localized.stairsName(2))).toBe("Service stair");
    expect(label(upper.ref, localized.stairsName(1))).toBe("Service stair");
    expect(label({ kind: "transition", id: "east-upper", scopeId: "plan-b" }, localized.stairsName(2))).toBe("Grand stair");
    expect(storyObjectBaseDisplayName(project, upper, localized)).toBe("Service stair");
    expect(storyObjectBaseDisplayName(project, attic, localized)).toBe("Service stair");
    expect(storyObjectDisplayName(project, ground, localized)).toBe("Service stair — Ground");
    expect(storyObjectDisplayName(project, upper, localized)).toBe("Service stair — Upper");
    expect(storyObjectDisplayName(project, upper, localized)).not.toMatch(/Stairs|Schody|\(.*\d+\)/);
    expect(ground.ref.id).toBe("west-ground"); expect(upper.ref.id).toBe("west-upper");

    project.story.objects.push({ ref: upper.ref, metadata: { narrativeLabel: "Private stair" } });
    const overridden = createProjectStoryLabelResolver(project);
    expect(overridden(upper.ref, localized.stairsName(1))).toBe("Private stair");
    expect(overridden(attic.ref, localized.stairsName(1))).toBe("Service stair");
  });

  it.each([copy, polish])("uses one source ordinal for an unnamed connected stair", (localized) => {
    const project = fixture();
    const levels = ["ground", "upper"];
    project.constructions[0]!.transitions = [
      { id: "other", kind: "stairs", footprint: { kind: "rectangle", x: 4, y: 1, width: 1, height: 1 }, sameLevelRise: true },
      { id: "west-ground", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, sourceLevelId: "ground", connectedLevelIds: levels },
      { id: "east-ground", kind: "stairs", footprint: { kind: "rectangle", x: 8, y: 1, width: 2, height: 3 }, sourceLevelId: "ground", connectedLevelIds: levels },
    ];
    project.constructions[1]!.transitions = [
      { id: "west-upper", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, sourceLevelId: "upper", connectedLevelIds: levels },
      { id: "east-upper", kind: "stairs", footprint: { kind: "rectangle", x: 8, y: 1, width: 2, height: 3 }, sourceLevelId: "upper", connectedLevelIds: levels },
    ];
    const label = createProjectStoryLabelResolver(project);
    const ground = { ref: { kind: "transition" as const, id: "west-ground", scopeId: "plan-a" }, name: "stairs west-ground" };
    const upper = { ref: { kind: "transition" as const, id: "west-upper", scopeId: "plan-b" }, name: "stairs west-upper" };
    const fallback = localized.stairsName(2);

    expect(label(ground.ref, localized.stairsName(2))).toBe(fallback);
    expect(label(upper.ref, localized.stairsName(1))).toBe(fallback);
    expect(storyObjectDisplayName(project, ground, localized)).toBe(`${fallback} — Ground`);
    expect(storyObjectDisplayName(project, upper, localized)).toBe(`${fallback} — Upper`);
    expect(label({ kind: "transition", id: "east-upper", scopeId: "plan-b" }, localized.stairsName(2))).toBe(localized.stairsName(3));
  });

  it("resolves both named staircase shafts across all six landings in the public Residence fixture", () => {
    const source = readFileSync("public/examples/residence-of-the-silver-lindens.cartographer.json", "utf8");
    const project = parseProjectFile(source).project; const label = createProjectStoryLabelResolver(project); const resolve = createProjectStoryObjectResolver(project, {});
    const landings = project.constructions.flatMap((construction) => construction.transitions.map((transition, index) => ({ construction, transition, index })))
      .filter(({ transition }) => transition.connectedLevelIds?.length === 3);
    const baseNames = landings.map(({ construction, transition, index }) => label(
      { kind: "transition", id: transition.id, scopeId: construction.id }, workbenchCopy.en.objectList.stairsName(index + 1),
    ));
    const listNames = landings.map(({ construction, transition }) => {
      const object = resolve({ kind: "transition", id: transition.id, scopeId: construction.id });
      return object && storyObjectDisplayName(project, object, workbenchCopy.en.objectList);
    });

    expect(landings).toHaveLength(6);
    expect(baseNames.filter((name) => name === "Service Staircase")).toHaveLength(3);
    expect(baseNames.filter((name) => name === "Grand Staircase")).toHaveLength(3);
    for (const level of ["Ground Floor — State Rooms", "First Floor — Private Apartments", "Second Floor — Guest Apartments and Studios"]) {
      expect(listNames).toContain(`Service Staircase — ${level}`);
      expect(listNames).toContain(`Grand Staircase — ${level}`);
    }
    expect(new Set(landings.map(({ transition }) => transition.id))).toHaveProperty("size", 6);
  });

  it("resolves a large sparse transition catalogue through bounded spatial neighbours", () => {
    const project = emptyProject("many-stairs", "Many stairs");
    for (let index = 0; index < 500; index += 1) {
      const construction = createConstructionDocument(`plan-${index}`, [], { createId: () => `room-${index}`, createName: () => "Room" });
      const levelId = `level-${index}`;
      construction.transitions = [{ id: `stairs-${index}`, kind: "stairs", footprint: { kind: "rectangle", x: index * 2, y: 0, width: 1, height: 1 }, sourceLevelId: levelId, connectedLevelIds: ["shared-level", levelId] }];
      project.constructions.push(construction);
      project.places.push({ id: levelId, name: `Level ${index}`, kind: "level", constructionId: construction.id, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    }

    const label = createProjectStoryLabelResolver(project);
    expect(label({ kind: "transition", id: "stairs-499", scopeId: "plan-499" }, "Stairs 1")).toBe("Stairs 1");
  }, 2_000);
});
