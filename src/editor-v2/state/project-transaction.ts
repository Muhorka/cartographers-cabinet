import type { EditorProject } from "../model/project-model";
import { normalizeEditorProject } from "../model/project-model";
import { repairProjectConstructions } from "../model/construction-repair";
import { reconcileRoadRoutes } from "../roads/road-transaction";
import { immutableSnapshot } from "./immutable-snapshot";
import { projectRevision } from "./project-revision";

export type ProjectTransaction = {
  id: string;
  apply: (project: EditorProject) => EditorProject;
};

type TransactionIdentity = {
  createId(): string;
  createRoomName(index: number): string;
};

type PreparedBase = {
  transactionId: string;
  before: EditorProject;
};

export type PreparedProjectTransaction =
  | (PreparedBase & { status: "ready"; project: EditorProject })
  | (PreparedBase & { status: "no-change" })
  | (PreparedBase & { status: "blocked"; code: "transaction-failed" | "road-obstacle"; reason?: string });

const clone = <T>(value: T): T => structuredClone(value);
/** Resolves every canonical consequence once, without mutating the live session. */
export function prepareProjectTransaction(
  before: EditorProject,
  transaction: ProjectTransaction,
  identity: TransactionIdentity,
): PreparedProjectTransaction {
  let next: EditorProject;
  try {
    next = repairProjectConstructions(
      normalizeEditorProject(clone(transaction.apply(clone(before)))),
      { createId: identity.createId, createName: identity.createRoomName },
    );
    const routed = reconcileRoadRoutes(before, next);
    if (!routed) return { status: "blocked", code: "road-obstacle", transactionId: transaction.id, before };
    next = routed;
    if (projectRevision(next) === projectRevision(before)) return { status: "no-change", transactionId: transaction.id, before };
    return { status: "ready", transactionId: transaction.id, before, project: immutableSnapshot(next, before) };
  } catch (error) {
    return {
      status: "blocked",
      code: "transaction-failed",
      transactionId: transaction.id,
      before,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
