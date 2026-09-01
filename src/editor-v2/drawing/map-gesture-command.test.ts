import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { applyMapGesture } from "./map-gesture-command";
import { shapePoints } from "../geometry/region-constraints";
import { createLevelForBuilding } from "../model/hierarchy-operations";

function helpers() {
  let id = 0;
  return {
    identity: { createId: () => `new-${++id}`, createRoomName: (index: number) => `Room ${index}` },
    naming: { nameFor: (subject: string, index: number) => `${subject} ${index}`, levelName: () => "Ground floor" },
  };
}

describe("map gesture command", () => {
  it("creates a named terrain region with a real owner", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:world", layerId: "terrain", subjectId: "terrain.field", boundaryEditing: false, gesture: { instrumentId: "rectangle", points: [{ x: 2, y: 2 }, { x: 10, y: 8 }] } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.elements.at(-1)).toMatchObject({ name: "terrain.field 1", belongsToId: "project:world", layerId: "terrain" });
  });

  it("keeps separate pencil strokes until they close one semantic building", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    let draft;
    let current = project;
    const strokes = [
      [{ x: 20, y: 0 }, { x: 30, y: 0 }],
      [{ x: 30, y: 0 }, { x: 30, y: 10 }],
      [{ x: 30, y: 10 }, { x: 20, y: 10 }],
      [{ x: 20, y: 10 }, { x: 20, y: 0 }],
    ];
    for (const points of strokes) {
      const result = applyMapGesture(current, { activePlaceId: "project:place", layerId: "buildings", subjectId: "building.building", boundaryEditing: false, pendingDraft: draft, gesture: { instrumentId: "line", points } }, identity, naming);
      current = result.project;
      draft = "pendingDraft" in result ? result.pendingDraft : undefined;
    }
    expect(current.places.filter(({ kind }) => kind === "building")).toHaveLength(2);
    expect(current.places.filter(({ kind }) => kind === "level")).toHaveLength(2);
  });

  it("closes a visible hand-drawn gap when the adjustable correction is enabled", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    let draft; let current = project;
    const strokes = [
      [{ x: 20, y: 0 }, { x: 30, y: 0 }],
      [{ x: 30, y: 0 }, { x: 30, y: 10 }],
      [{ x: 30, y: 10 }, { x: 20, y: 10 }],
      [{ x: 20, y: 10 }, { x: 20, y: 1.8 }],
    ];
    for (const points of strokes) {
      const result = applyMapGesture(current, { activePlaceId: "project:place", layerId: "buildings", subjectId: "building.building", boundaryEditing: false, pendingDraft: draft, gesture: { instrumentId: "line", points, snapTolerance: 2 } }, identity, naming);
      current = result.project; draft = "pendingDraft" in result ? result.pendingDraft : undefined;
    }
    expect(current.places.filter(({ kind }) => kind === "building")).toHaveLength(2);
  });

  it("closes four imprecise line strokes like the boundary drawn in the browser", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    let draft; let current = project;
    const strokes = [
      [{ x: 1518.67, y: -20.68 }, { x: 1432.84, y: 375.47 }],
      [{ x: 1518.20, y: -18.52 }, { x: 1848.79, y: 104.77 }],
      [{ x: 1846.97, y: 104.09 }, { x: 1776.16, y: 474.50 }],
      [{ x: 1435.03, y: 365.33 }, { x: 1777.58, y: 467.06 }],
    ];
    for (const points of strokes) {
      const result = applyMapGesture(current, { activePlaceId: "project:world", layerId: "boundaries", subjectId: "boundary.place", boundaryEditing: false, pendingDraft: draft, gesture: { instrumentId: "line", points, snapTolerance: 50 } }, identity, naming);
      current = result.project; draft = "pendingDraft" in result ? result.pendingDraft : undefined;
    }
    expect(current.places.filter(({ kind }) => kind === "location")).toHaveLength(2);
    expect(draft).toBeUndefined();
  });

  it.each([
    ["terrain", "terrain.field", "project:world"],
    ["boundaries", "boundary.place", "project:world"],
    ["buildings", "building.building", "project:place"],
    ["equipment", "equipment.furniture", "project:level"],
  ] as const)("builds one closed object from mixed pencil and line strokes on %s", (layerId, subjectId, activePlaceId) => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const first = applyMapGesture(project, { activePlaceId, layerId, subjectId, boundaryEditing: false, gesture: { instrumentId: "pencil", points: [{ x: -5, y: -4 }, { x: 5, y: -4 }, { x: 5, y: 4 }, { x: -5, y: 4 }], snapTolerance: 1 } }, identity, naming);
    const second = applyMapGesture(first.project, { activePlaceId, layerId, subjectId, boundaryEditing: false, pendingDraft: "pendingDraft" in first ? first.pendingDraft : undefined, gesture: { instrumentId: "line", points: [{ x: -4.7, y: 4.2 }, { x: -4.8, y: -4.2 }], snapTolerance: 1 } }, identity, naming);
    expect(second.state).toBe("applied");
    expect("pendingDraft" in second ? second.pendingDraft : undefined).toBeUndefined();
  });

  it("allows overlapping buildings to be positioned before the deferred merge decision", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:place", layerId: "buildings", subjectId: "building.building", boundaryEditing: false, gesture: { instrumentId: "rectangle", points: [{ x: -8, y: -6 }, { x: 8, y: 6 }] } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.places.filter(({ kind }) => kind === "building")).toHaveLength(2);
  });

  it("adds a partition to the real level plan and derives rooms", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:building", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: 0, y: -11 }, { x: 0, y: 11 }] } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.constructions[0].rooms).toHaveLength(2);
  });

  it("joins human-imprecise wall strokes to an existing endpoint", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const first = applyMapGesture(project, { activePlaceId: "project:building", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: 0, y: -11 }, { x: 0, y: 4 }] } }, identity, naming);
    const second = applyMapGesture(first.project, { activePlaceId: "project:building", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: .45, y: 4.35 }, { x: .45, y: 11 }] } }, identity, naming);
    expect(second.state).toBe("applied");
    expect(second.project.constructions[0].rooms).toHaveLength(2);
  });

  it("keeps a free-standing wall run without requiring contact with another wall", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:level", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "wall-run", points: [{ x: -8, y: -5 }, { x: -2, y: -1 }, { x: 4, y: -5 }] } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.constructions[0].walls.length).toBeGreaterThan(project.constructions[0].walls.length);
  });

  it("derives a room from three separately drawn walls", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    let current = project;
    for (const points of [
      [{ x: -8, y: -5 }, { x: 0, y: 5 }],
      [{ x: 0, y: 5 }, { x: 8, y: -5 }],
      [{ x: 8, y: -5 }, { x: -8, y: -5 }],
    ]) current = applyMapGesture(current, { activePlaceId: "project:level", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "line", points } }, identity, naming).project;
    expect(current.constructions[0].rooms).toHaveLength(2);
  });

  it("places a door without requiring an unrelated pencil gesture", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:building", layerId: "openings", subjectId: "opening.door", boundaryEditing: false, gesture: { instrumentId: "place", points: [{ x: -8, y: -11 }] } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.constructions[0].openings).toHaveLength(1);
  });

  it("requires an explicit destination before placing stairs", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:level", layerId: "openings", subjectId: "opening.stairs", boundaryEditing: false, gesture: { instrumentId: "place", points: [{ x: 0, y: 0 }] } }, identity, naming);
    expect(result.state).toBe("transition-config-required");
    expect(result.project).toBe(project);
  });

  it("connects exactly the selected levels, including a basement", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const basement = createLevelForBuilding(project, { id: "basement", constructionId: "basement-plan", buildingId: "project:building", name: "Basement", position: "below" }, identity);
    const withUpper = createLevelForBuilding(basement, { id: "upper", constructionId: "upper-plan", buildingId: "project:building", name: "Upper", position: "above" }, identity);
    const result = applyMapGesture(withUpper, { activePlaceId: "project:level", layerId: "openings", subjectId: "opening.stairs", boundaryEditing: false, gesture: { instrumentId: "place", points: [{ x: 0, y: 0 }] }, transition: { sourceLevelId: "project:level", targetLevelId: "basement", connectedLevelIds: ["project:level", "basement"], style: "spiral", direction: -1 } }, identity, naming);
    expect(result.state).toBe("applied");
    const level = result.project.places.find(({ id }) => id === "project:level")!;
    const upper = result.project.places.find(({ id }) => id === "upper")!;
    expect(result.project.constructions.find(({ id }) => id === level.constructionId)?.transitions.at(-1)).toMatchObject({ connectedLevelIds: ["project:level", "basement"], style: "spiral", direction: -1 });
    expect(result.project.constructions.find(({ id }) => id === upper.constructionId)?.transitions).toHaveLength(0);
  });

  it("does not place equipment beyond the outline of the opened place", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:level", layerId: "equipment", subjectId: "equipment.marker", boundaryEditing: false, gesture: { instrumentId: "point", points: [{ x: 100, y: 100 }] } }, identity, naming);
    expect(result).toMatchObject({ state: "blocked", reason: "outside-outline" });
  });

  it("assigns an object placed on a level to the room that contains it", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:level", layerId: "equipment", subjectId: "equipment.marker", boundaryEditing: false, gesture: { instrumentId: "point", points: [{ x: 0, y: 0 }] } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.elements.at(-1)?.belongsToId).toBe(project.constructions[0].rooms[0].id);
  });

  it("lets an entered room edit its own walls but not openings in a neighbouring room", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const divided = applyMapGesture(project, { activePlaceId: "project:level", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: 0, y: -11 }, { x: 0, y: 11 }] } }, identity, naming);
    expect(divided.state).toBe("applied");
    const leftRoom = divided.project.places.find(({ kind, boundary }) => kind === "room" && boundary && Math.max(...shapePoints(boundary).map(({ x }) => x)) <= 0)!;
    const ownDoor = applyMapGesture(divided.project, { activePlaceId: leftRoom.id, layerId: "openings", subjectId: "opening.door", boundaryEditing: false, gesture: { instrumentId: "place", points: [{ x: -16, y: 0 }] } }, identity, naming);
    expect(ownDoor.state).toBe("applied");
    const neighbourDoor = applyMapGesture(ownDoor.project, { activePlaceId: leftRoom.id, layerId: "openings", subjectId: "opening.door", boundaryEditing: false, gesture: { instrumentId: "place", points: [{ x: 16, y: 0 }] } }, identity, naming);
    expect(neighbourDoor).toMatchObject({ state: "blocked", reason: "outside-outline" });
  });

  it("requests clipping instead of dropping a wall that overshoots the outline", () => {
    const project = createStarterProject("project", "Project", "en");
    const { identity, naming } = helpers();
    const input = { activePlaceId: "project:building", layerId: "construction" as const, subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "line" as const, points: [{ x: 0, y: -15 }, { x: 0, y: 15 }] } };
    expect(applyMapGesture(project, input, identity, naming).state).toBe("clip-review");
    expect(applyMapGesture(project, { ...input, acceptClip: true }, identity, naming).state).toBe("applied");
  });

  it.each(["platform", "porch", "terrace", "balcony", "mezzanine", "stage", "custom"] as const)("creates %s from three incremental open strokes", (kind) => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const strokes = [
      [{ x: -10, y: -11 }, { x: -10, y: -15 }],
      [{ x: -10, y: -15 }, { x: 10, y: -15 }],
      [{ x: 10, y: -15 }, { x: 10, y: -11 }],
    ];
    let current = project; let pendingDraft: import("../draft/semantic-draft").SemanticDraft | undefined;
    for (const points of strokes) {
      const result = applyMapGesture(current, { activePlaceId: "project:level", layerId: "construction", subjectId: `platform.${kind}`, boundaryEditing: false, pendingDraft, gesture: { instrumentId: "line", points } }, identity, naming);
      current = result.project; pendingDraft = "pendingDraft" in result ? result.pendingDraft : undefined;
    }
    expect(current.surfaces).toHaveLength(1);
    expect(pendingDraft).toBeUndefined();
    expect(current.surfaces[0]).toMatchObject({ kind, attachment: kind === "porch" || kind === "terrace" || kind === "balcony" ? "attached" : "free" });
  });

  it("stores the pen as a real cubic curve with handles", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const nodes = [{ anchor: { x: 4, y: 4 }, outHandle: { x: 7, y: 1 } }, { anchor: { x: 12, y: 7 }, inHandle: { x: 9, y: 10 } }];
    const result = applyMapGesture(project, { activePlaceId: "project:world", layerId: "sketch", subjectId: "sketch.stroke", boundaryEditing: false, gesture: { instrumentId: "pen", points: nodes.map(({ anchor }) => anchor), bezierNodes: nodes, closed: false } }, identity, naming);
    expect(result.state).toBe("applied"); expect(result.project.elements.at(-1)?.geometry).toEqual({ kind: "bezier", nodes, closed: false });
  });

  it("stores a sketch arc as ordinary editable Bézier geometry", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const points = [{ x: 4, y: 4 }, { x: 10, y: 10 }, { x: 16, y: 4 }];
    const result = applyMapGesture(project, { activePlaceId: "project:world", layerId: "sketch", subjectId: "sketch.stroke", boundaryEditing: false, gesture: { instrumentId: "arc", points, closed: false } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.elements.at(-1)?.geometry).toMatchObject({ kind: "bezier", closed: false, nodes: expect.any(Array) });
  });

  it("creates a note from the drawn rectangle while preserving its text as editable data", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:world", layerId: "sketch", subjectId: "sketch.note", boundaryEditing: false, gesture: { instrumentId: "note", points: [{ x: 12, y: 18 }, { x: 42, y: 30 }] } }, identity, naming);
    expect(result.project.elements.at(-1)?.geometry).toEqual({ kind: "note", at: { x: 12, y: 18 }, text: "sketch.note 1", width: 30, height: 12 });
  });
});
