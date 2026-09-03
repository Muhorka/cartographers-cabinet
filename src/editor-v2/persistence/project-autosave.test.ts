import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject } from "../model/project-model";
import { autosaveProject } from "./project-autosave";
import { ProjectConflictError, saveProject } from "./project-library";

vi.mock("./project-library", async (original) => ({ ...await original<typeof import("./project-library")>(), saveProject: vi.fn() }));
const project = emptyProject("autosave", "Test zapisu");
beforeEach(() => vi.resetAllMocks());

describe("project autosave outcome", () => {
  it("reports saved only after storage succeeds", async () => {
    vi.mocked(saveProject).mockResolvedValue(project);
    expect(await autosaveProject(project)).toEqual({ state: "saved", project });
  });
  it("contains a failed write without changing the in-memory project", async () => {
    const before = structuredClone(project);
    vi.mocked(saveProject).mockRejectedValue(new Error("Storage is full"));
    await expect(autosaveProject(project)).resolves.toMatchObject({ state: "failed", error: { code: "storage", reason: expect.any(String) } });
    expect(project).toEqual(before);
  });
  it("can retry the same project after storage becomes available", async () => {
    vi.mocked(saveProject).mockRejectedValueOnce(new Error("Temporary failure")).mockResolvedValueOnce(project);
    expect((await autosaveProject(project)).state).toBe("failed");
    expect((await autosaveProject(project)).state).toBe("saved");
  });

  it("returns a visible conflict and does not turn it into a retryable failure", async () => {
    vi.mocked(saveProject).mockRejectedValue(new ProjectConflictError(project.id, 2));
    await expect(autosaveProject(project, 1)).resolves.toEqual({ state: "conflict", revision: 2 });
  });
});
