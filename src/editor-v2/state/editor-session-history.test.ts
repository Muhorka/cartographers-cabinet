import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "./editor-session";

describe("editor v2 session history", () => {
  it("bounds history deterministically and keeps the limit configurable", () => {
    const session = new EditorSession(emptyProject("history", "History"), { historyLimit: 2 });
    for (let index = 1; index <= 4; index++) session.executeTransaction({ id: `rename-${index}`, apply: (project) => ({ ...project, name: `Version ${index}` }) });
    expect(session.getHistoryState()).toEqual({ canUndo: true, canRedo: false });
    expect(session.undo().code).toBe("committed");
    expect(session.undo().code).toBe("committed");
    expect(session.undo().code).toBe("history-empty");
    expect(session.getState().project.name).toBe("Version 2");
    expect(session.redo().code).toBe("committed");
    expect(session.redo().code).toBe("committed");
    expect(session.redo().code).toBe("history-empty");
    expect(session.getState().project.name).toBe("Version 4");
  });

  it("retains only the newest 100 undo snapshots by default", () => {
    const session = new EditorSession(emptyProject("history-default", "History"));
    for (let index = 1; index <= 101; index++) session.executeTransaction({ id: `rename-${index}`, apply: (project) => ({ ...project, name: `Version ${index}` }) });
    for (let index = 0; index < 100; index++) expect(session.undo().code).toBe("committed");
    expect(session.undo().code).toBe("history-empty");
    expect(session.getState().project.name).toBe("Version 1");
  });
});
