import type { EditorProject } from "../model/project-model";
import type { EditorSession } from "../state/editor-session";
import { projectRevision } from "../state/project-revision";
import { projectDiff, type ProjectDiff } from "./project-diff";
import { agentSafetyReasons, assertAgentLocks, changedAgentRecordCount } from "./agent-change-policy";
import { editorProjectSchema } from "../persistence/project-file";
import { readProposalChanges } from "../story/review/proposal-change-review";
import type { ProposalChangeReadResult } from "../story/review/proposal-change-types";
import type { PreparedProjectTransaction } from "../state/editor-session";
import { boundedBytes, jsonBytes } from "./retention-budget";
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

type ReadyTransaction = Extract<PreparedProjectTransaction, { status: "ready" }>;
type PendingChange = PreparedChange & { baseRevision: string; transactionId: string; sessionToken: symbol; preparedTransaction: ReadyTransaction; createdAt: number; retainedBytes: number };
type AppliedResult = { status: "applied"; token: string; revision: string; changes: ProjectDiff; effects: string[]; warnings: string[] };
type RetainedAppliedResult = { result: AppliedResult; sessionToken: symbol; createdAt: number };

const DEFAULT_PENDING_TTL_MS = 10 * 60 * 1000;
const DEFAULT_APPLIED_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_PENDING = 100;
const DEFAULT_MAX_APPLIED = 1_000;
const DEFAULT_MAX_PENDING_BYTES = 64 * 1024 * 1024;

export type EditorCommandCoordinatorOptions = {
  now?: () => number;
  pendingTtlMs?: number;
  appliedTtlMs?: number;
  maxPending?: number;
  maxApplied?: number;
  maxPendingBytes?: number;
};

export class EditorCommandCoordinator {
  private readonly pending = new Map<string, PendingChange>();
  private readonly applied = new Map<string, RetainedAppliedResult>();
  // History ledgers retain identity tokens, never the old session and its undo history.
  private readonly sessionTokens = new WeakMap<EditorSession, symbol>();
  private readonly now: () => number;
  private readonly pendingTtlMs: number;
  private readonly appliedTtlMs: number;
  private readonly maxPending: number;
  private readonly maxApplied: number;
  private readonly maxPendingBytes: number;
  private currentSessionToken?: symbol;

  constructor(private readonly bridge: CommandBridge, options: EditorCommandCoordinatorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.pendingTtlMs = boundedDuration(options.pendingTtlMs, DEFAULT_PENDING_TTL_MS);
    this.appliedTtlMs = boundedDuration(options.appliedTtlMs, DEFAULT_APPLIED_TTL_MS);
    this.maxPending = boundedCount(options.maxPending, DEFAULT_MAX_PENDING);
    this.maxApplied = boundedCount(options.maxApplied, DEFAULT_MAX_APPLIED);
    this.maxPendingBytes = boundedBytes(options.maxPendingBytes, DEFAULT_MAX_PENDING_BYTES);
  }

  private purge(now: number) {
    for (const [token, change] of this.pending) if (now - change.createdAt >= this.pendingTtlMs) this.pending.delete(token);
    for (const [token, applied] of this.applied) if (now - applied.createdAt >= this.appliedTtlMs) this.applied.delete(token);
    this.removeOldest(this.pending, this.maxPending, this.maxPendingBytes, (entry) => entry.retainedBytes);
    this.removeOldest(this.applied, this.maxApplied);
  }

  private removeOldest<T extends { createdAt: number }>(entries: Map<string, T>, max: number, maxBytes = Number.POSITIVE_INFINITY, bytesOf: (entry: T) => number = () => 0) {
    const bytes = () => { let total = 0; for (const entry of entries.values()) total += bytesOf(entry); return total; };
    while (entries.size > max || bytes() > maxBytes) {
      let oldestToken: string | undefined;
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const [token, entry] of entries) {
        if (entry.createdAt < oldestAt) { oldestToken = token; oldestAt = entry.createdAt; }
      }
      if (oldestToken === undefined) return;
      entries.delete(oldestToken);
    }
  }

  private maintain() {
    const session = this.bridge.getSession();
    const sessionToken = this.getSessionToken(session);
    // Session changes trigger the same retention pass, but do not erase old
    // entries: their first lookup must still preserve the stale contract.
    if (this.currentSessionToken !== sessionToken) this.currentSessionToken = sessionToken;
    this.purge(this.now());
    return session;
  }

  private getSessionToken(session: EditorSession): symbol {
    const existing = this.sessionTokens.get(session);
    if (existing) return existing;
    const token = Symbol("editor-session"); this.sessionTokens.set(session, token); return token;
  }

  private stale(token: string, expectedRevision: string, actualRevision: string) {
    this.pending.delete(token);
    return { status: "stale" as const, token, expectedRevision, actualRevision };
  }

  private isCurrent(session: EditorSession, change: PendingChange) {
    return this.getSessionToken(session) === change.sessionToken
      && projectRevision(session.getViewState().project) === change.baseRevision
      && session.getViewState().project === change.preparedTransaction.before;
  }

  revision() {
    return projectRevision(this.maintain().getViewState().project);
  }

  prepare(transactionId: string, build: (project: EditorProject) => PreparedChange) {
    const session = this.maintain(); const before = session.getViewState().project; const baseRevision = projectRevision(before); const createdAt = this.now();
    let change: PreparedChange;
    try {
      change = build(structuredClone(before)); change.project = editorProjectSchema.parse(change.project); assertAgentLocks(before, change.project);
      // This value has already crossed the complete Zod boundary above.
      const preparedTransaction = session.prepareTransaction({ id: transactionId, isolation: "structural", apply: () => change.project });
      if (preparedTransaction.status === "blocked") return { status: "blocked" as const, reason: preparedTransaction.reason ?? preparedTransaction.code, revision: baseRevision };
      if (preparedTransaction.status === "no-change") return { status: "no-change" as const, revision: baseRevision, summary: change.summary };
      assertAgentLocks(before, preparedTransaction.project);
      change = { ...change, project: preparedTransaction.project };
      const changes = projectDiff(before, change.project);
      const retainedBytes = jsonBytes({ transactionId, project: change.project, summary: change.summary, effects: change.effects ?? [], warnings: change.warnings ?? [] });
      if (!this.maxPending || retainedBytes > this.maxPendingBytes) return { status: "blocked" as const, reason: "prepared-change-too-large", revision: baseRevision };
      const token = crypto.randomUUID();
      this.pending.set(token, { ...change, baseRevision, transactionId, sessionToken: this.getSessionToken(session), preparedTransaction, createdAt, retainedBytes });
      this.removeOldest(this.pending, this.maxPending, this.maxPendingBytes, (entry) => entry.retainedBytes);
      return { status: "prepared" as const, token, baseRevision, summary: change.summary, changes, effects: change.effects ?? [], warnings: change.warnings ?? [] };
    }
    catch (error) { return { status: "blocked" as const, reason: error instanceof Error ? error.message : String(error), revision: baseRevision }; }
  }

  apply(token: string) {
    this.maintain();
    const repeated = this.applied.get(token);
    if (repeated) {
      const current = this.bridge.getSession();
      if (this.getSessionToken(current) !== repeated.sessionToken) return { status: "stale" as const, token, expectedRevision: repeated.result.revision, actualRevision: projectRevision(current.getViewState().project) };
      return {
        ...repeated.result,
        alreadyApplied: true,
        stillCurrent: projectRevision(current.getViewState().project) === repeated.result.revision,
      };
    }
    const change = this.pending.get(token); if (!change) return { status: "not-found" as const, token };
    const session = this.bridge.getSession(); const before = session.getViewState().project; const revision = projectRevision(before);
    if (!this.isCurrent(session, change)) return this.stale(token, change.baseRevision, revision);
    const changes = projectDiff(before, change.project);
    const result = session.commitPreparedTransaction(change.preparedTransaction);
    this.pending.delete(token);
    if (!result.changed) return result.reason === "transaction-stale" || result.reason === "transaction-untrusted" ? this.stale(token, change.baseRevision, projectRevision(session.getViewState().project)) : { status: "blocked" as const, token, reason: result.code };
    this.bridge.refresh();
    const applied: AppliedResult = { status: "applied", token, revision: projectRevision(session.getViewState().project), changes, effects: change.effects ?? [], warnings: change.warnings ?? [] };
    this.applied.set(token, { result: applied, sessionToken: change.sessionToken, createdAt: this.now() });
    this.removeOldest(this.applied, this.maxApplied);
    return applied;
  }

  async applyWithSafety(token: string, _ignoredCallerTargetCount?: number) {
    void _ignoredCallerTargetCount;
    this.maintain();
    if (this.applied.has(token)) return this.apply(token);
    const change = this.pending.get(token); if (!change) return this.apply(token);
    const session = this.bridge.getSession(); const before = session.getViewState().project;
    if (!this.isCurrent(session, change)) return this.apply(token);
    const changedRecordCount = changedAgentRecordCount(before, change.project);
    const reasons = agentSafetyReasons(before, change.project, {
      changedRecordCount,
      clearLayer: change.effects?.some((effect) => effect.startsWith("cleared:")) === true,
    });
    let checkpointId: string | undefined;
    if (reasons.length && this.bridge.preserveAgentChange) {
      checkpointId = await this.bridge.preserveAgentChange(before, change.project, change.summary, "safety");
      this.maintain();
      const current = this.bridge.getSession(); const revision = projectRevision(current.getViewState().project);
      if (!this.isCurrent(current, change)) return this.stale(token, change.baseRevision, revision);
      if (!checkpointId) return { status: "blocked" as const, reason: "safety-checkpoint-not-saved" };
    }
    const result = this.apply(token);
    if (result.status === "applied") this.bridge.reportAgentChange?.({ summary: change.summary, changes: result.changes, checkpointId, revision: result.revision });
    return { ...result, checkpointId, safetyReasons: reasons };
  }

  async propose(token: string) {
    this.maintain();
    const change = this.pending.get(token); if (!change) return { status: "not-found" as const };
    const session = this.bridge.getSession(); const before = session.getViewState().project;
    if (!this.isCurrent(session, change)) { this.pending.delete(token); return { status: "stale" as const }; }
    if (!this.bridge.preserveAgentChange) return { status: "unavailable" as const };
    const checkpointId = await this.bridge.preserveAgentChange(before, change.project, change.summary, "proposal");
    this.maintain();
    const current = this.bridge.getSession();
    if (!this.isCurrent(current, change)) { this.pending.delete(token); return { status: "stale" as const }; }
    if (!checkpointId) return { status: "blocked" as const, reason: "proposal-not-saved" };
    const semanticChanges = readProposalChanges({ id: checkpointId, kind: "proposal", projectId: before.id, baseSnapshot: before, snapshot: change.project }, before, { checkpointId });
    const changes = projectDiff(before, change.project);
    this.pending.delete(token);
    this.bridge.reportAgentChange?.({ summary: change.summary, changes, checkpointId, proposal: true, semanticChanges });
    return { status: "proposed" as const, checkpointId, baseRevision: change.baseRevision, changes, semanticChanges };
  }

  discard(token: string) {
    this.maintain();
    const discarded = this.pending.delete(token);
    return { status: discarded ? "discarded" as const : "not-found" as const, token };
  }
}

function boundedDuration(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value as number) : fallback;
}

function boundedCount(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}
