"use client";
import { useCallback } from "react";
import type { EditorSession, EditorSessionState, ProjectTransaction, SessionResult } from "../state/editor-session";

export type EditorTransactionFailure = "road-obstacle" | "transaction-failed";
type EditorTransactionChange = EditorSessionState["project"] | ProjectTransaction["apply"];
export type EditorTransactionCommit = (id: string, change: EditorTransactionChange) => boolean;

function transactionFailure(result: SessionResult): EditorTransactionFailure | undefined {
  if (result.code === "committed" || result.code === "no-change") return undefined;
  return result.code === "road-obstacle" ? result.code : "transaction-failed";
}

export function useEditorTransaction(
  session: EditorSession | undefined,
  refresh: () => void,
  onFailure: (failure?: EditorTransactionFailure) => void,
) {
  const accept = useCallback((result: SessionResult) => {
    const failure = transactionFailure(result);
    onFailure(failure);
    refresh();
    return !failure;
  }, [onFailure, refresh]);
  const commit: EditorTransactionCommit = useCallback((id, change) => {
    if (!session) return false;
    const apply = typeof change === "function" ? change : () => change;
    return accept(session.executeTransaction({ id, apply, isolation: "structural" }));
  }, [accept, session]);
  return { accept, commit };
}
