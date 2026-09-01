import { describe, expect, it, vi } from "vitest";
import { checkpointSummary, createProjectCheckpoint, type ProjectCheckpoint } from "../persistence/project-checkpoint";
import { createProjectAtScale } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { createEditorAgentTools } from "./register-agent-tools";

function fixture() {
  const project = createProjectAtScale("p", "Initial", "en", "world");
  let session = new EditorSession(project, { initialPlaceId: project.places[0].id });
  const checkpoint = createProjectCheckpoint(session.getState().project, { id: "saved", name: "Original" });
  const load = vi.fn(async () => checkpoint);
  const tools = createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => project.places[0].id, refresh: () => {}, getCheckpoints: () => [checkpointSummary(checkpoint)], getCheckpoint: load });
  const call = async (name: string, input: Record<string, unknown> = {}) => (await tools.find((tool) => tool.name === name)!.execute(input)) as { structuredContent: { status: string; token?: string } };
  return { project, session, checkpoint, load, call, switchSession: () => { session = new EditorSession(project); } };
}

describe("checkpoint tools with lazy snapshot storage", () => {
  it("does not load contents for listing; comparison and restore load the exact snapshot", async () => {
    const { call, load, session } = fixture();
    await call("list_project_checkpoints"); expect(load).not.toHaveBeenCalled();
    session.executeTransaction({ id: "rename", apply: (project) => ({ ...project, name: "Edited" }) });
    expect((await call("compare_checkpoint_to_current", { checkpointId: "saved" })).structuredContent.status).toBe("compared");
    const prepared = (await call("prepare_restore_checkpoint", { checkpointId: "saved" })).structuredContent;
    expect(prepared.status).toBe("prepared"); expect(load).toHaveBeenCalledWith("saved");
    expect((await call("apply_prepared_editor_change", { token: prepared.token })).structuredContent.status).toBe("applied");
    expect(session.getState().project.name).toBe("Initial"); session.undo(); expect(session.getState().project.name).toBe("Edited");
  });
  it("rejects a restore if an edit or session switch occurs during loading", async () => {
    for (const change of ["edit", "session"] as const) {
      const { call, load, checkpoint, session, switchSession } = fixture();
      let resolve!: (value: ProjectCheckpoint) => void;
      load.mockImplementation(() => new Promise((done) => { resolve = done; }));
      const pending = call("prepare_restore_checkpoint", { checkpointId: "saved" });
      if (change === "edit") session.executeTransaction({ id: "new", apply: (project) => ({ ...project, name: "New edit" }) }); else switchSession();
      resolve(checkpoint); expect((await pending).structuredContent.status).toBe("stale");
      if (change === "edit") expect(session.getState().project.name).toBe("New edit");
    }
  });
  it("keeps proposal-base guards after lazy loading", async () => {
    const { call, load, checkpoint, session } = fixture();
    const proposed = createProjectCheckpoint({ ...checkpoint.snapshot, name: "Proposal" }, { id: "saved", name: "Proposed", kind: "proposal", baseSnapshot: checkpoint.snapshot });
    load.mockResolvedValue(proposed);
    session.executeTransaction({ id: "new", apply: (project) => ({ ...project, name: "New edit" }) });
    expect((await call("prepare_restore_checkpoint", { checkpointId: "saved" })).structuredContent.status).toBe("blocked");
    expect(session.getState().project.name).toBe("New edit");
  });
});
