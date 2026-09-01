import { describe, expect, it } from "vitest";
import { EditorSession } from "../state/editor-session";
import { createProjectAtScale } from "../model/starter-project";
import { createAgentBatchTools } from "./agent-batch-tools";
import { createEditorAgentTools } from "./register-agent-tools";
import { projectRevision } from "../state/project-revision";

describe("project settings via single and batch commands", () => {
  it("preserves exact grid settings in a mixed batch just like a single command", async () => {
    const project = createProjectAtScale("grid-test", "Grid test", "en", "location");
    const ownerId = project.places[0].id;
    const single = new EditorSession(project, { initialPlaceId: ownerId });
    const batch = new EditorSession(project, { initialPlaceId: ownerId });
    const factory = (session: EditorSession) => createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => ownerId, refresh: () => undefined });
    const settings = { measureSettings: { gridOpacity: .13, showAxes: false, gridSpacingMeters: 10, gridVisible: true, showRoomAreas: true } };
    const tools = factory(single);
    const prepared = await tools.find(({ name }) => name === "prepare_update_project_settings")!.execute(settings) as { structuredContent: { token: string } };
    await tools.find(({ name }) => name === "apply_prepared_editor_change")!.execute({ token: prepared.structuredContent.token });
    const batchTools = createAgentBatchTools({ getSession: () => batch, getActivePlaceId: () => ownerId, refresh: () => undefined }, factory);
    const result = await batchTools.find(({ name }) => name === "execute_editor_batch")!.execute({
      requestId: "grid-parity", expectedRevision: projectRevision(project), summary: "Grid test",
      operations: [
        { tool: "prepare_update_project_object", input: { ref: { type: "place", id: ownerId }, name: "Renamed site" } },
        { tool: "prepare_update_project_settings", input: settings },
      ],
    }) as { structuredContent: { status: string } };
    expect(result.structuredContent.status).toBe("applied");
    expect(batch.getState().project.measureSettings).toEqual(single.getState().project.measureSettings);
    expect(batch.getState().project.measureSettings).toMatchObject(settings.measureSettings);
    batch.undo(); expect(batch.getState().project).toEqual(project);
  });
});
