import { describe, expect, it } from "vitest";
import { createConstructionDocument } from "../construction/construction-document";
import { emptyProject } from "../model/project-model";
import type { SheetObjectListCopy } from "../components/sheet-object-list";
import { storyObjectDisplayName } from "./object-display-name";

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
    expect(storyObjectDisplayName(project, { ref: { kind: "transition", id: "stairs", scopeId: "plan-a" }, name: "stairs stairs" }, polish)).toBe("Schody 1 · Ground");
    expect(storyObjectDisplayName(project, { ref: { kind: "transition", id: "stairs", scopeId: "plan-a" }, name: "Emergency stairs" }, polish)).toBe("Emergency stairs");
  });
});
