import type { EditorProject } from "../model/project-model";
import type { EditorSession } from "../state/editor-session";
import { projectRevision } from "../state/project-revision";
import { projectDiff, type ProjectDiff } from "./project-diff";
import { agentSafetyReasons, assertAgentLocks } from "./agent-change-policy";
import { editorProjectSchema } from "../persistence/project-file";
import { readProposalChanges } from "../story/review/proposal-change-review";
import type { ProposalChangeReadResult } from "../story/review/proposal-change-types";
export { projectDiff } from "./project-diff";

export type PreparedChange = {
  project: EditorProject;
  summary: string;
  effects?: string[];
  warnings?: string[];
};

export type CommandBridge = {
  getSession(): EditorSession;
  refresh(): void;
  preserveAgentChange?(before: EditorProject, after: EditorProject, summary: string, kind: "safety" | "proposal"): Promise<string | undefined>;
  reportAgentChange?(change: { summary: string; changes: ProjectDiff; checkpointId?: string; proposal?: boolean; revision?: string; semanticChanges?: ProposalChangeReadResult }): void;
};

type PendingChange = PreparedChange & { baseRevision: string; transactionId: string; sessionToken: symbol };
type AppliedResult = { status: "applied"; token: string; revision: string; changes: ProjectDiff; effects: string[]; warnings: string[] };

export class EditorCommandCoordinator {
  private readonly pending = new Map<string, PendingChange>();
  private readonly applied = new Map<string, { result: AppliedResult; sessionToken: symbol }>();
  // History ledgers retain identity tokens, never the old session and its undo history.
  private readonly sessionTokens = new WeakMap<EditorSession, symbol>();

  constructor(private readonly bridge: CommandBridge) {}

  private getSessionToken(session: EditorSession): symbol {
    const existing = this.sessionTokens.get(session);
    if (existing) return existing;
    const token = Symbol("editor-session"); this.sessionTokens.set(session, token); return token;
  }

  revision() {
    return projectRevision(this.bridge.getSession().getState().project);
  }

  prepare(transactionId: string, build: (project: EditorProject) => PreparedChange) {
    const session = this.bridge.getSession(); const before = session.getState().project; const baseRevision = projectRevision(before);
    let change: PreparedChange;
    try { change = build(structuredClone(before)); change.project = editorProjectSchema.parse(change.project); assertAgentLocks(before, change.project); }
    catch (error) { return { status: "blocked" as const, reason: error instanceof Error ? error.message : String(error), revision: baseRevision }; }
    const changes = projectDiff(before, change.project);
    if (baseRevision === projectRevision(change.project)) return { status: "no-change" as const, revision: baseRevision, summary: change.summary };
    const token = crypto.randomUUID(); this.pending.set(token, { ...change, baseRevision, transactionId, sessionToken: this.getSessionToken(session) });
    return { status: "prepared" as const, token, baseRevision, summary: change.summary, changes, effects: change.effects ?? [], warnings: change.warnings ?? [] };
  }

  apply(token: string) {
    const repeated = this.applied.get(token);
    if (repeated) {
      const current = this.bridge.getSession();
      if (this.getSessionToken(current) !== repeated.sessionToken) return { status: "stale" as const, token, expectedRevision: repeated.result.revision, actualRevision: projectRevision(current.getState().project) };
      return { ...repeated.result, alreadyApplied: true };
    }
    const change = this.pending.get(token); if (!change) return { status: "not-found" as const, token };
    const session = this.bridge.getSession(); const before = session.getState().project; const revision = projectRevision(before);
    if (this.getSessionToken(session) !== change.sessionToken || revision !== change.baseRevision) return { status: "stale" as const, token, expectedRevision: change.baseRevision, actualRevision: revision };
    const changes = projectDiff(before, change.project);
    const result = session.executeTransaction({ id: change.transactionId, apply: () => change.project });
    if (!result.changed) return { status: "blocked" as const, token, reason: result.code };
    this.pending.delete(token); this.bridge.refresh();
    const applied: AppliedResult = { status: "applied", token, revision: projectRevision(session.getState().project), changes, effects: change.effects ?? [], warnings: change.warnings ?? [] };
    this.applied.set(token, { result: applied, sessionToken: change.sessionToken }); return applied;
  }

  async applyWithSafety(token: string, targetCount = 0) {
    if (this.applied.has(token)) return this.apply(token);
    const change = this.pending.get(token); if (!change) return this.apply(token);
    const session = this.bridge.getSession(); const before = session.getState().project;
    if (this.getSessionToken(session) !== change.sessionToken || projectRevision(before) !== change.baseRevision) return this.apply(token);
    const reasons = agentSafetyReasons(before, change.project, targetCount);
    let checkpointId: string | undefined;
    if (reasons.length && this.bridge.preserveAgentChange) {
      checkpointId = await this.bridge.preserveAgentChange(before, change.project, change.summary, "safety");
      const current = this.bridge.getSession(); const revision = projectRevision(current.getState().project);
      if (this.getSessionToken(current) !== change.sessionToken || revision !== change.baseRevision) return { status: "stale" as const, token, expectedRevision: change.baseRevision, actualRevision: revision };
      if (!checkpointId) return { status: "blocked" as const, reason: "safety-checkpoint-not-saved" };
    }
    const result = this.apply(token);
    if (result.status === "applied") this.bridge.reportAgentChange?.({ summary: change.summary, changes: result.changes, checkpointId, revision: result.revision });
    return { ...result, checkpointId, safetyReasons: reasons };
  }

  async propose(token: string) {
    const change = this.pending.get(token); if (!change) return { status: "not-found" as const };
    const session = this.bridge.getSession(); const before = session.getState().project;
    if (this.getSessionToken(session) !== change.sessionToken || projectRevision(before) !== change.baseRevision) return { status: "stale" as const };
    if (!this.bridge.preserveAgentChange) return { status: "unavailable" as const };
    const checkpointId = await this.bridge.preserveAgentChange(before, change.project, change.summary, "proposal");
    const current = this.bridge.getSession();
    if (this.getSessionToken(current) !== change.sessionToken || projectRevision(current.getState().project) !== change.baseRevision) return { status: "stale" as const };
    if (!checkpointId) return { status: "blocked" as const, reason: "proposal-not-saved" };
    const semanticChanges = readProposalChanges({ id: checkpointId, kind: "proposal", projectId: before.id, baseSnapshot: before, snapshot: change.project }, before, { checkpointId });
    const changes = projectDiff(before, change.project);
    this.pending.delete(token);
    this.bridge.reportAgentChange?.({ summary: change.summary, changes, checkpointId, proposal: true, semanticChanges });
    return { status: "proposed" as const, checkpointId, baseRevision: change.baseRevision, changes, semanticChanges };
  }

  discard(token: string) {
    const discarded = this.pending.delete(token);
    return { status: discarded ? "discarded" as const : "not-found" as const, token };
  }
}
