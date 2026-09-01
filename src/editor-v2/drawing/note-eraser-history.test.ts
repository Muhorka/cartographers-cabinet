import { describe, expect, it } from "vitest";
import { addElement, createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { applyMapGesture } from "./map-gesture-command";

function fixture(kind: "world" | "standalone-room", locked = false) {
  let project = createPlace(emptyProject("notes", "Synthetic notes"), {
    id: "map", name: "Map", kind,
    boundary: kind === "standalone-room" ? { kind: "rectangle", x: -20, y: -20, width: 40, height: 40 } : undefined,
  });
  project = addElement(project, {
    id: "note", name: "Note", belongsToId: "map", layerId: "sketch", subjectId: "sketch.note",
    geometry: { kind: "note", at: { x: 0, y: 0 }, width: 10, height: 4, rotation: 90, text: "A full note\nwith another line" },
    visible: true, locked, tags: [], access: [], properties: { fontSize: 9 },
  }, "map");
  return new EditorSession(project, { initialPlaceId: "map" });
}

function erase(session: EditorSession, points: { x: number; y: number }[]) {
  const result = applyMapGesture(session.getState().project, {
    activePlaceId: "map", layerId: "sketch", subjectId: "sketch.note", boundaryEditing: false,
    gesture: { instrumentId: "erase", points, hitRadius: .2 },
  }, { createId: () => "unused", createRoomName: () => "Room" }, { nameFor: () => "Note", levelName: () => "Floor" });
  if (result.state === "applied") session.executeTransaction({ id: "erase-note", apply: () => result.project });
  return result;
}

describe("note erasing through drawing commands and shared history", () => {
  it.each(["world", "standalone-room"] as const)("erases the visible field and restores the complete note on %s", (kind) => {
    const session = fixture(kind); const before = session.getState().project;
    expect(erase(session, [{ x: -2, y: 4 }, { x: -2, y: 6 }]).state).toBe("applied");
    expect(session.getState().project.elements).toHaveLength(0);
    expect(session.getHistoryState()).toEqual({ canUndo: true, canRedo: false });
    session.undo(); expect(session.getState().project).toEqual(before);
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: true });
    session.redo(); expect(session.getState().project.elements).toHaveLength(0);
  });

  it("does not create history for a missed or locked note", () => {
    for (const locked of [false, true]) {
      const session = fixture("world", locked); const before = session.getState().project;
      const points = locked ? [{ x: -2, y: 5 }] : [{ x: 10, y: 5 }];
      expect(erase(session, points).state).toBe("nothing");
      expect(session.getState().project).toEqual(before);
      expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
    }
  });
});
