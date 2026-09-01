import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { createPlace } from "../model/hierarchy-operations";
import { EditorSession } from "./editor-session";

function sessionFixture() {
  const project = createPlace(emptyProject("p", "Original"), { id: "world", name: "World", kind: "world" });
  return new EditorSession(project, { initialPlaceId: "world" });
}

describe("immutable editor UI snapshots", () => {
  it("reuses the document across selection and toolbox changes without exposing mutation", () => {
    const session = sessionFixture(); const before = session.getViewState();
    expect(session.getViewState()).toBe(before);
    expect(() => { before.project.places[0].name = "Corrupted"; }).toThrow();
    session.setSelection([{ kind: "place", id: "world" }]); session.setBoundaryEditing(true);
    const after = session.getViewState();
    expect(after).not.toBe(before); expect(after.project).toBe(before.project);
    expect(before.selection).toEqual([]); expect(after.selection).toEqual([{ kind: "place", id: "world" }]);
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });

  it("keeps legacy reads editable and isolated from the UI, canonical state and history", () => {
    const session = sessionFixture(); const view = session.getViewState(); const copy = session.getState();
    copy.project.places[0].name = "Local draft"; copy.toolbox.activeLayerId = "terrain";
    expect(session.getViewState()).toBe(view); expect(session.getState().project.places[0].name).toBe("World");
  });

  it("shares unchanged branches while isolating retained transaction inputs and outputs", () => {
    const session = sessionFixture(); const before = session.getViewState().project;
    let retained: typeof before | undefined;
    expect(session.executeTransaction({ id: "rename", apply: (draft) => { retained = draft; draft.name = "Changed"; return draft; } }).code).toBe("committed");
    const after = session.getViewState().project;
    expect(after).not.toBe(before); expect(after.places).toBe(before.places); expect(after.story).toBe(before.story);
    retained!.places[0].name = "Late mutation";
    expect(after.places[0].name).toBe("World"); expect(before.name).toBe("Original");
    session.undo(); expect(session.getViewState().project).toBe(before);
    session.redo(); expect(session.getViewState().project).toBe(after);
    expect(session.executeTransaction({ id: "bad", apply: (draft) => { draft.name = "Invalid"; throw new Error("abort"); } }).code).toBe("transaction-failed");
    expect(session.getViewState().project).toBe(after);
  });

  it("preserves repeated undo/redo and branches from the restored version", () => {
    const session = sessionFixture(); const states = [session.getViewState().project];
    for (let index = 1; index <= 12; index += 1) {
      session.executeTransaction({ id: String(index), apply: (draft) => ({ ...draft, name: `Version ${index}` }) });
      states.push(session.getViewState().project);
    }
    for (let index = 11; index >= 0; index -= 1) { session.undo(); expect(session.getViewState().project).toBe(states[index]); }
    for (let index = 1; index <= 12; index += 1) { session.redo(); expect(session.getViewState().project).toBe(states[index]); }
    session.undo(); session.executeTransaction({ id: "branch", apply: (draft) => ({ ...draft, name: "Branch" }) });
    expect(session.redo().code).toBe("history-empty"); session.undo(); expect(session.getViewState().project).toBe(states[11]);
  });
});
