import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";
import { updateSelectionState } from "./selection-detail-operations";
import { eraseCurrentLayer } from "./semantic-eraser";
import { deleteSelection, moveSelection } from "./selection-operations";
import { resizePlaceBoundary } from "./place-boundary-operations";
import { resizeTransitionFootprint } from "./selection-detail-operations";

const identity = { createId: () => "cut-id", createName: (index: number) => `Cut ${index}`, createRoomName: (index: number) => `Room ${index}` };

describe("selection visibility and lock state", () => {
  it.each(["place", "room", "wall"] as const)("blocks moving a locked %s", (kind) => {
    const base = createStarterProject("project", "Project", "en");
    const id = kind === "place" ? "project:place" : kind === "room" ? base.constructions[0].rooms[0].id : base.constructions[0].walls[0].id;
    const locked = updateSelectionState(base, { kind, id }, { locked: true });
    const result = moveSelection(locked, { activePlaceId: "project:level", selection: { kind, id }, delta: { x: 1, y: 1 }, boundaryEditing: true }, identity);
    expect(result).toMatchObject({ state: "blocked", reason: "locked-outline" });
  });

  it("blocks resizing a locked place and transition", () => {
    const base = createStarterProject("project", "Project", "en");
    const place = updateSelectionState(base, { kind: "place", id: "project:place" }, { locked: true });
    expect(resizePlaceBoundary(place, "project:place", "south-east", { x: 30, y: 30 })).toMatchObject({ state: "blocked", reason: "locked-outline" });
    const withTransition = { ...base, constructions: base.constructions.map((document) => ({ ...document, transitions: [{ id: "transition-1", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 0, y: 0, width: 2, height: 2 }, locked: true }] })) };
    expect(resizeTransitionFootprint(withTransition, "transition-1", "south-east", { x: 3, y: 3 })).toMatchObject({ state: "blocked", reason: "locked-outline" });
  });

  it.each(["place", "room", "wall"] as const)("blocks deleting a locked %s", (kind) => {
    const base = createStarterProject("project", "Project", "en");
    const id = kind === "place" ? "project:place" : kind === "room" ? base.constructions[0].rooms[0].id : base.constructions[0].walls[0].id;
    const locked = updateSelectionState(base, { kind, id }, { locked: true });
    expect(deleteSelection(locked, { activePlaceId: "project:level", selection: { kind, id }, boundaryEditing: true }, identity)).toMatchObject({ state: "blocked", reason: "locked-outline" });
  });

  it.each([
    ["place", (project: ReturnType<typeof createStarterProject>) => ({ project, id: "project:place" })],
    ["room", (project: ReturnType<typeof createStarterProject>) => ({ project, id: project.constructions[0].rooms[0].id })],
    ["wall", (project: ReturnType<typeof createStarterProject>) => ({ project, id: project.constructions[0].walls[0].id })],
    ["opening", (project: ReturnType<typeof createStarterProject>) => ({ project: { ...project, constructions: project.constructions.map((document) => ({ ...document, openings: [{ id: "opening-1", kind: "door" as const, wallId: document.walls[0].id, position: .5, width: 1 }] })) }, id: "opening-1" })],
    ["transition", (project: ReturnType<typeof createStarterProject>) => ({ project: { ...project, constructions: project.constructions.map((document) => ({ ...document, transitions: [{ id: "transition-1", kind: "stairs" as const, footprint: { kind: "rectangle" as const, x: 0, y: 0, width: 2, height: 2 } }] })) }, id: "transition-1" })],
  ] as const)("updates %s and survives export/import", (_kind, makeTarget) => {
    const base = createStarterProject("project", "Project", "en");
    const { project, id } = makeTarget(base);
    const changed = updateSelectionState(project, { kind: _kind, id }, { visible: false, locked: true });
    const roundTrip = parseProjectFile(serializeProjectFile(changed)).project;
    if (_kind === "place") expect(roundTrip.places.find((place) => place.id === id)).toMatchObject({ visible: false, locked: true });
    else if (_kind === "room") {
      expect(roundTrip.constructions[0].rooms.find((room) => room.id === id)).toMatchObject({ visible: false, locked: true });
      expect(roundTrip.places.find((place) => place.id === id)).toMatchObject({ visible: false, locked: true });
    }
    else if (_kind === "wall") expect(roundTrip.constructions[0].walls.find((wall) => wall.id === id)).toMatchObject({ visible: false, locked: true });
    else if (_kind === "opening") expect(roundTrip.constructions[0].openings[0]).toMatchObject({ visible: false, locked: true });
    else expect(roundTrip.constructions[0].transitions[0]).toMatchObject({ visible: false, locked: true });
  });

  it.each([
    ["sketch", { id: "note", layerId: "sketch" as const, geometry: { kind: "note" as const, at: { x: 1, y: 1 }, text: "note", width: 4, height: 2 } }],
    ["terrain", { id: "terrain", layerId: "terrain" as const, geometry: { kind: "region" as const, shape: { kind: "rectangle" as const, x: 0, y: 0, width: 3, height: 3 } } }],
  ] as const)("eraser leaves locked %s objects intact", (_layer, partial) => {
    const base = createStarterProject("project", "Project", "en");
    const element = { ...partial, belongsToId: "project:place", name: partial.id, subjectId: "test", visible: true, locked: true, tags: [], access: [], properties: {} };
    const result = eraseCurrentLayer({ ...base, elements: [element] }, { activePlaceId: "project:place", layerId: _layer, points: [{ x: 1, y: 1 }], radius: 1, boundaryEditing: false }, identity);
    expect(result.project.elements).toHaveLength(1);
  });
});
