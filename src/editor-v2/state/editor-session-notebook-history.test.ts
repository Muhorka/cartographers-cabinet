import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "./editor-session";

describe("detached notebook history", () => {
  it("keeps notebook documents outside global undo and redo", () => {
    const session = new EditorSession(emptyProject("p", "Notebook history"));
    session.executeTransaction({ id: "rename", apply: (project) => ({ ...project, name: "Renamed" }) });
    const documents = [{ id: "note", title: "Scene", bodyMarkdown: "**Night**", references: [] }];

    expect(session.replaceStoryDocuments(documents).code).toBe("committed");
    expect(session.getHistoryState()).toEqual({ canUndo: true, canRedo: false });
    session.undo();
    expect(session.getViewState().project).toMatchObject({ name: "Notebook history", story: { documents } });
    session.redo();
    expect(session.getViewState().project).toMatchObject({ name: "Renamed", story: { documents } });

    const revised = [{ ...documents[0], bodyMarkdown: "**Later**" }];
    session.replaceStoryDocuments(revised);
    session.undo();
    session.redo();
    expect(session.getViewState().project.story.documents).toEqual(revised);
  });
});
