import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject } from "../model/project-model";
import { loadInitialWorkbenchProject, restoreWorkbenchProject } from "./workbench-project-loading";

const storage = vi.hoisted(() => ({ preferences: new Map<string, string>(), list: vi.fn(), save: vi.fn() }));
vi.mock("../persistence/project-library", () => ({ getPreference: async (key: string) => storage.preferences.get(key), listSavedProjects: storage.list, saveProject: storage.save }));
const project = () => ({ ...emptyProject("p", "Saved"), places: [{ id: "world", name: "Saved", kind: "world" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }] });
beforeEach(() => { storage.preferences.clear(); storage.list.mockReset(); storage.save.mockReset(); storage.preferences.set("locale", "pl"); });

describe("shared workbench restoration", () => {
  it("restores preferences through the same path when opening a project", async () => {
    storage.preferences.set("sketchOpacity:p", "0"); storage.preferences.set("eraserSize:p", "18"); storage.preferences.set("gapClosingEnabled:p", "true");
    const result = await restoreWorkbenchProject(project(), "pl");
    expect(result.sketchOpacity).toBe(0); expect(result.eraserSize).toBe(18); expect(result.gapClosingEnabled).toBe(true);
    expect(result.snapshot.activePlaceId).toBe("world"); expect(result.project.name).toBe("Saved");
  });
  it("does not replace unreadable library data with an empty project", async () => {
    storage.list.mockRejectedValue(new Error("Invalid saved project"));
    await expect(loadInitialWorkbenchProject()).rejects.toThrow("Invalid saved project");
    expect(storage.save).not.toHaveBeenCalled();
  });
  it("loads the existing project without writing a replacement", async () => {
    storage.list.mockResolvedValue([project()]);
    const result = await loadInitialWorkbenchProject();
    expect(result.loaded.project.id).toBe("p"); expect(storage.save).not.toHaveBeenCalled();
  });
});
