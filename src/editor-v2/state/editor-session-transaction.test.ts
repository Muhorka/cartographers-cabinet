import { describe, expect, it } from "vitest";
import { emptyProject } from "../model/project-model";
import { createPlace } from "../model/hierarchy-operations";
import { EditorSession, type PreparedProjectTransaction } from "./editor-session";

describe("editor session transaction failures", () => {
  it("returns the transaction error reason without mutating the project", () => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    const session = new EditorSession(project);
    const result = session.executeTransaction({ id: "invalid", apply: () => { throw new Error("invalid geometry"); } });
    expect(result).toEqual({ code: "transaction-failed", changed: false, reason: "invalid geometry" });
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });

  it("rejects a transaction that would publish broken project relations", () => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    const session = new EditorSession(project, { initialPlaceId: "world" });
    const before = session.getViewState().project;
    const result = session.executeTransaction({
      id: "orphan-root",
      isolation: "structural",
      apply: (current) => ({ ...current, places: current.places.map((place) => ({ ...place, parentId: "missing" })) }),
    });
    expect(result).toEqual({ code: "transaction-failed", changed: false, reason: "Missing parent place: missing" });
    expect(session.getViewState().project).toBe(before);
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });

  it.each([
    ["replace project identity", (project: ReturnType<typeof emptyProject>) => ({ ...project, id: "another-project" }), "Project identity cannot change"],
    ["remove the last map", (project: ReturnType<typeof emptyProject>) => ({ ...project, places: [] }), "at least one map"],
  ])("rejects a transaction that would %s", (_label, apply, reason) => {
    let project = emptyProject("project", "Project");
    project = createPlace(project, { id: "world", name: "World", kind: "world" });
    const session = new EditorSession(project, { initialPlaceId: "world" });
    expect(session.executeTransaction({ id: "invalid-project", isolation: "structural", apply })).toEqual({ code: "transaction-failed", changed: false, reason: expect.stringContaining(reason) });
    expect(session.getViewState().project).toMatchObject({ id: "project", places: [{ id: "world" }] });
  });

  it("rejects malformed isolated output before it reaches session state", () => {
    const project = createPlace(emptyProject("project", "Project"), { id: "world", name: "World", kind: "world" });
    const session = new EditorSession(project);
    const before = session.getViewState().project;
    const result = session.executeTransaction({
      id: "invalid-measure-settings",
      apply: (project) => ({ ...project, measureSettings: { ...project.measureSettings, gridSpacingMeters: -1 } }),
    });
    expect(result).toMatchObject({ code: "transaction-failed", changed: false, reason: expect.stringContaining("measureSettings.gridSpacingMeters") });
    expect(session.getViewState().project).toBe(before);
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });

  it("prepares the canonical snapshot without publishing it and commits that exact snapshot once", () => {
    const session = new EditorSession(emptyProject("project", "Before"));
    const before = session.getViewState().project;
    const prepared = session.prepareTransaction({ id: "rename", apply: (project) => ({ ...project, name: "After" }) });
    expect(prepared.status).toBe("ready");
    expect(session.getViewState().project).toBe(before);
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
    if (prepared.status !== "ready") throw new Error("expected a ready transaction");
    expect(prepared.project.name).toBe("After");
    expect(session.commitPreparedTransaction(prepared)).toEqual({ code: "committed", changed: true });
    expect(session.getViewState().project).toBe(prepared.project);
    expect(session.getHistoryState()).toEqual({ canUndo: true, canRedo: false });
  });

  it("refuses a prepared snapshot after the live project has changed", () => {
    const session = new EditorSession(emptyProject("project", "Before"));
    const prepared = session.prepareTransaction({ id: "stale", apply: (project) => ({ ...project, name: "Stale" }) });
    session.executeTransaction({ id: "newer", apply: (project) => ({ ...project, name: "Newer" }) });
    expect(session.commitPreparedTransaction(prepared)).toEqual({ code: "transaction-failed", changed: false, reason: "transaction-stale" });
    expect(session.getViewState().project.name).toBe("Newer");
  });

  it("treats a timestamp-only update as a non-authored no-op", () => {
    const session = new EditorSession(emptyProject("project", "Before"));
    const before = session.getViewState().project;
    expect(session.executeTransaction({ id: "timestamp", apply: (project) => ({ ...project, updatedAt: "2030-01-01T00:00:00.000Z" }) })).toEqual({ code: "no-change", changed: false });
    expect(session.getViewState().project).toBe(before);
    expect(session.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  });

  it("consumes prepared transactions once and rejects forged snapshots", () => {
    const session = new EditorSession(emptyProject("project", "Before"));
    const before = session.getViewState().project;
    const prepared = session.prepareTransaction({ id: "rename", apply: (project) => ({ ...project, name: "After" }) });
    expect(session.commitPreparedTransaction(prepared).code).toBe("committed");
    expect(session.commitPreparedTransaction(prepared)).toEqual({ code: "transaction-failed", changed: false, reason: "transaction-untrusted" });
    const forged = { status: "ready", transactionId: "forged", before: session.getViewState().project, project: before } as PreparedProjectTransaction;
    expect(session.commitPreparedTransaction(forged)).toEqual({ code: "transaction-failed", changed: false, reason: "transaction-untrusted" });
    expect(session.getViewState().project.name).toBe("After");
  });
});
