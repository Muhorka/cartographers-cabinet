import { describe, expect, it } from "vitest";
import { createProjectAtScale } from "../model/starter-project";
import { createSemanticDraft, appendDraftStroke } from "../draft/semantic-draft";
import { regionArea } from "../geometry/region-constraints";
import { buildDrawingChange } from "../webmcp/agent-drawing-command";
import { applyMapGesture } from "./map-gesture-command";

function fixture() {
  let id = 0;
  const project = createProjectAtScale("small-region", "Small regions", "en", "location");
  project.places[0].boundary = { kind: "rectangle", x: -30, y: -20, width: 60, height: 40 };
  return {
    project,
    identity: { createId: () => `draw-${++id}`, createRoomName: (index: number) => `Room ${index}` },
    naming: { nameFor: () => "Fountain sculpture", levelName: () => "Ground floor" },
  };
}

describe("closed region gestures at sub-metre scale", () => {
  it.each([undefined, 0, 2])("preserves a radius 0.8 circle independently of stroke snapping (%s)", (snapTolerance) => {
    const { project, identity, naming } = fixture();
    const result = applyMapGesture(project, {
      activePlaceId: "small-region:location", layerId: "equipment", subjectId: "equipment.monument", boundaryEditing: false,
      gesture: { instrumentId: "circle", points: [{ x: 0, y: 4 }, { x: .8, y: 4 }], snapTolerance },
    }, identity, naming);
    expect(result.state).toBe("applied");
    const geometry = result.project.elements.at(-1)?.geometry;
    expect(geometry).toEqual({ kind: "region", shape: { kind: "circle", cx: 0, cy: 4, radius: .8 } });
    // Area operations sample curves; require less than 0.5% error, while the stored radius above stays exact.
    if (geometry?.kind === "region") expect(Math.abs(regionArea(geometry.shape) / (Math.PI * .8 ** 2) - 1)).toBeLessThan(.005);
    expect(project.elements).toHaveLength(0);
  });

  it("uses the same precise geometry through the WebMCP command", () => {
    const { project } = fixture();
    const result = buildDrawingChange(project, "small-region:location", {
      layerId: "equipment", subjectId: "equipment.monument", instrumentId: "circle",
      points: [{ x: 0, y: 4 }, { x: .8, y: 4 }], name: "Fountain sculpture",
    });
    expect(result.project.elements.at(-1)).toMatchObject({ name: "Fountain sculpture", geometry: { kind: "region", shape: { kind: "circle", radius: .8 } } });
  });

  it("keeps an unfinished stroke when an independent closed shape is created", () => {
    const { project, identity, naming } = fixture();
    const draft = appendDraftStroke(createSemanticDraft("draft", "equipment", "equipment.monument", "small-region:location"), { id: "stroke", points: [{ x: -10, y: 0 }, { x: -5, y: 0 }] });
    const result = applyMapGesture(project, {
      activePlaceId: "small-region:location", layerId: "equipment", subjectId: "equipment.monument", boundaryEditing: false, pendingDraft: draft,
      gesture: { instrumentId: "circle", points: [{ x: 0, y: 4 }, { x: .8, y: 4 }] },
    }, identity, naming);
    expect(result.state).toBe("applied");
    expect("pendingDraft" in result && result.pendingDraft).toEqual(draft);
  });

  it("still rejects a shape outside its owner and does not mutate the project", () => {
    const { project, identity, naming } = fixture();
    const result = applyMapGesture(project, {
      activePlaceId: "small-region:location", layerId: "equipment", subjectId: "equipment.monument", boundaryEditing: false,
      gesture: { instrumentId: "circle", points: [{ x: 100, y: 4 }, { x: 100.8, y: 4 }] },
    }, identity, naming);
    expect(result).toMatchObject({ state: "blocked", reason: "outside-outline", project });
    expect(result.project.elements).toHaveLength(0);
  });

  it("requires clipping approval for a small circle crossing its owner's boundary", () => {
    const { project, identity, naming } = fixture();
    const result = applyMapGesture(project, {
      activePlaceId: "small-region:location", layerId: "equipment", subjectId: "equipment.monument", boundaryEditing: false,
      gesture: { instrumentId: "circle", points: [{ x: 29.8, y: 4 }, { x: 30.6, y: 4 }] },
    }, identity, naming);
    expect(result.state).toBe("clip-review");
    expect(result.project).toEqual(project);
  });

  it("rejects a zero-radius gesture rather than persisting an invalid object", () => {
    const { project, identity, naming } = fixture();
    const result = applyMapGesture(project, {
      activePlaceId: "small-region:location", layerId: "equipment", subjectId: "equipment.monument", boundaryEditing: false,
      gesture: { instrumentId: "circle", points: [{ x: 0, y: 4 }, { x: 0, y: 4 }] },
    }, identity, naming);
    expect(result.state).toBe("blocked");
    expect(result.project).toEqual(project);
  });
});
