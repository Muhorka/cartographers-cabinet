import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { useProjectCheckpoints } from "./use-project-checkpoints";

const storage = vi.hoisted(() => ({ list: vi.fn(), load: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock("../persistence/project-library", () => ({ listProjectCheckpoints: storage.list, loadProjectCheckpoint: storage.load, saveProjectCheckpoint: storage.save, removeProjectCheckpoint: storage.remove, saveProject: vi.fn(), restoreProjectCheckpoint: vi.fn() }));
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>; let hook: ReturnType<typeof useProjectCheckpoints>;
function Probe({ project }: { project: EditorProject }) { const value = useProjectCheckpoints(project, "pl"); useLayoutEffect(() => { hook = value; }); return null; }
const summary = (id: string, projectId = "p") => ({ id, projectId, name: id, createdAt: "2026-01-01T00:00:00.000Z" });
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.resetAllMocks();
  storage.list.mockResolvedValue([summary("a"), summary("b")]);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("checkpoint contents load on demand", () => {
  it("loads metadata only until a tracing is requested, then releases a hidden tracing", async () => {
    const project = emptyProject("p", "Current"); const old = emptyProject("p", "Old"); storage.load.mockResolvedValue(old);
    await act(async () => root.render(<Probe project={project}/>));
    expect(hook.items).toHaveLength(2); expect(storage.load).not.toHaveBeenCalled();
    await act(async () => hook.setActiveId("a"));
    expect(storage.load).toHaveBeenCalledWith("a", "p"); expect(hook.tracingProject).toBe(old);
    act(() => hook.setActiveId(undefined)); expect(hook.tracingProject).toBeUndefined();
  });
  it("ignores a late response from a previously selected tracing", async () => {
    let resolveA!: (project: EditorProject) => void; let resolveB!: (project: EditorProject) => void;
    storage.load.mockImplementation((id) => new Promise<EditorProject>((resolve) => { if (id === "a") resolveA = resolve; else resolveB = resolve; }));
    await act(async () => root.render(<Probe project={emptyProject("p", "Current")}/>));
    await act(async () => hook.setActiveId("a")); await act(async () => hook.setActiveId("b"));
    await act(async () => resolveB(emptyProject("p", "B"))); await act(async () => resolveA(emptyProject("p", "A")));
    expect(hook.tracingProject?.name).toBe("B");
    storage.list.mockResolvedValue([summary("c", "q")]);
    await act(async () => root.render(<Probe project={emptyProject("q", "Other")}/>));
    expect(hook.tracingProject).toBeUndefined(); expect(hook.activeId).toBeUndefined();
  });
  it("keeps saved full snapshots out of the list and surfaces loading errors", async () => {
    const project = emptyProject("p", "Current"); storage.save.mockResolvedValue({ ...summary("c"), snapshot: project, baseSnapshot: project });
    await act(async () => root.render(<Probe project={project}/>)); await act(async () => { await hook.preserve("c"); });
    expect(hook.items[0]).toEqual(summary("c")); expect(hook.items[0]).not.toHaveProperty("snapshot");
    storage.load.mockRejectedValue(new Error("Checkpoint missing")); await act(async () => hook.setActiveId("c"));
    expect(hook.error).toContain("Checkpoint missing"); expect(hook.tracingProject).toBeUndefined();
  });

  it("does not add a checkpoint when saving fails and clears an earlier error after success", async () => {
    const project = emptyProject("p", "Current"); storage.list.mockRejectedValueOnce(new Error("Storage unavailable")); storage.save.mockRejectedValueOnce(new Error("Write failed"));
    await act(async () => root.render(<Probe project={project}/>)); expect(hook.error).toContain("Storage unavailable");
    await act(async () => { expect(await hook.preserve("failed")).toBeUndefined(); });
    expect(hook.error).toBe("Nie udało się zachować tej wersji. Bieżący projekt pozostaje bez zmian."); expect(hook.items).toHaveLength(0);
    const checkpoint = { ...summary("saved"), snapshot: project }; storage.save.mockResolvedValueOnce(checkpoint);
    await act(async () => { expect(await hook.preserve("saved")).toEqual(checkpoint); });
    expect(hook.error).toBeUndefined(); expect(hook.items[0]).toEqual(summary("saved"));
  });

  it("keeps the checkpoint list unchanged when deletion fails and clears the error after success", async () => {
    const project = emptyProject("p", "Current"); storage.remove.mockRejectedValueOnce(new Error("Delete failed"));
    await act(async () => root.render(<Probe project={project}/>));
    await act(async () => { await expect(hook.remove("a")).rejects.toThrow("Delete failed"); });
    expect(hook.error).toBe("Nie udało się usunąć tej wersji. Zachowana wersja nadal jest dostępna."); expect(hook.items).toHaveLength(2); expect(hook.activeId).toBeUndefined();
    storage.remove.mockResolvedValueOnce(undefined); await act(async () => { await hook.remove("a"); });
    expect(hook.error).toBeUndefined(); expect(hook.items.map(({ id }) => id)).toEqual(["b"]);
  });
});
