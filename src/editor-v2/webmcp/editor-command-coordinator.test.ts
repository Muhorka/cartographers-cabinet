import { describe, expect, it, vi } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import type { DrawingElement } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { EditorCommandCoordinator, type CommandBridge, type EditorCommandCoordinatorOptions } from "./editor-command-coordinator";
import { createPlace } from "../model/hierarchy-operations";
import { roadFitsBuildings } from "../roads/road-routing";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(options: EditorCommandCoordinatorOptions = {}) {
  const initial = new EditorSession(emptyProject("coordinator", "Coordinator"));
  let current = initial;
  const reports: unknown[] = [];
  const bridge: CommandBridge = {
    getSession: () => current,
    refresh: vi.fn(),
    preserveAgentChange: async () => "checkpoint",
    reportAgentChange: (change) => { reports.push(change); },
  };
  const coordinator = new EditorCommandCoordinator(bridge, options);
  const base = initial.getState().project;
  const prepare = () => coordinator.prepare("coordinator-test", (project) => ({ project: { ...project, name: "Changed" }, summary: "Change project" }));
  const replaceSession = () => { current = new EditorSession(base); };
  return { initial, bridge, coordinator, base, prepare, replaceSession, reports };
}

const road: DrawingElement = { id: "road", belongsToId: "world", name: "Road", layerId: "roads", subjectId: "road.paved", geometry: { kind: "path", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], closed: false }, widthMeters: 4, visible: true, locked: false, tags: [], access: [], properties: {} };

function rerouteSetup() {
  let project = createPlace(emptyProject("reroute", "Reroute"), { id: "world", name: "World", kind: "world" });
  project = createPlace(project, { id: "house", parentId: "world", name: "House", kind: "building", boundary: { kind: "rectangle", x: -5, y: -5, width: 10, height: 10 }, transform: { x: 50, y: 30, rotation: 0 } });
  project.elements = [structuredClone(road)];
  const session = new EditorSession(project);
  let preservedAfter: EditorProject | undefined;
  const bridge: CommandBridge = {
    getSession: () => session,
    refresh: vi.fn(),
    preserveAgentChange: async (_before, after) => { preservedAfter = after; return "checkpoint"; },
  };
  const coordinator = new EditorCommandCoordinator(bridge);
  const prepare = () => coordinator.prepare("move-building", (before) => ({
    project: { ...before, places: before.places.map((place) => place.id === "house" ? { ...place, transform: { ...place.transform, y: 0 } } : place) },
    summary: "Move building",
  }));
  return { session, coordinator, prepare, preservedAfter: () => preservedAfter };
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

  it("prepares, reports and commits the same rerouted final snapshot", () => {
    const { session, coordinator, prepare } = rerouteSetup();
    const originalGeometry = structuredClone(session.getViewState().project.elements[0]!.geometry);
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    expect(prepared.changes.places.changed).toBe(1);
    expect(prepared.changes.elements.changed).toBe(1);
    expect(session.getViewState().project.elements[0]!.geometry).toEqual(originalGeometry);
    const applied = coordinator.apply(prepared.token);
    expect(applied.status).toBe("applied");
    if (applied.status !== "applied") throw new Error("expected applied transaction");
    expect(applied.changes).toEqual(prepared.changes);
    const finalProject = session.getViewState().project;
    expect(finalProject.elements[0]!.geometry).not.toEqual(originalGeometry);
    expect(roadFitsBuildings(finalProject, finalProject.elements[0]!)).toBe(true);
  });

  it("stores the finalized rerouted snapshot in a proposal without changing the live project", async () => {
    const { session, coordinator, prepare, preservedAfter } = rerouteSetup();
    const originalGeometry = structuredClone(session.getViewState().project.elements[0]!.geometry);
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    const proposed = await coordinator.propose(prepared.token);
    expect(proposed.status).toBe("proposed");
    expect(proposed.status === "proposed" && proposed.changes.elements.changed).toBe(1);
    expect(preservedAfter()?.elements[0]!.geometry).not.toEqual(originalGeometry);
    expect(session.getViewState().project.elements[0]!.geometry).toEqual(originalGeometry);
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
    expect(initial.undo().changed).toBe(true);
    expect(coordinator.apply(prepared.token)).toMatchObject({ status: "not-found" });
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

describe("EditorCommandCoordinator retention", () => {
  it("expires pending tokens at the configured TTL and keeps the not-found contract", () => {
    let now = 1_000;
    const { coordinator, prepare } = setup({ now: () => now, pendingTtlMs: 100 });
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");

    now += 100;
    expect(coordinator.apply(prepared.token)).toMatchObject({ status: "not-found", token: prepared.token });
  });

  it("evicts the oldest pending token deterministically when the limit is exceeded", () => {
    const { coordinator, prepare } = setup({ now: () => 2_000, maxPending: 1 });
    const first = prepare(); const second = prepare();
    if (first.status !== "prepared" || second.status !== "prepared") throw new Error("expected prepared tokens");

    expect(coordinator.discard(first.token)).toMatchObject({ status: "not-found", token: first.token });
    expect(coordinator.discard(second.token)).toMatchObject({ status: "discarded", token: second.token });
  });

  it("expires applied idempotency entries at the configured TTL", () => {
    let now = 3_000;
    const { coordinator, prepare } = setup({ now: () => now, appliedTtlMs: 100 });
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    expect(coordinator.apply(prepared.token).status).toBe("applied");

    now += 100;
    expect(coordinator.apply(prepared.token)).toMatchObject({ status: "not-found", token: prepared.token });
  });

  it("evicts the oldest applied idempotency entry deterministically", () => {
    let now = 4_000;
    const { coordinator } = setup({ now: () => now, maxApplied: 2 });
    const tokens: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const prepared = coordinator.prepare(`retention-${index}`, (project) => ({ project: { ...project, name: `Changed ${index}` }, summary: "Change project" }));
      if (prepared.status !== "prepared") throw new Error("expected prepared token");
      tokens.push(prepared.token);
      expect(coordinator.apply(prepared.token).status).toBe("applied");
      now += 1;
    }

    expect(coordinator.apply(tokens[0]!)).toMatchObject({ status: "not-found", token: tokens[0] });
    expect(coordinator.apply(tokens[1]!)).toMatchObject({ status: "applied", alreadyApplied: true });
    expect(coordinator.apply(tokens[2]!)).toMatchObject({ status: "applied", alreadyApplied: true });
  });
});
