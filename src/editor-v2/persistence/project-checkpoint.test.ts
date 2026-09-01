import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { createProjectCheckpoint, restoreCheckpointSnapshot } from "./project-checkpoint";

describe("project checkpoints", () => {
  it("keeps an immutable project snapshot that can be restored later", () => {
    const project = createStarterProject("project", "Dolina Rzeki", "pl");
    const checkpoint = createProjectCheckpoint(project, { id: "checkpoint", name: "Przed przebudową", createdAt: "2026-08-29T20:00:00.000Z" });
    project.places[0]!.name = "Changed outside snapshot";
    const restored = restoreCheckpointSnapshot(checkpoint, "2026-08-29T22:00:00.000Z");
    expect(restored.places[0]!.name).not.toBe(project.places[0]!.name);
    expect(restored).toMatchObject({ id: "project", updatedAt: "2026-08-29T22:00:00.000Z" });
  });

  it("rejects empty names and a snapshot attached to another project", () => {
    const project = createStarterProject("project", "Dolina Rzeki", "pl");
    expect(() => createProjectCheckpoint(project, { id: "checkpoint", name: "  " })).toThrow(/name/i);
    const checkpoint = createProjectCheckpoint(project, { id: "checkpoint", name: "Version" });
    expect(() => restoreCheckpointSnapshot({ ...checkpoint, projectId: "another-project" })).toThrow(/does not belong/i);
  });
});
