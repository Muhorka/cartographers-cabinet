import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject } from "../model/project-model";
import { autosaveProject } from "./project-autosave";
import { saveProject } from "./project-library";

vi.mock("./project-library", () => ({ saveProject: vi.fn() }));
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
    await expect(autosaveProject(project)).resolves.toEqual({ state: "failed" });
    expect(project).toEqual(before);
  });
  it("can retry the same project after storage becomes available", async () => {
    vi.mocked(saveProject).mockRejectedValueOnce(new Error("Temporary failure")).mockResolvedValueOnce(project);
    expect((await autosaveProject(project)).state).toBe("failed");
    expect((await autosaveProject(project)).state).toBe("saved");
  });
});
