import { describe, expect, it } from "vitest";
import { createBuildingWithDefaultLevel, createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { completeSemanticDraft, keepDraftAsSketch } from "./complete-draft";
import { appendDraftStroke, createSemanticDraft } from "./semantic-draft";
import { regionArea } from "../geometry/region-constraints";

function identity() { let id = 0; return { createId: () => `new-${++id}` }; }
const naming = { nameFor: (subject: string, index: number) => `${subject} ${index}`, levelName: () => "Parter", roomName: (index: number) => `Pomieszczenie ${index}` };

function boxDraft(layer: "terrain" | "boundaries" | "buildings" | "equipment", owner = "map") {
  return appendDraftStroke(createSemanticDraft("draft", layer, `${layer}.test`, owner), { id: "stroke", points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 1 }] });
}

describe("completing a semantic draft", () => {
  it("creates a real building with an explicit automatic level", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 } });
    const result = completeSemanticDraft(project, boxDraft("buildings"), identity(), naming);
    expect(result.state).toBe("created"); expect(result.project.places.map(({ kind }) => kind)).toEqual(["location", "building", "level", "room"]);
    expect(result.project.constructions[0].rooms[0].name).toBe("Pomieszczenie 1");
  });

  it("does not silently discard an unfinished building", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    const draft = appendDraftStroke(createSemanticDraft("draft", "buildings", "building.building", "map"), { id: "line", points: [{ x: 0, y: 0 }, { x: 2, y: 1 }] });
    expect(completeSemanticDraft(project, draft, identity(), naming).state).toBe("incomplete");
  });

  it("offers clipping instead of making a slightly oversized child disappear", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "location", boundary: { kind: "rectangle", x: 0, y: 0, width: 3, height: 3 } });
    const review = completeSemanticDraft(project, boxDraft("equipment"), identity(), naming);
    expect(review.state).toBe("clip-review");
    const accepted = completeSemanticDraft(project, boxDraft("equipment"), identity(), naming, true);
    expect(accepted.state).toBe("created"); expect(accepted.project.elements).toHaveLength(1);
  });

  it("can explicitly preserve loose semantic lines as a sketch overlay", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    const draft = appendDraftStroke(createSemanticDraft("draft", "terrain", "terrain.field", "map"), { id: "line", points: [{ x: 0, y: 0 }, { x: 2, y: 1 }] });
    const result = keepDraftAsSketch(project, draft, identity(), (index) => `Szkic ${index}`);
    expect(result.project.elements[0]).toMatchObject({ layerId: "sketch", belongsToId: "map", name: "Szkic 1" });
  });

  it("creates one semantic object from touching faces in the same drawing", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    let draft = createSemanticDraft("draft", "boundaries", "boundary.place", "map");
    draft = appendDraftStroke(draft, { id: "left", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }] });
    draft = appendDraftStroke(draft, { id: "right", points: [{ x: 4, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 0 }] });
    const result = completeSemanticDraft(project, draft, identity(), naming);
    expect(result.state).toBe("created"); expect(result.project.places.filter(({ kind }) => kind === "location")).toHaveLength(1);
  });

  it("creates separate objects from disconnected closed drawings", () => {
    const project = createPlace(emptyProject("p", "P"), { id: "map", name: "Map", kind: "world" });
    let draft = createSemanticDraft("draft", "boundaries", "boundary.place", "map");
    draft = appendDraftStroke(draft, { id: "left", points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 0 }] });
    draft = appendDraftStroke(draft, { id: "right", points: [{ x: 8, y: 0 }, { x: 11, y: 0 }, { x: 11, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 0 }] });
    const result = completeSemanticDraft(project, draft, identity(), naming);
    expect(result.state).toBe("created"); expect(result.project.places.filter(({ kind }) => kind === "location")).toHaveLength(2);
  });

  it("snaps attached construction surfaces to the active level wall network", () => {
    const project = createBuildingWithDefaultLevel(emptyProject("p", "P"), { id: "house", levelId: "level", constructionId: "plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, { createId: (() => { let id = 0; return () => `id-${++id}`; })() });
    let draft = createSemanticDraft("draft", "construction", "platform.terrace", "level");
    draft = appendDraftStroke(draft, { id: "surface", points: [{ x: .4, y: .3 }, { x: 4.6, y: .3 }, { x: 4.6, y: 3 }, { x: .4, y: 3 }, { x: .4, y: .3 }] });
    const result = completeSemanticDraft(project, draft, identity(), naming);
    expect(result.state).toBe("created"); if (result.state !== "created") return;
    expect(result.project.surfaces[0]?.attachment).toBe("attached");
    expect(result.project.surfaces[0]?.shape).toMatchObject({ kind: "polygon", points: expect.arrayContaining([{ x: .4, y: 0 }, { x: 4.6, y: 0 }]) });
  });

  it("closes an attached balcony against existing construction walls", () => {
    const base = createBuildingWithDefaultLevel(emptyProject("p", "P"), { id: "house", levelId: "level", constructionId: "plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, { createId: (() => { let id = 0; return () => `id-${++id}`; })() }); const level = base.places.find(({ kind }) => kind === "level")!; const document = base.constructions.find(({ id }) => id === level.constructionId)!; const wall = document.walls[0]!;
    let draft = createSemanticDraft("balcony", "construction", "platform.balcony", level.id);
    draft = appendDraftStroke(draft, { id: "rail", points: [wall.start, { x: wall.start.x, y: wall.start.y - 3 }, { x: wall.end.x, y: wall.end.y - 3 }, wall.end] });
    const result = completeSemanticDraft(base, draft, identity(), naming);
    expect(result.state).toBe("created"); expect(result.project.surfaces).toHaveLength(1); expect(result.project.surfaces[0]?.kind).toBe("balcony");
  });

  it.each(["platform", "porch", "terrace", "balcony", "mezzanine", "stage", "custom"] as const)("chooses the smaller supported side for %s", (kind) => {
    const base = createBuildingWithDefaultLevel(emptyProject("p", "P"), { id: "house", levelId: "level", constructionId: "plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 } }, { createId: (() => { let id = 0; return () => `id-${++id}`; })() });
    let draft = createSemanticDraft("u", "construction", `platform.${kind}`, "level");
    draft = appendDraftStroke(draft, { id: "u-line", points: [{ x: 2, y: 0 }, { x: 2, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 0 }] });
    const result = completeSemanticDraft(base, draft, identity(), naming);
    expect(result.state).toBe("created");
    if (result.state !== "created") return;
    expect(result.project.surfaces).toHaveLength(1);
    expect(regionArea(result.project.surfaces[0]!.shape)).toBeLessThan(20);
  });

  it("maps inherited construction walls into a transformed active level before closing an external U", () => {
    const base = createBuildingWithDefaultLevel(emptyProject("p", "P"), { id: "house", levelId: "level", constructionId: "plan", name: "House", levelName: "Ground floor", boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 8 }, transform: { x: 20, y: 10, rotation: 0 } }, { createId: (() => { let id = 0; return () => `id-${++id}`; })() });
    const shifted = { ...base, places: base.places.map((place) => place.id === "house" ? { ...place, constructionId: "plan" } : place.id === "level" ? { ...place, constructionId: undefined, transform: { x: 3, y: 0, rotation: 0 } } : place) };
    let draft = createSemanticDraft("u", "construction", "platform.terrace", "level");
    draft = appendDraftStroke(draft, { id: "u-line", points: [{ x: -3, y: 0 }, { x: -3, y: -3 }, { x: 7, y: -3 }, { x: 7, y: 0 }] });
    const result = completeSemanticDraft(shifted, draft, identity(), naming);
    expect(result.state).toBe("created");
    if (result.state !== "created") return;
    expect(result.project.surfaces).toHaveLength(1);
    expect(regionArea(result.project.surfaces[0]!.shape)).toBeLessThan(40);
  });
});
