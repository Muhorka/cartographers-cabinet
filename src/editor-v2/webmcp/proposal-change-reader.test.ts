import { describe, expect, it, vi } from "vitest";
import { EditorSession } from "../state/editor-session";
import { createProjectCheckpoint, type ProjectCheckpoint } from "../persistence/project-checkpoint";
import { reviewFixture } from "../story/review/review-test-fixture";
import { readProposalChanges } from "../story/review/proposal-change-review";
import { createProposalChangeReader } from "./proposal-change-reader";
import { createProposalChangeTools } from "./proposal-change-tools";
import { EditorCommandCoordinator, type CommandBridge } from "./editor-command-coordinator";

function setup() {
  const session = new EditorSession(reviewFixture()); const before = session.getViewState().project; const after = structuredClone(before);
  after.story.objects.push({ ref: { kind: "opening", id: "door", scopeId: "construction" }, metadata: { owners: ["alice"] } });
  const checkpoint = createProjectCheckpoint(after, { id: "proposal", name: "Synthetic proposal", kind: "proposal", baseSnapshot: before });
  const bridge = { getSession: () => session, getCheckpoint: vi.fn(async () => checkpoint) };
  return { session, before, after, checkpoint, bridge };
}

describe("shared proposal checkpoint reader", () => {
  it("returns exactly the same semantic page through UI reader and tool without changing history", async () => {
    const { bridge, session, before } = setup(); const history = session.getHistoryState();
    const read = createProposalChangeReader(bridge); const tool = createProposalChangeTools(bridge)[0];
    const input = { checkpointId: "proposal" };
    const page = await read(input); const result = await tool.execute(input) as { structuredContent: unknown };
    expect(page.status).toBe("ready"); expect(result.structuredContent).toEqual(page);
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(session.getViewState().project).toEqual(before); expect(session.getHistoryState()).toEqual(history);
    expect(page).not.toHaveProperty("snapshot"); expect(page).not.toHaveProperty("baseSnapshot");
  });

  it("keeps stale proposal values historical instead of using the new live names or values", async () => {
    const { session, bridge, checkpoint, before } = setup();
    session.executeTransaction({ id: "rename", apply: (project) => ({ ...project, story: { ...project.story, world: project.story.world.map((entry) => ({ ...entry, name: "New live name" })) } }) });
    const result = await createProposalChangeReader(bridge)({ checkpointId: checkpoint.id });
    const original = readProposalChanges(checkpoint, before, { checkpointId: checkpoint.id });
    expect(result).toMatchObject({ status: "ready", applicability: "stale" });
    if (result.status !== "ready" || original.status !== "ready") throw new Error("expected report");
    expect(result.rows).toEqual(original.rows); expect(result.rows[0].display.en.authoredAfter).toBe("Alice");
  });

  it.each(["replacement", "revision"])("rejects a late page after session %s changes", async (kind) => {
    const { session, checkpoint } = setup(); let current = session; let resolve!: (value: ProjectCheckpoint) => void;
    const read = createProposalChangeReader({ getSession: () => current, getCheckpoint: () => new Promise((done) => { resolve = done; }) });
    const pending = read({ checkpointId: checkpoint.id });
    if (kind === "replacement") current = new EditorSession(session.getState().project);
    else session.executeTransaction({ id: "rename", apply: (project) => ({ ...project, name: "Changed while loading" }) });
    resolve(checkpoint); expect(await pending).toMatchObject({ status: "stale-session" });
  });

  it("does not inspect another project's checkpoint or invent a missing proposal base", async () => {
    const { bridge, checkpoint } = setup();
    bridge.getCheckpoint.mockResolvedValue({ ...checkpoint, projectId: "another-project" });
    expect(await createProposalChangeReader(bridge)({ checkpointId: checkpoint.id })).toMatchObject({ status: "unavailable" });
    bridge.getCheckpoint.mockResolvedValue({ ...checkpoint, baseSnapshot: undefined });
    expect(await createProposalChangeReader(bridge)({ checkpointId: checkpoint.id })).toMatchObject({ status: "unavailable" });
  });
});

describe("coordinator proposal report parity", () => {
  it("publishes the same exact field page to the tool and notice while leaving the live project untouched", async () => {
    const { session, before, after } = setup(); const reports: Parameters<NonNullable<CommandBridge["reportAgentChange"]>>[0][] = [];
    let saved!: ProjectCheckpoint;
    const coordinator = new EditorCommandCoordinator({ getSession: () => session, refresh: vi.fn(), reportAgentChange: (report) => { reports.push(report); },
      preserveAgentChange: async (base, proposed, summary, kind) => { saved = createProjectCheckpoint(proposed, { id: "preserved", name: summary, kind, baseSnapshot: base }); return saved.id; } });
    const prepared = coordinator.prepare("propose-owner", () => ({ project: after, summary: "Propose owner change" }));
    if (prepared.status !== "prepared") throw new Error("expected prepared proposal");
    const result = await coordinator.propose(prepared.token);
    if (result.status !== "proposed") throw new Error("expected saved proposal");
    expect(result.semanticChanges).toEqual(reports[0].semanticChanges);
    expect(result.semanticChanges).toEqual(readProposalChanges(saved, before, { checkpointId: saved.id }));
    expect(result.changes.story.changed + result.changes.story.added).toBe(1);
    expect(session.getViewState().project).toEqual(before); expect(session.getHistoryState().canUndo).toBe(false);
  });

  it("does not add the proposal-only contract to ordinary applied changes", async () => {
    const { session, after } = setup();
    const coordinator = new EditorCommandCoordinator({ getSession: () => session, refresh: vi.fn() });
    const prepared = coordinator.prepare("owner", () => ({ project: after, summary: "Owner" }));
    if (prepared.status !== "prepared") throw new Error("expected change");
    expect(await coordinator.applyWithSafety(prepared.token)).not.toHaveProperty("semanticChanges");
    expect(session.undo().changed).toBe(true);
  });
});
