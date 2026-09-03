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
  const initial = new EditorSession(createPlace(emptyProject("coordinator", "Coordinator"), { id: "world", name: "World", kind: "world" }));
  let current = initial;
  const reports: unknown[] = [];
  const preserved: unknown[] = [];
  const bridge: CommandBridge = {
    getSession: () => current,
    refresh: vi.fn(),
    preserveAgentChange: async () => { preserved.push(true); return "checkpoint"; },
    reportAgentChange: (change) => { reports.push(change); },
  };
  const coordinator = new EditorCommandCoordinator(bridge, options);
  const base = initial.getState().project;
  const prepare = () => coordinator.prepare("coordinator-test", (project) => ({ project: { ...project, name: "Changed" }, summary: "Change project" }));
  const prepareSafety = () => coordinator.prepare("coordinator-safety-test", (project) => ({ project: { ...project, name: "Changed" }, summary: "Change project", effects: ["cleared:sketch:all:world"] }));
  const replaceSession = () => { current = new EditorSession(base); };
  return { initial, bridge, coordinator, base, prepare, prepareSafety, replaceSession, reports, preserved };
}

function bulkDeleteSetup() {
  const base = createPlace(emptyProject("bulk", "Bulk"), { id: "world", name: "World", kind: "world" });
  base.elements = Array.from({ length: 5 }, (_, index) => ({ ...road, id: `element-${index}`, belongsToId: "world" }));
  const session = new EditorSession(base);
  const preserved: { before: EditorProject; after: EditorProject }[] = [];
  const bridge: CommandBridge = {
    getSession: () => session,
    refresh: vi.fn(),
    preserveAgentChange: async (before, after) => { preserved.push({ before, after }); return "checkpoint"; },
  };
  const coordinator = new EditorCommandCoordinator(bridge);
  const prepare = () => coordinator.prepare("bulk-delete", (before) => ({ project: { ...before, elements: [] }, summary: "Delete five records" }));
  return { session, coordinator, prepare, preserved };
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
    const { initial, bridge, coordinator, base, prepareSafety, replaceSession, reports } = setup();
    const prepared = prepareSafety();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");
    const gate = deferred<string>();
    bridge.preserveAgentChange = async () => gate.promise;
    const applying = coordinator.applyWithSafety(prepared.token);
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
    const { initial, coordinator, base, prepareSafety, reports } = setup();
    const prepared = prepareSafety();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");

    const applied = await coordinator.applyWithSafety(prepared.token);
    expect(applied).toMatchObject({ status: "applied", checkpointId: "checkpoint" });
    expect(applied).not.toHaveProperty("session");
    expect(applied).not.toHaveProperty("sessionToken");
    expect(Object.values(applied).some((value) => typeof value === "symbol")).toBe(false);
    const repeated = coordinator.apply(prepared.token);
    expect(repeated).toMatchObject({ status: "applied", alreadyApplied: true, stillCurrent: true });
    expect(repeated).not.toHaveProperty("session");
    expect(repeated).not.toHaveProperty("sessionToken");
    expect(Object.values(repeated).some((value) => typeof value === "symbol")).toBe(false);
    expect(initial.getState().project.name).toBe("Changed");
    expect(initial.getHistoryState()).toEqual({ canUndo: true, canRedo: false });
    expect(reports).toHaveLength(1);
    expect(initial.undo().changed).toBe(true);
    expect(initial.getState().project).toEqual(base);
    expect(coordinator.apply(prepared.token)).toMatchObject({ status: "applied", alreadyApplied: true, stillCurrent: false });
  });

  it("safety-traces five records deleted by a prepared token", async () => {
    const { coordinator, prepare, preserved } = bulkDeleteSetup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");

    const applied = await coordinator.applyWithSafety(prepared.token);
    expect(applied).toMatchObject({ status: "applied", checkpointId: "checkpoint", safetyReasons: ["many-targets"] });
    expect(preserved).toHaveLength(1);
    expect(preserved[0].before.elements).toHaveLength(5);
    expect(preserved[0].after.elements).toHaveLength(0);
  });

  it("does not trust an obsolete caller target count", async () => {
    const { coordinator, prepare, preserved } = setup();
    const prepared = prepare();
    if (prepared.status !== "prepared") throw new Error("expected prepared token");

    const legacyCall = coordinator.applyWithSafety.bind(coordinator) as unknown as (token: string, targetCount: number) => Promise<{ status: string }>;
    expect(await legacyCall(prepared.token, 999)).toMatchObject({ status: "applied" });
    expect(preserved).toHaveLength(0);
  });

  it("safety-traces a clear-layer prepared change even below the record threshold", async () => {
    const { coordinator, preserved } = setup();
    const prepared = coordinator.prepare("clear-layer", (project) => ({ project: { ...project, name: "Cleared" }, summary: "Clear sketch layer", effects: ["cleared:sketch:all:world"] }));
    if (prepared.status !== "prepared") throw new Error("expected prepared token");

    const applied = await coordinator.applyWithSafety(prepared.token);
    expect(applied).toMatchObject({ status: "applied", checkpointId: "checkpoint", safetyReasons: ["clear-layer"] });
    expect(preserved).toHaveLength(1);
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
    const outcome = method === "applyWithSafety" ? await coordinator.applyWithSafety(prepared.token) : await coordinator.propose(prepared.token);
    expect(outcome).toMatchObject({ status: "stale" }); expect(preserve).not.toHaveBeenCalled(); expect(reports).toHaveLength(0);
    expect(initial.getState().project).toEqual(base); expect(bridge.getSession().getState().project).toEqual(base);
    expect(initial.getHistoryState().canUndo).toBe(false); expect(bridge.getSession().getHistoryState().canUndo).toBe(false);
  });

});
