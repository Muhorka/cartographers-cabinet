import { describe, expect, it } from "vitest";
import { addElement, createPlace } from "../model/hierarchy-operations";
import { emptyProject, type EditorProject } from "../model/project-model";
import { EditorSession } from "./editor-session";

function projectWithPlaces(): EditorProject {
  let project = emptyProject("project", "Project");
  project = createPlace(project, { id: "world", name: "World", kind: "world" });
  return createPlace(project, { id: "room", parentId: "world", name: "Room", kind: "location" });
}

describe("editor v2 session navigation history", () => {
  it("reconciles active place, selection and boundary mode for commit, undo, redo and restore", () => {
    let project = projectWithPlaces();
    project = addElement(project, {
      id: "room-note",
      name: "Room note",
      layerId: "sketch",
      subjectId: "sketch.note",
      geometry: { kind: "note", at: { x: 1, y: 1 }, text: "note" },
      visible: true,
      locked: false,
      tags: [],
      access: [],
      properties: {},
    }, "room");
    const session = new EditorSession(project, { initialPlaceId: "room" });
    session.setSelection([{ kind: "place", id: "room" }, { kind: "element", id: "room-note" }]);
    session.setBoundaryEditing(true);

    const removeRoom = { id: "delete-room", apply: (current: EditorProject) => ({ ...current, places: current.places.filter(({ id }) => id !== "room"), elements: current.elements.filter(({ id }) => id !== "room-note") }) };
    expect(session.executeTransaction(removeRoom).code).toBe("committed");
    expect(session.getState()).toMatchObject({ activePlaceId: "world", selection: [], boundaryEditing: false });

    expect(session.undo().code).toBe("committed");
    expect(session.getState()).toMatchObject({ activePlaceId: "world", selection: [], boundaryEditing: false });
    expect(session.redo().code).toBe("committed");
    expect(session.getState()).toMatchObject({ activePlaceId: "world", selection: [], boundaryEditing: false });

    expect(session.executeTransaction({ id: "restore-room", apply: () => project })).toEqual({ code: "committed", changed: true });
    expect(session.getState()).toMatchObject({ activePlaceId: "world", selection: [], boundaryEditing: false });
  });
});
