import { describe, expect, it } from "vitest";
import { createProjectAtScale, createStarterProject } from "./starter-project";

describe("starter project", () => {
  it("starts coherent: world, location, building, real level and one construction plan", () => {
    const project = createStarterProject("p", "Atlas", "pl");
    expect(project.places.map(({ kind }) => kind)).toEqual(["world", "location", "building", "level", "room"]);
    expect(project.constructions).toHaveLength(1); expect(project.constructions[0].rooms).toHaveLength(1);
    expect(project.places.find(({ kind }) => kind === "location")?.transform).toMatchObject({ x: 61, y: 40 });
    expect(project.places.find(({ kind }) => kind === "level")?.transform).toEqual({ x: 0, y: 0, rotation: 0 });
  });

  it.each([
    ["world", ["world"], 0], ["location", ["location"], 0], ["building", ["building", "level", "room"], 1], ["level", ["level", "room"], 1], ["room", ["standalone-room"], 0],
  ] as const)("creates a clean project starting from %s", (scale, kinds, plans) => {
    const project = createProjectAtScale(`p-${scale}`, "My plan", "en", scale);
    expect(project.places.map(({ kind }) => kind)).toEqual(kinds); expect(project.constructions).toHaveLength(plans);
    expect(project.places[0].name).toBe("My plan");
  });

  it("opens a new world as an unbounded clean sheet", () => {
    const project = createProjectAtScale("blank-world", "Blank world", "en", "world");
    expect(project.places[0].boundary).toBeUndefined();
    expect(project.elements).toEqual([]);
  });
});
