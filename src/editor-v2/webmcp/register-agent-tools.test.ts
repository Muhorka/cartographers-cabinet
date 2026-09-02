import { describe, expect, it } from "vitest";
import { createProjectCheckpoint } from "../persistence/project-checkpoint";
import { createProjectAtScale } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { createEditorAgentTools } from "./register-agent-tools";

describe("agent checkpoint response", () => {
  it("returns a compact receipt and keeps the full snapshot opt-in", async () => {
    const project = createProjectAtScale("checkpoint-test", "Checkpoint test", "en", "world");
    const session = new EditorSession(project, { initialPlaceId: project.places[0].id });
    const checkpoint = createProjectCheckpoint(project, { id: "checkpoint-1", name: "Before edit", createdAt: "2026-08-31T00:00:00.000Z" });
    const tools = createEditorAgentTools({
      getSession: () => session,
      getActivePlaceId: () => project.places[0].id,
      refresh: () => undefined,
      createCheckpoint: async () => checkpoint,
    });
    const tool = tools.find(({ name }) => name === "create_project_checkpoint")!;

    const compact = (await tool.execute({ name: "Before edit" })) as { structuredContent: { status: string; checkpoint: Record<string, unknown> } };
    expect(compact.structuredContent).toMatchObject({ status: "created", checkpoint: { id: checkpoint.id, projectId: project.id, name: checkpoint.name, createdAt: checkpoint.createdAt } });
    expect(compact.structuredContent.checkpoint).not.toHaveProperty("snapshot");

    const full = (await tool.execute({ name: "Before edit", includeSnapshot: true })) as { structuredContent: { checkpoint: Record<string, unknown> } };
    expect(full.structuredContent.checkpoint.snapshot).toEqual(checkpoint.snapshot);
  });

  it("propagates checkpoint deletion failures to WebMCP", async () => {
    const project = createProjectAtScale("checkpoint-delete-test", "Checkpoint delete test", "en", "world");
    const session = new EditorSession(project, { initialPlaceId: project.places[0].id });
    const checkpoint = createProjectCheckpoint(project, { id: "checkpoint-delete", name: "Delete me" });
    const tools = createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => project.places[0].id, refresh: () => undefined, getCheckpoints: () => [checkpoint], deleteCheckpoint: async () => { throw new Error("Delete failed"); } });
    const prepare = tools.find(({ name }) => name === "prepare_delete_checkpoint")!;
    const apply = tools.find(({ name }) => name === "apply_checkpoint_deletion")!;
    const prepared = await prepare.execute({ checkpointId: checkpoint.id }) as { structuredContent: { token: string } };
    await expect(apply.execute({ token: prepared.structuredContent.token })).rejects.toThrow("Delete failed");
  });
});

describe("agent focus receipt", () => {
  it("does not report successful focus when the host rejects missing or cross-sheet refs", async () => {
    const project = createProjectAtScale("focus-test", "Focus test", "en", "world");
    const session = new EditorSession(project);
    const tool = createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => project.places[0].id, refresh: () => undefined, focusObjects: () => false }).find(({ name }) => name === "focus_project_objects")!;
    const result = await tool.execute({ refs: [{ type: "place", id: "missing" }] }) as { structuredContent: { status: string } };
    expect(result.structuredContent.status).toBe("unavailable");
  });
});
