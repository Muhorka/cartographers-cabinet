import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject } from "../model/project-model";
import { createPlace } from "../model/hierarchy-operations";
import { EditorSession } from "../state/editor-session";
import { createProjectCheckpoint } from "../persistence/project-checkpoint";
import type { useProjectAutosave } from "./use-project-autosave";
import { useWorkbenchProjectSwitch } from "./use-workbench-project-switch";

const storage = vi.hoisted(() => ({ read: vi.fn(), error: vi.fn() }));
vi.mock("../persistence/project-library", async (original) => ({ ...await original<typeof import("../persistence/project-library")>(), readProjectCheckpoint: storage.read }));
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>; let hook: ReturnType<typeof useWorkbenchProjectSwitch>;
function Probe({ session }: { session: EditorSession }) {
  const value = useWorkbenchProjectSwitch({ session, locale: "pl", autosave: {} as ReturnType<typeof useProjectAutosave>, install: vi.fn(), onError: storage.error });
  useLayoutEffect(() => { hook = value; }); return null;
}
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.resetAllMocks(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const projectWithMap = (id: string, name: string) => createPlace(emptyProject(id, name), { id: `${id}:world`, name: "World", kind: "world" });

describe("checkpoint restore belongs to its unchanged live session", () => {
  it("restores as one undoable transaction only after the safety copy succeeds", async () => {
    const session = new EditorSession(projectWithMap("p", "Current")); const before = session.getViewState().project;
    storage.read.mockResolvedValue(createProjectCheckpoint(projectWithMap("p", "Checkpoint"), { id: "cp", name: "Version" }));
    await act(async () => root.render(<Probe session={session}/>));
    const preserve = vi.fn().mockResolvedValue("safety");
    await act(async () => { expect((await hook.restoreCheckpoint("cp", preserve))?.session).toBe(session); });
    expect(storage.read).toHaveBeenCalledWith("cp", "p"); expect(preserve.mock.calls[0][0]).toBe(before);
    expect(session.getViewState().project.name).toBe("Checkpoint");
    session.undo(); expect(session.getViewState().project).toBe(before);
  });
  it("does not overwrite an edit made while the checkpoint is loading", async () => {
    const session = new EditorSession(projectWithMap("p", "Current"));
    let finish!: (value: ReturnType<typeof createProjectCheckpoint>) => void;
    storage.read.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => root.render(<Probe session={session}/>)); const preserve = vi.fn();
    const restore = hook.restoreCheckpoint("cp", preserve);
    session.executeTransaction({ id: "edit", apply: (project) => ({ ...project, name: "Newer edit" }) });
    finish(createProjectCheckpoint(projectWithMap("p", "Old"), { id: "cp", name: "Version" }));
    expect(await restore).toBeUndefined(); expect(preserve).not.toHaveBeenCalled();
    expect(session.getViewState().project.name).toBe("Newer edit");
  });
  it("ignores a completed safety write after switching to another project", async () => {
    const session = new EditorSession(projectWithMap("p", "Current")); const before = session.getViewState().project;
    storage.read.mockResolvedValue(createProjectCheckpoint(projectWithMap("p", "Old"), { id: "cp", name: "Version" }));
    let finish!: (value: string) => void; const preserve = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    await act(async () => root.render(<Probe session={session}/>)); let restore!: ReturnType<typeof hook.restoreCheckpoint>;
    await act(async () => { restore = hook.restoreCheckpoint("cp", preserve); });
    const other = new EditorSession(projectWithMap("q", "Other")); await act(async () => root.render(<Probe session={other}/>));
    finish("safety"); expect(await restore).toBeUndefined(); expect(session.getViewState().project).toBe(before);
    expect(hook.getSession()).toBe(other);
  });
  it("does not restore if preserving the safety copy fails", async () => {
    const session = new EditorSession(projectWithMap("p", "Current")); const before = session.getViewState().project;
    storage.read.mockResolvedValue(createProjectCheckpoint(projectWithMap("p", "Old"), { id: "cp", name: "Version" }));
    await act(async () => root.render(<Probe session={session}/>));
    expect(await hook.restoreCheckpoint("cp", async () => { throw new Error("storage failed"); })).toBeUndefined();
    expect(session.getViewState().project).toBe(before); expect(storage.error).toHaveBeenLastCalledWith("The change could not be saved to local storage."); expect(storage.error).not.toHaveBeenCalledWith(expect.stringContaining("storage failed"));
  });
});
