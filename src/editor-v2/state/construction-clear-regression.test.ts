import { describe, expect, it } from "vitest";
import { createProjectAtScale } from "../model/starter-project";
import { EditorSession } from "./editor-session";
import type { ConstructionSurfaceKind } from "../model/project-model";
import { constructionClearCategories } from "./clear-construction-layer";
import { createLevelForBuilding } from "../model/hierarchy-operations";

const kinds: ConstructionSurfaceKind[] = ["platform", "porch", "terrace", "balcony", "mezzanine", "stage", "custom"];
const surface = (id: string, belongsToId: string, kind: ConstructionSurfaceKind) => ({ id, belongsToId, name: `Named ${kind}`, kind, shape: { kind: "rectangle" as const, x: 1, y: 1, width: 3, height: 2 }, attachment: "free" as const, elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} });

function levelProject() {
  return createProjectAtScale("clear-regression", "Synthetic atlas", "en", "building");
}

describe("construction clear regression", () => {
  const categories = constructionClearCategories;

  it.each(["world", "level", "room", "building"] as const)("clears all surface kinds from %s without replacing rooms and supports exact undo", (scope) => {
    let project = scope === "world" ? createProjectAtScale("clear-regression-world", "Synthetic atlas", "en", "world") : levelProject();
    const level = project.places.find(({ kind }) => kind === "level");
    const room = project.places.find(({ kind }) => kind === "room");
    const ownerId = scope === "world" ? project.places.find(({ kind }) => kind === "world")!.id : scope === "level" ? level!.id : scope === "building" ? level!.parentId! : room!.id;
    project = { ...project, surfaces: kinds.map((kind, index) => surface(`surface-${scope}-${index}`, scope === "building" ? level!.id : ownerId, kind)) };
    const session = new EditorSession(project, { initialPlaceId: ownerId });
    const initial = session.getState().project;
    expect(session.clearCurrentLayer("construction").code).toBe("committed");
    expect(session.getState().project.surfaces).toEqual([]);
    expect(session.getState().project.constructions.map(({ rooms }) => rooms)).toEqual(initial.constructions.map(({ rooms }) => rooms));
    expect(session.undo().code).toBe("committed");
    expect(session.getState().project).toEqual(initial);
  });

  it("clears a shared staircase from its destination, preserving both floors and unrelated stairs", () => {
    let project = levelProject(); const first = project.places.find(({ kind }) => kind === "level")!;
    let counter = 0;
    project = createLevelForBuilding(project, { id: "second-level", constructionId: "second-plan", buildingId: first.parentId!, name: "Upper" }, { createId: () => `upper-${++counter}` });
    project = { ...project, constructions: project.constructions.map((document) => document.id === first.constructionId ? { ...document, transitions: [
      { id: "shared-stairs", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 }, sourceLevelId: first.id, connectedLevelIds: [first.id, "second-level"] },
      { id: "local-steps", kind: "stairs", footprint: { kind: "rectangle", x: 5, y: 1, width: 1, height: 1 }, sourceLevelId: first.id, sameLevelRise: true },
    ] } : document) };
    const session = new EditorSession(project, { initialPlaceId: "second-level" });
    expect(session.clearCurrentLayer("construction").code).toBe("committed");
    expect(session.getState().project.constructions.find(({ id }) => id === first.constructionId)?.transitions.map(({ id }) => id)).toEqual(["local-steps"]);
    expect(session.getState().project.constructions).toHaveLength(2);
    expect(session.undo().code).toBe("committed");
    expect(session.getState().project.constructions.find(({ id }) => id === first.constructionId)?.transitions).toHaveLength(2);
  });

  it.each(categories)("clears only the selected construction category: %s", (category) => {
    const initial = levelProject(); const level = initial.places.find(({ kind }) => kind === "level")!;
    const document = initial.constructions.find(({ id }) => id === level.constructionId)!;
    const partition = { id: "clear-partition", start: { x: 0, y: 0 }, end: { x: 0, y: 2 }, thickness: .2, role: "partition" as const };
    const project = {
      ...initial,
      surfaces: [surface("clear-platform", level.id, "platform"), { ...surface("locked-platform", level.id, "balcony"), locked: true }],
      constructions: initial.constructions.map((candidate) => candidate.id === document.id ? {
        ...candidate, walls: [...candidate.walls, partition], openings: [
          { id: "clear-door", kind: "door" as const, wallId: partition.id, position: .2, width: .5 }, { id: "clear-window", kind: "window" as const, wallId: partition.id, position: .4, width: .5 }, { id: "clear-gate", kind: "gate" as const, wallId: partition.id, position: .6, width: .5 }, { id: "clear-passage", kind: "passage" as const, wallId: partition.id, position: .8, width: .5 },
        ],
        transitions: [{ id: "clear-stairs", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 1, y: 1, width: 1, height: 1 }, sameLevelRise: true }],
      } : candidate),
    };
    const session = new EditorSession(project, { initialPlaceId: level.id }); const before = session.getState().project;
    expect(session.clearCurrentLayer("construction", category).code).toBe("committed");
    const after = session.getState().project; const result = after.constructions.find(({ id }) => id === document.id)!;
    if (category === "walls") {
      expect(result.walls.some(({ id }) => id === partition.id)).toBe(false); expect(result.openings).toEqual([]);
      expect(result.transitions).toHaveLength(1); expect(after.surfaces.map(({ id }) => id)).toEqual(["clear-platform", "locked-platform"]);
    } else if (category === "vertical-connections") {
      expect(result.walls.some(({ id }) => id === partition.id)).toBe(true); expect(result.openings).toHaveLength(4); expect(result.transitions).toEqual([]);
      expect(after.surfaces.map(({ id }) => id)).toEqual(["clear-platform", "locked-platform"]);
    } else if (["doors", "windows", "gates", "passages"].includes(category)) {
      const selectedKind = ({ doors: "door", windows: "window", gates: "gate", passages: "passage" } as Record<string, string>)[category];
      expect(result.walls.some(({ id }) => id === partition.id)).toBe(true);
      expect(result.openings.map(({ kind }) => kind)).toEqual((["door", "window", "gate", "passage"] as const).filter((kind) => kind !== selectedKind));
      expect(result.transitions).toHaveLength(1); expect(after.surfaces.map(({ id }) => id)).toEqual(["clear-platform", "locked-platform"]);
    } else {
      expect(result.walls.some(({ id }) => id === partition.id)).toBe(true); expect(result.openings).toHaveLength(4); expect(result.transitions).toHaveLength(1);
      expect(after.surfaces.map(({ id }) => id)).toEqual(["locked-platform"]);
    }
    expect(session.undo().code).toBe("committed"); expect(session.getState().project).toEqual(before);
  });

  it("keeps a wall that carries a locked opening when clearing walls", () => {
    const initial = levelProject(); const level = initial.places.find(({ kind }) => kind === "level")!;
    const document = initial.constructions.find(({ id }) => id === level.constructionId)!;
    const lockedWall = { id: "locked-wall", start: { x: 1, y: 1 }, end: { x: 1, y: 3 }, thickness: .2, role: "partition" as const };
    const freeWall = { id: "free-wall", start: { x: 3, y: 1 }, end: { x: 3, y: 3 }, thickness: .2, role: "partition" as const };
    const project = { ...initial, constructions: initial.constructions.map((candidate) => candidate.id === document.id ? {
      ...candidate, walls: [...candidate.walls, lockedWall, freeWall], openings: [{ id: "locked-door", kind: "door" as const, wallId: lockedWall.id, position: .5, width: .5, locked: true }],
    } : candidate) };
    const session = new EditorSession(project, { initialPlaceId: level.id });
    expect(session.clearCurrentLayer("construction", "walls").code).toBe("committed");
    const result = session.getState().project.constructions.find(({ id }) => id === document.id)!;
    expect(result.walls.map(({ id }) => id)).toContain(lockedWall.id); expect(result.walls.map(({ id }) => id)).not.toContain(freeWall.id);
    expect(result.openings.map(({ id }) => id)).toEqual(["locked-door"]);
  });

  it.each(["doors", "windows", "gates", "passages"] as const)("clears only %s openings", (category) => {
    const initial = levelProject(); const level = initial.places.find(({ kind }) => kind === "level")!;
    const document = initial.constructions.find(({ id }) => id === level.constructionId)!;
    const wall = { id: `opening-wall-${category}`, start: { x: 0, y: 0 }, end: { x: 0, y: 2 }, thickness: .2, role: "partition" as const };
    const kinds = { doors: "door", windows: "window", gates: "gate", passages: "passage" } as const;
    const project = { ...initial, constructions: initial.constructions.map((candidate) => candidate.id === document.id ? { ...candidate, walls: [...candidate.walls, wall], openings: [
      { id: "door", kind: "door" as const, wallId: wall.id, position: .2, width: .5 }, { id: "window", kind: "window" as const, wallId: wall.id, position: .4, width: .5 }, { id: "gate", kind: "gate" as const, wallId: wall.id, position: .6, width: .5 }, { id: "passage", kind: "passage" as const, wallId: wall.id, position: .8, width: .5 },
    ] } : candidate) };
    const session = new EditorSession(project, { initialPlaceId: level.id });
    expect(session.clearCurrentLayer("construction", category).code).toBe("committed");
    const result = session.getState().project.constructions.find(({ id }) => id === document.id)!;
    expect(result.openings.map(({ kind }) => kind)).toEqual((["door", "window", "gate", "passage"] as const).filter((kind) => kind !== kinds[category]));
  });
});
