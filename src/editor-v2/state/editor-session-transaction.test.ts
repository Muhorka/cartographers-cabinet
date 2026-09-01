import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { createPlace } from "../model/hierarchy-operations";
import { EditorSession } from "./editor-session";

describe("editor session transaction failures", () => {
  it("returns the transaction error reason without mutating the project", () => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    const session = new EditorSession(project);
    const result = session.executeTransaction({ id: "invalid", apply: () => { throw new Error("invalid geometry"); } });
    expect(result).toEqual({ code: "transaction-failed", changed: false, reason: "invalid geometry" });
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });
});
