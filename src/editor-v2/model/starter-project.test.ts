import { describe, expect, it } from "vitest";
import { createProjectAtScale, createStarterProject } from "./starter-project";
import { applyMapGesture } from "../drawing/map-gesture-command";

describe("starter project", () => {
  it("starts coherent: world, location, building, real level and one construction plan", () => {
    const project = createStarterProject("p", "Atlas", "pl");
    expect(project.places.map(({ kind }) => kind)).toEqual(["world", "location", "building", "level", "room"]);
    expect(project.constructions).toHaveLength(1); expect(project.constructions[0].rooms).toHaveLength(1);
    expect(project.places.find(({ kind }) => kind === "location")?.transform).toMatchObject({ x: 61, y: 40 });
    expect(project.places.find(({ kind }) => kind === "level")?.transform).toEqual({ x: 0, y: 0, rotation: 0 });
  });

  it.each([
    ["world", ["world"], 0], ["location", ["location"], 0], ["building", ["building", "level"], 1], ["level", ["level"], 1], ["room", ["standalone-room"], 0],
  ] as const)("creates a clean project starting from %s", (scale, kinds, plans) => {
    const project = createProjectAtScale(`p-${scale}`, "My plan", "en", scale);
    expect(project.places.map(({ kind }) => kind)).toEqual(kinds); expect(project.constructions).toHaveLength(plans);
    expect(project.places[0].name).toBe("My plan");
  });

  it.each(["world", "location", "building", "level", "room"] as const)("opens a new %s without generated geometry", (scale) => {
    const project = createProjectAtScale(`blank-${scale}`, `Blank ${scale}`, "en", scale);
    expect(project.places.every(({ boundary }) => boundary === undefined)).toBe(true);
    expect(project.elements).toEqual([]); expect(project.surfaces).toEqual([]);
    expect(project.constructions.every(({ walls, rooms }) => !walls.length && !rooms.length)).toBe(true);
  });

  it.each(["building", "level"] as const)("accepts the first construction stroke on a blank %s plan", (scale) => {
    const project = createProjectAtScale(`draw-${scale}`, `Blank ${scale}`, "en", scale);
    const activePlaceId = project.places.find(({ parentId }) => !parentId)!.id;
    let index = 0;
    const result = applyMapGesture(project, { activePlaceId, layerId: "construction", subjectId: "construction.wall", boundaryEditing: false, gesture: { instrumentId: "line", points: [{ x: -5, y: 0 }, { x: 5, y: 0 }] } }, { createId: () => `wall-${++index}`, createRoomName: (roomIndex) => `Room ${roomIndex}` }, { nameFor: () => "Wall", levelName: () => "Ground floor" });
    expect(result.state).toBe("applied");
    expect(result.project.constructions[0].walls).toHaveLength(1);
  });
});
