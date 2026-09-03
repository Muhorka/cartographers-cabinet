import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { createWorkbenchLevel } from "./workbench-level-creation";
import { deleteWorkbenchPlace } from "./workbench-place-deletion";
import type { EditorTransactionCommit } from "./use-editor-transaction";

function rejectedSession() {
  const project = createStarterProject("project", "Rejected workbench change", "en");
  const level = project.places.find(({ kind }) => kind === "level")!;
  const building = project.places.find(({ kind }) => kind === "building")!;
  const session = new EditorSession(project, { initialPlaceId: level.id });
  const commit: EditorTransactionCommit = vi.fn(() => false);
  return { building, commit, level, session };
}

describe("workbench transaction guards", () => {
  it("does not navigate after a place deletion was rejected", () => {
    const { commit, level, session } = rejectedSession();
    const before = session.getViewState();
    expect(deleteWorkbenchPlace(session, level.id, commit)).toBeUndefined();
    expect(commit).toHaveBeenCalledOnce();
    expect(session.getViewState()).toBe(before);
  });

  it("keeps the workbench unchanged when a subtree contains a locked descendant", () => {
    const project = createStarterProject("project", "Locked descendant", "en");
    const building = project.places.find(({ kind }) => kind === "building")!;
    project.places.push({ id: "locked-child", parentId: building.id, name: "Locked child", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {}, locked: true });
    const session = new EditorSession(project, { initialPlaceId: building.id });
    const before = session.getState();
    const commit: EditorTransactionCommit = (id, change) => session.executeTransaction({ id, apply: typeof change === "function" ? change : () => change }).changed;
    expect(deleteWorkbenchPlace(session, building.id, commit)).toBeUndefined();
    expect(session.getState()).toEqual(before);
  });

  it("does not expose or open a level whose creation was rejected", () => {
    const { building, commit, session } = rejectedSession();
    const before = session.getViewState();
    expect(createWorkbenchLevel(session, building.id, "above", "en", commit)).toBeUndefined();
    expect(commit).toHaveBeenCalledOnce();
    expect(session.getViewState()).toBe(before);
  });
});
