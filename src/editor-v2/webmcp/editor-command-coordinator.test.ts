import { describe, expect, it, vi } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { EditorCommandCoordinator, type CommandBridge } from "./editor-command-coordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup() {
  const initial = new EditorSession(emptyProject("coordinator", "Coordinator"));
  let current = initial;
  const reports: unknown[] = [];
  const bridge: CommandBridge = {
    getSession: () => current,
    refresh: vi.fn(),
    preserveAgentChange: async () => "checkpoint",
    reportAgentChange: (change) => { reports.push(change); },
  };
  const coordinator = new EditorCommandCoordinator(bridge);
  const base = initial.getState().project;
  const prepare = () => coordinator.prepare("coordinator-test", (project) => ({ project: { ...project, name: "Changed" }, summary: "Change project" }));
  const replaceSession = () => { current = new EditorSession(base); };
  return { initial, bridge, coordinator, base, prepare, replaceSession, reports };
}

describe("EditorCommandCoordinator session guards", () => {
  it("rejects applying a token in a replacement session with the same project revision", () => {
    const { initial, coordinator, base, prepare, replaceSession } = setup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    replaceSession();

    expect(coordinator.apply(prepared.token).status).toBe("stale");
    expect(initial.getState().project).toEqual(base);
    expect(coordinator.revision()).toBe(prepared.baseRevision);
  });

  it("rejects a session replacement during safety preservation without mutating either session", async () => {
    const { initial, bridge, coordinator, base, prepare, replaceSession, reports } = setup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    const gate = deferred<string>();
    bridge.preserveAgentChange = async () => gate.promise;
    const applying = coordinator.applyWithSafety(prepared.token, 5);
    replaceSession();
    gate.resolve("safety-checkpoint");

    expect(await applying).toMatchObject({ status: "stale" });
    expect(initial.getState().project).toEqual(base);
    expect(bridge.getSession().getState().project).toEqual(base);
    expect(initial.getHistoryState().canUndo).toBe(false);
    expect(bridge.getSession().getHistoryState().canUndo).toBe(false);
    expect(reports).toHaveLength(0);
  });

  it("applies a safety guarded change as one undoable transaction", async () => {
    const { initial, coordinator, base, prepare, reports } = setup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");

    const applied = await coordinator.applyWithSafety(prepared.token, 5);
    expect(applied).toMatchObject({ status: "applied", checkpointId: "checkpoint" });
    expect(applied).not.toHaveProperty("session");
    expect(applied).not.toHaveProperty("sessionToken");
    expect(Object.values(applied).some((value) => typeof value === "symbol")).toBe(false);
    const repeated = coordinator.apply(prepared.token);
    expect(repeated).toMatchObject({ status: "applied", alreadyApplied: true });
    expect(repeated).not.toHaveProperty("session");
    expect(repeated).not.toHaveProperty("sessionToken");
    expect(Object.values(repeated).some((value) => typeof value === "symbol")).toBe(false);
    expect(initial.getState().project.name).toBe("Changed");
    expect(initial.getHistoryState()).toEqual({ canUndo: true, canRedo: false });
    expect(reports).toHaveLength(1);
    expect(initial.undo().changed).toBe(true);
    expect(initial.getState().project).toEqual(base);
  });

  it("retains the ordinary stale revision guard", () => {
    const { initial, coordinator, prepare } = setup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    initial.executeTransaction({ id: "newer", apply: (project: EditorProject) => ({ ...project, name: "Newer work" }) });

    expect(coordinator.apply(prepared.token)).toMatchObject({ status: "stale", expectedRevision: prepared.baseRevision });
    expect(initial.getState().project.name).toBe("Newer work");
  });

  it("does not report a proposal after the session is replaced during await", async () => {
    const { bridge, coordinator, base, prepare, replaceSession, reports } = setup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    const gate = deferred<string>();
    bridge.preserveAgentChange = async () => gate.promise;
    const proposing = coordinator.propose(prepared.token);
    replaceSession();
    gate.resolve("proposal-checkpoint");

    expect(await proposing).toMatchObject({ status: "stale" });
    expect(bridge.getSession().getState().project).toEqual(base);
    expect(bridge.getSession().getHistoryState().canUndo).toBe(false);
    expect(reports).toHaveLength(0);
  });
  it.each(["applyWithSafety", "propose"] as const)("rejects a replacement session before %s can preserve data", async (method) => {
    const { initial, bridge, coordinator, base, prepare, replaceSession, reports } = setup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    const preserve = vi.fn(async () => "checkpoint"); bridge.preserveAgentChange = preserve;
    replaceSession();
    const outcome = method === "applyWithSafety" ? await coordinator.applyWithSafety(prepared.token, 5) : await coordinator.propose(prepared.token);
    expect(outcome).toMatchObject({ status: "stale" }); expect(preserve).not.toHaveBeenCalled(); expect(reports).toHaveLength(0);
    expect(initial.getState().project).toEqual(base); expect(bridge.getSession().getState().project).toEqual(base);
    expect(initial.getHistoryState().canUndo).toBe(false); expect(bridge.getSession().getHistoryState().canUndo).toBe(false);
  });

});
