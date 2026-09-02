import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject } from "../model/project-model";
import { loadInitialWorkbenchProject, restoreWorkbenchProject } from "./workbench-project-loading";

const storage = vi.hoisted(() => ({ preferences: new Map<string, string>(), list: vi.fn(), save: vi.fn() }));
const example = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../persistence/project-library", () => ({ getPreference: async (key: string) => storage.preferences.get(key), scanProjectLibrary: storage.list, saveProject: storage.save }));
vi.mock("../persistence/example-project", () => ({ loadExampleProject: example.load }));
const project = () => ({ ...emptyProject("p", "Saved"), places: [{ id: "world", name: "Saved", kind: "world" as const, transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }] });
beforeEach(() => { storage.preferences.clear(); storage.list.mockReset(); storage.save.mockReset().mockImplementation(async (value) => value); example.load.mockReset().mockResolvedValue({ ...project(), id: "example", name: "Residence of the Silver Lindens — Example Project" }); storage.preferences.set("locale", "pl"); });

describe("shared workbench restoration", () => {
  it("restores preferences through the same path when opening a project", async () => {
    storage.preferences.set("sketchOpacity:p", "0"); storage.preferences.set("eraserSize:p", "18"); storage.preferences.set("gapClosingEnabled:p", "true");
    const result = await restoreWorkbenchProject(project(), "pl");
    expect(result.sketchOpacity).toBe(0); expect(result.eraserSize).toBe(18); expect(result.gapClosingEnabled).toBe(true);
    expect(result.snapshot.activePlaceId).toBe("world"); expect(result.project.name).toBe("Saved");
  });
  it("does not replace unreadable library data with an empty project", async () => {
    storage.list.mockRejectedValue(new Error("IndexedDB unavailable"));
    await expect(loadInitialWorkbenchProject()).rejects.toThrow("IndexedDB unavailable");
    expect(storage.save).not.toHaveBeenCalled();
  });
  it("loads the existing project without writing a replacement", async () => {
    storage.list.mockResolvedValue({ projects: [project()], recoveryRecords: [] });
    const result = await loadInitialWorkbenchProject();
    expect(result.loaded?.project.id).toBe("p"); expect(storage.save).not.toHaveBeenCalled(); expect(example.load).not.toHaveBeenCalled();
  });
  it("installs the English example only in an empty healthy library", async () => {
    storage.list.mockResolvedValue({ projects: [], recoveryRecords: [] });
    const result = await loadInitialWorkbenchProject();
    expect(example.load).toHaveBeenCalledOnce(); expect(storage.save).toHaveBeenCalledOnce();
    expect(result.loaded?.project.name).toBe("Residence of the Silver Lindens — Example Project");
  });
  it("loads healthy projects and returns recovery records", async () => {
    storage.list.mockResolvedValue({ projects: [project()], recoveryRecords: [{ primaryKey: "broken", rawRecord: { id: "broken" }, reason: "invalid" }] });
    const result = await loadInitialWorkbenchProject();
    expect(result.loaded?.project.id).toBe("p"); expect(result.recoveryRecords).toHaveLength(1); expect(storage.save).not.toHaveBeenCalled();
  });
  it("does not create a starter when every stored record is invalid", async () => {
    storage.list.mockResolvedValue({ projects: [], recoveryRecords: [{ primaryKey: "broken", rawRecord: { id: "broken" }, reason: "invalid" }] });
    const result = await loadInitialWorkbenchProject();
    expect(result.loaded).toBeUndefined(); expect(result.projects).toEqual([]); expect(storage.save).not.toHaveBeenCalled(); expect(example.load).not.toHaveBeenCalled();
  });
  it("chooses the first healthy project when the preferred project is invalid", async () => {
    storage.preferences.set("activeProjectId", "broken"); storage.list.mockResolvedValue({ projects: [project(), { ...project(), id: "second", name: "Second" }], recoveryRecords: [{ primaryKey: "broken", rawRecord: { id: "broken" }, reason: "invalid" }] });
    const result = await loadInitialWorkbenchProject();
    expect(result.loaded?.project.id).toBe("p");
  });
});
