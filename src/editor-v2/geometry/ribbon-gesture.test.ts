import { describe, expect, it } from "vitest";
import { applyMapGesture } from "../drawing/map-gesture-command";
import { emptyProject } from "../model/project-model";
import { joinFlowingWater } from "../roads/road-joining";
import { ribbonShape } from "./ribbon-geometry";

const identity = { createId: (() => { let next = 0; return () => `water-${++next}`; })(), createRoomName: (index: number) => `Room ${index}` };
const naming = { nameFor: (subjectId: string, index: number) => `${subjectId}-${index}`, levelName: () => "Ground" };
function projectWithWater() {
  const project = emptyProject("water", "Water");
  project.places = [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: -100, y: -100, width: 300, height: 300 }, tags: [], access: [], properties: {} }];
  return project;
}

describe("flowing-water ribbons", () => {
  it("draws a river as a terrain ribbon without road obstacle routing", () => {
    const result = applyMapGesture(projectWithWater(), { activePlaceId: "world", layerId: "terrain", subjectId: "terrain.river", widthMeters: 6, boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }] } }, identity, naming);
    expect(result.state).toBe("applied"); if (result.state !== "applied") return;
    const river = result.project.elements[0]!; expect(river).toMatchObject({ layerId: "terrain", subjectId: "terrain.river", widthMeters: 6 }); expect(ribbonShape(river)).toBeDefined();
  });

  it("joins river and stream endpoints while retaining the first subject and profile", () => {
    const project = projectWithWater(); project.elements = [
      { id: "river", belongsToId: "world", name: "River", layerId: "terrain", subjectId: "terrain.river", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false }, widthMeters: 5, widthProfile: [{ t: 0, left: 2, right: 3 }, { t: 1, left: 3, right: 4 }], ribbonCutouts: [{ kind: "rectangle", x: 2, y: -1, width: 1, height: 1 }], visible: true, locked: false, tags: ["river"], access: [], properties: {} },
      { id: "stream", belongsToId: "world", name: "Stream", layerId: "terrain", subjectId: "terrain.stream", geometry: { kind: "path", points: [{ x: 10, y: 0 }, { x: 20, y: 2 }], closed: false }, widthMeters: 2, widthProfile: [{ t: 0, left: 1, right: 1 }, { t: 1, left: 1.5, right: 1.5 }], ribbonCutouts: [{ kind: "rectangle", x: 12, y: -1, width: 1, height: 1 }], visible: true, locked: false, tags: ["stream"], access: [], properties: { depth: 2 } },
    ];
    const source = structuredClone(project); const result = joinFlowingWater(project, ["river", "stream"]);
    expect(result.state).toBe("joined"); if (result.state !== "joined") return;
    expect(result.project.elements).toHaveLength(1); expect(result.project.elements[0]).toMatchObject({ subjectId: "terrain.river", name: "River", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 2 }] }, tags: ["river", "stream"] }); expect(result.project.elements[0]?.ribbonCutouts).toHaveLength(2); expect(project).toEqual(source);
  });
});
