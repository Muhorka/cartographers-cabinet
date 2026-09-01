import { editorProjectSchema } from "../persistence/project-file";
import { projectRevision } from "../state/project-revision";
import { readProposalChanges } from "../story/review/proposal-change-review";
import type { ProposalChangeInput, ProposalChangeReadResult } from "../story/review/proposal-change-types";
import type { EditorAgentBridge } from "./register-agent-tools";

/** Shared lazy reader for the tool and existing proposal notice. Retains no snapshots. */
export function createProposalChangeReader(bridge: Pick<EditorAgentBridge, "getSession" | "getCheckpoint">) {
  return async (input: ProposalChangeInput): Promise<ProposalChangeReadResult> => {
    if (!bridge.getCheckpoint) return { status: "unavailable", reason: "checkpoint-loader-unavailable" };
    try {
      const session = bridge.getSession(); const current = session.getViewState().project; const revision = projectRevision(current);
      const checkpoint = await bridge.getCheckpoint(input.checkpointId);
      if (bridge.getSession() !== session || projectRevision(session.getViewState().project) !== revision) return { status: "stale-session", reason: "project-changed-during-read" };
      if (!checkpoint || checkpoint.projectId !== current.id || checkpoint.kind !== "proposal" || !checkpoint.baseSnapshot) return { status: "unavailable", reason: "proposal-pair-unavailable" };
      const before = editorProjectSchema.safeParse(checkpoint.baseSnapshot); const after = editorProjectSchema.safeParse(checkpoint.snapshot);
      if (!before.success || !after.success) return { status: "unavailable", reason: "invalid-proposal-data" };
      return readProposalChanges({ ...checkpoint, baseSnapshot: before.data, snapshot: after.data }, current, input);
    } catch { return { status: "unavailable", reason: "proposal-read-failed" }; }
  };
}
