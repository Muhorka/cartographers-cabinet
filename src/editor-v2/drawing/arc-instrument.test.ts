import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { applyMapGesture, saveGestureDraftAsSketch } from "./map-gesture-command";

function helpers() {
  let id = 0;
  return {
    identity: { createId: () => `arc-${++id}`, createRoomName: (index: number) => `Room ${index}` },
    naming: { nameFor: (subject: string, index: number) => `${subject} ${index}`, levelName: () => "Ground floor" },
  };
}

describe("three-point arc instrument", () => {
  it("turns an arc into ordinary construction wall segments", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const result = applyMapGesture(project, { activePlaceId: "project:level", layerId: "construction", subjectId: "construction.partition", boundaryEditing: false, gesture: { instrumentId: "arc", points: [{ x: -8, y: -6 }, { x: 0, y: 3 }, { x: 8, y: -6 }] } }, identity, naming);
    expect(result.state).toBe("applied");
    expect(result.project.constructions[0].walls.length).toBeGreaterThan(project.constructions[0].walls.length);
    expect(result.project.constructions[0].walls.every(({ start, end }) => start && end)).toBe(true);
  });

  it("persists an unfinished arc draft through the existing sketch-save path", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity } = helpers();
    const draft = { instrumentId: "arc" as const, points: [{ x: 4, y: 4 }, { x: 10, y: 10 }, { x: 16, y: 4 }] };
    const saved = saveGestureDraftAsSketch(project, "project:world", draft, identity, "Draft arc");
    expect(saved.elements.at(-1)).toMatchObject({ name: "Draft arc", geometry: { kind: "bezier", closed: false, nodes: expect.any(Array) } });
  });

  it("uses the shared eraser to cut the resulting Bézier arc", () => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const drawn = applyMapGesture(project, { activePlaceId: "project:world", layerId: "sketch", subjectId: "sketch.stroke", boundaryEditing: false, gesture: { instrumentId: "arc", points: [{ x: 4, y: 4 }, { x: 10, y: 10 }, { x: 16, y: 4 }] } }, identity, naming);
    const erased = applyMapGesture(drawn.project, { activePlaceId: "project:world", layerId: "sketch", subjectId: "sketch.stroke", boundaryEditing: false, gesture: { instrumentId: "erase", points: [{ x: 10, y: 8 }, { x: 10, y: 12 }], hitRadius: .5 } }, identity, naming);
    expect(erased.state).toBe("applied");
    expect(erased.project.elements.every(({ geometry }) => geometry.kind === "path")).toBe(true);
  });

  it.each([
    ["terrain", "terrain.field", "project:world"],
    ["buildings", "building.building", "project:place"],
  ] as const)("joins an arc and ordinary line strokes into one closed %s", (layerId, subjectId, activePlaceId) => {
    const project = createStarterProject("project", "Project", "en"); const { identity, naming } = helpers();
    const strokes = [
      { instrumentId: "arc" as const, points: [{ x: -8, y: 0 }, { x: 0, y: 8 }, { x: 8, y: 0 }] },
      { instrumentId: "line" as const, points: [{ x: 8, y: 0 }, { x: 8, y: -8 }] },
      { instrumentId: "line" as const, points: [{ x: 8, y: -8 }, { x: -8, y: -8 }] },
      { instrumentId: "line" as const, points: [{ x: -8, y: -8 }, { x: -8, y: 0 }] },
    ];
    let current = project; let pendingDraft: import("../draft/semantic-draft").SemanticDraft | undefined;
    for (const gesture of strokes) {
      const result = applyMapGesture(current, { activePlaceId, layerId, subjectId, boundaryEditing: false, pendingDraft, gesture }, identity, naming);
      current = result.project; pendingDraft = "pendingDraft" in result ? result.pendingDraft : undefined;
    }
    if (layerId === "terrain") expect(current.elements.filter(({ layerId: itemLayer }) => itemLayer === "terrain")).toHaveLength(1);
    else expect(current.places.filter(({ kind }) => kind === "building")).toHaveLength(2);
    expect(pendingDraft).toBeUndefined();
  });
});
