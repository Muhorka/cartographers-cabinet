import { describe, expect, it } from "vitest";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject, type EditorProject } from "../model/project-model";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";
import { buildDrawingChange } from "./agent-drawing-command";
import type { AgentDrawingInput } from "./agent-command-types";

function fixture() {
  return createPlace(emptyProject("drawing", "Agent drawing"), {
    id: "world", name: "World", kind: "world",
  });
}

function draw(project: EditorProject, input: Omit<AgentDrawingInput, "ownerId">) {
  return buildDrawingChange(project, "world", { ...input, ownerId: "world" }).project;
}

describe("agent drawings stay serializable V2 project data", () => {
  it("round-trips terrain, equipment, sketch and road geometry without command fields", () => {
    let project = fixture();
    project = draw(project, { layerId: "terrain", subjectId: "terrain.meadow", instrumentId: "rectangle", points: [{ x: 2, y: 3 }, { x: 12, y: 9 }], name: "Łąka <niezaufana>", description: "Opis & tekst" });
    project = draw(project, { layerId: "equipment", subjectId: "equipment.marker", instrumentId: "point", points: [{ x: 15, y: 8 }], name: "Marker" });
    project = draw(project, { layerId: "equipment", subjectId: "equipment.custom", instrumentId: "rectangle", points: [{ x: 18, y: 4 }, { x: 24, y: 10 }], name: "Obiekt" });
    project = draw(project, { layerId: "sketch", subjectId: "sketch.note", instrumentId: "note", points: [{ x: 5, y: 15 }], name: "Notatka" });
    project = draw(project, { layerId: "sketch", subjectId: "sketch.stroke", instrumentId: "line", points: [{ x: 1, y: 18 }, { x: 9, y: 21 }], name: "Ślad" });
    project = draw(project, { layerId: "roads", subjectId: "road.paved", instrumentId: "line", points: [{ x: 0, y: 30 }, { x: 20, y: 30 }], widthMeters: 6, name: "Droga prosta" });
    project = draw(project, { layerId: "roads", subjectId: "road.path", instrumentId: "arc", points: [{ x: 25, y: 30 }, { x: 32, y: 22 }, { x: 40, y: 30 }], widthMeters: 8, name: "Droga łukowa" });

    const source = serializeProjectFile(project, "2026-08-30T00:00:00.000Z");
    const parsed = parseProjectFile(source).project;
    expect(parsed.elements).toHaveLength(7);
    expect(parsed.elements.map(({ layerId, geometry }) => [layerId, geometry.kind])).toEqual([
      ["terrain", "region"], ["equipment", "point"], ["equipment", "region"], ["sketch", "note"], ["sketch", "path"], ["roads", "path"], ["roads", "bezier"],
    ]);
    expect(parsed.elements.find(({ name }) => name === "Łąka <niezaufana>")?.description).toBe("Opis & tekst");
    expect(source).not.toContain('"instrumentId"');
    expect(source).not.toContain('"ownerId"');
    expect(parsed.elements.every((element) => !Object.hasOwn(element, "instrumentId") && !Object.hasOwn(element, "points") && !Object.hasOwn(element, "closed"))).toBe(true);
    expect(parsed.elements.every(({ belongsToId }) => belongsToId === "world")).toBe(true);
  });
});
