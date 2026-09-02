import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../../model/project-model";
import { endpointForOption, endpointOptionId, storyRouteEndpointOptions } from "./endpoints";

function fixture(): EditorProject {
  const project = emptyProject("route-endpoints", "Route endpoints");
  project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 30, height: 20 }, tags: [], access: [], properties: {} });
  return project;
}

describe("story route endpoint options", () => {
  it("keeps ordinary places and adds authored terrain with its owner frame", () => {
    const project = fixture();
    project.elements.push({ id: "forest", belongsToId: "world", name: "Las", layerId: "terrain", subjectId: "terrain.forest", geometry: { kind: "region", shape: { kind: "rectangle", x: 4, y: 5, width: 8, height: 6 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const options = storyRouteEndpointOptions(project);
    expect(options.map(({ id }) => id)).toEqual(["world", "terrain:forest"]);
    expect(endpointForOption(options[1]!)).toEqual({ placeId: "world", point: { x: 8, y: 8 } });
  });

  it("uses a water ribbon centre as an endpoint without changing planner semantics", () => {
    const project = fixture();
    project.elements.push({ id: "river", belongsToId: "world", name: "Rzeka", layerId: "terrain", subjectId: "terrain.river", geometry: { kind: "path", points: [{ x: 10, y: 0 }, { x: 10, y: 20 }], closed: false }, widthMeters: 2, visible: true, locked: false, tags: ["water"], access: [], properties: {} });
    const options = storyRouteEndpointOptions(project);
    const river = options.find(({ id }) => id === "terrain:river")!;
    expect(endpointForOption(river)).toEqual({ placeId: "world", point: { x: 10, y: 10 } });
    expect(river.requiresPoint).toBe(true);
  });

  it("does not lose a terrain selection when the panel derives its value again", () => {
    const project = fixture();
    project.elements.push({ id: "forest", belongsToId: "world", name: "Forest", layerId: "terrain", subjectId: "terrain.forest", geometry: { kind: "region", shape: { kind: "rectangle", x: 4, y: 5, width: 8, height: 6 } }, visible: true, locked: false, tags: [], access: [], properties: {} });
    const options = storyRouteEndpointOptions(project);
    expect(endpointOptionId(options, { placeId: "world", point: { x: 8, y: 8 } })).toBe("terrain:forest");
    expect(endpointOptionId(options, { placeId: "world", point: { x: 15, y: 10 } })).toBe("world");
  });

  it("adds the shortest useful parent path only to repeated endpoint names", () => {
    const project = fixture();
    const place = (id: string, name: string, kind: "building" | "level" | "room", parentId: string) => ({ id, name, kind, parentId, transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle" as const, x: 0, y: 0, width: 10, height: 10 }, tags: [], access: [], properties: {} });
    project.places.push(
      place("house", "House", "building", "world"),
      place("ground", "Ground Floor", "level", "house"),
      place("upper", "First Floor", "level", "house"),
      place("ground-stairs", "Service Staircase", "room", "ground"),
      place("upper-stairs", "Service Staircase", "room", "upper"),
      place("library", "Library", "room", "ground"),
    );
    expect(storyRouteEndpointOptions(project).map(({ name }) => name)).toEqual([
      "World", "Ground Floor", "First Floor", "Service Staircase — Ground Floor", "Service Staircase — First Floor", "Library",
    ]);
  });
});
