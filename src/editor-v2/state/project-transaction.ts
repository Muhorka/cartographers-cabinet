import type { EditorProject } from "../model/project-model";
import { normalizeEditorProject } from "../model/project-model";
import { assertProjectIntegrity } from "../model/project-integrity";
import { repairProjectConstructions } from "../model/construction-repair";
import { reconcileRoadRoutes } from "../roads/road-transaction";
import { immutableSnapshot } from "./immutable-snapshot";
import { projectRevision } from "./project-revision";
import { produce, type Draft } from "immer";
import { editorProjectSchema } from "../persistence/project-file";

export type ProjectTransaction = {
  id: string;
  apply: (project: EditorProject) => EditorProject;
  /** Structural mode is reserved for trusted, typed editor operations. */
  isolation?: "isolated" | "structural";
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

function applyTransaction(before: EditorProject, transaction: ProjectTransaction) {
  if (transaction.isolation !== "structural") {
    // Compatibility boundary for imported/agent-authored transaction producers:
    // they may mutate and retain their editable input or return external data.
    return normalizeEditorProject(transaction.apply(clone(before)));
  }
  return produce(before, (draft) => {
    const result = transaction.apply(draft as unknown as EditorProject);
    if (result !== draft) return result as Draft<EditorProject>;
  });
}

/** Resolves every canonical consequence once, without mutating the live session. */
export function prepareProjectTransaction(
  before: EditorProject,
  transaction: ProjectTransaction,
  identity: TransactionIdentity,
): PreparedProjectTransaction {
  let next: EditorProject;
  try {
    next = repairProjectConstructions(
      applyTransaction(before, transaction),
      { createId: identity.createId, createName: identity.createRoomName },
      before,
    );
    const routed = reconcileRoadRoutes(before, next);
    if (!routed) return { status: "blocked", code: "road-obstacle", transactionId: transaction.id, before };
    next = routed;
    if (next.id !== before.id) throw new Error("Project identity cannot change inside a transaction.");
    if (before.places.length > 0 && next.places.length === 0) throw new Error("A project must keep at least one map.");
    if (next === before) return { status: "no-change", transactionId: transaction.id, before };
    if (next.schemaVersion !== 9 || !Array.isArray(next.surfaces) || !next.measureSettings || !next.story) {
      throw new Error("A transaction must return a complete canonical project.");
    }
    // Keep the established cross-record error contract (for example,
    // "Missing parent place") before reporting parser paths below.
    assertProjectIntegrity(next);
    if (next.places.length > 0) {
      // Every transaction crosses the complete file schema before it can be
      // published. The input side validates the same raw document shape but
      // skips the import-only normalization transform (structural transactions
      // are already canonical), so this does not clone the whole project.
      const validation = editorProjectSchema.in.safeParse(next);
      if (!validation.success) {
        const issue = validation.error.issues[0];
        const path = issue?.path.length ? issue.path.join(".") : "project";
        throw new Error(`Invalid project at ${path}: ${issue?.message ?? "schema validation failed"}`);
      }
    }
    if (transaction.isolation !== "structural" && projectRevision(next) === projectRevision(before)) return { status: "no-change", transactionId: transaction.id, before };
    const project = immutableSnapshot(next, before);
    if (project === before) return { status: "no-change", transactionId: transaction.id, before };
    return { status: "ready", transactionId: transaction.id, before, project };
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
