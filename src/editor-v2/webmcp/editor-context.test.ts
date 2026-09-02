import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { inspectEditorContext, type EditorLiveContext } from "./editor-context";

describe("inspectEditorContext", () => {
  it("reports the active floor and inspected building separately when nothing is selected", () => {
    const project = createStarterProject("context", "Synthetic context", "en");
    const building = project.places.find(({ kind }) => kind === "building")!;
    const floor = project.places.find(({ kind, parentId }) => kind === "level" && parentId === building.id)!;
    const session = new EditorSession(project, { initialPlaceId: floor.id });
    const live: EditorLiveContext = { mode: "drawing", inspectedPlaceId: building.id, selections: [], view: {} };

    const context = inspectEditorContext({ getSession: () => session, getEditorContext: () => live });

    expect(context).toMatchObject({ activePlaceId: floor.id, inspectedPlaceId: building.id, selections: [], selectedObjects: [], selectionAvailable: true });
    expect(context.inspectedPlaceId).not.toBe(context.activePlaceId);
  });
});
