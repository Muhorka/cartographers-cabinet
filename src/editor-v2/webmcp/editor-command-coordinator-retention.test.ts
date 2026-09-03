import { describe, expect, it, vi } from "vitest";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { EditorCommandCoordinator, type CommandBridge, type EditorCommandCoordinatorOptions } from "./editor-command-coordinator";

function setup(options: EditorCommandCoordinatorOptions = {}) {
  const session = new EditorSession(createPlace(emptyProject("coordinator", "Coordinator"), { id: "world", name: "World", kind: "world" }));
  const bridge: CommandBridge = { getSession: () => session, refresh: vi.fn() };
  const coordinator = new EditorCommandCoordinator(bridge, options);
  const prepare = () => coordinator.prepare("retention-test", (project) => ({ project: { ...project, name: "Changed" }, summary: "Change project" }));
  return { coordinator, prepare };
}

describe("EditorCommandCoordinator retention", () => {
  it("expires pending tokens at the configured TTL and keeps the not-found contract", () => {
    let now = 1_000; const { coordinator, prepare } = setup({ now: () => now, pendingTtlMs: 100 });
    const prepared = prepare(); if (prepared.status !== "prepared") throw new Error("expected prepared token");
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

  it("rejects a prepared change that exceeds the pending byte budget", () => {
    const { coordinator, prepare } = setup({ maxPendingBytes: 1 });
    expect(prepare()).toMatchObject({ status: "blocked", reason: "prepared-change-too-large" });
    expect(coordinator.revision()).toContain("coordinator:");
  });

  it("expires applied idempotency entries at the configured TTL", () => {
    let now = 3_000; const { coordinator, prepare } = setup({ now: () => now, appliedTtlMs: 100 });
    const prepared = prepare(); if (prepared.status !== "prepared") throw new Error("expected prepared token");
    expect(coordinator.apply(prepared.token).status).toBe("applied"); now += 100;
    expect(coordinator.apply(prepared.token)).toMatchObject({ status: "not-found", token: prepared.token });
  });

  it("evicts the oldest applied idempotency entry deterministically", () => {
    let now = 4_000; const { coordinator } = setup({ now: () => now, maxApplied: 2 }); const tokens: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const prepared = coordinator.prepare(`retention-${index}`, (project) => ({ project: { ...project, name: `Changed ${index}` }, summary: "Change project" }));
      if (prepared.status !== "prepared") throw new Error("expected prepared tokens");
      tokens.push(prepared.token); expect(coordinator.apply(prepared.token).status).toBe("applied"); now += 1;
    }
    expect(coordinator.apply(tokens[0]!)).toMatchObject({ status: "not-found", token: tokens[0] });
    expect(coordinator.apply(tokens[1]!)).toMatchObject({ status: "applied", alreadyApplied: true });
    expect(coordinator.apply(tokens[2]!)).toMatchObject({ status: "applied", alreadyApplied: true });
  });
});
