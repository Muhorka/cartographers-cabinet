import type { StoryObjectRef, StoryPropertyValue, StoryViewContext } from "../types";

export type ProposalValue = { present: false } | { present: true; value: StoryPropertyValue };
export type ProposalChangeInput = {
  checkpointId: string; refs?: StoryObjectRef[]; context?: Pick<StoryViewContext, "scenarioId" | "stepId">;
  cursor?: string; limit?: number;
};
export type ProposalChangeSource = { collection: "objects" | "scenarios"; scenarioId?: string; stepId?: string; patchId?: string };
type FieldEvidence = { provenanceAvailable: boolean; sources: string[]; conflicts: string[] };
type FieldDisplay = { field: string; objectBefore: string; objectAfter: string; authoredBefore: string; authoredAfter: string; effectiveBefore: string; effectiveAfter: string };
export type ProposalFieldRow = {
  id: string; ref: StoryObjectRef; context: Pick<StoryViewContext, "scenarioId" | "stepId">;
  source: ProposalChangeSource; fieldKey: string; authoredPath: string;
  operation: "add" | "remove" | "change";
  authoredBefore: ProposalValue; authoredAfter: ProposalValue;
  effectiveBefore: ProposalValue; effectiveAfter: ProposalValue; effectiveChanged: boolean | null;
  missing: { objectBefore: boolean; objectAfter: boolean; contextBefore: boolean; contextAfter: boolean };
  evidence: { before: FieldEvidence; after: FieldEvidence };
  names: { scenarioBefore?: string; scenarioAfter?: string; stepBefore?: string; stepAfter?: string; scopeBefore?: string; scopeAfter?: string };
  display: Record<"pl" | "en", FieldDisplay>;
};
type ProposalChangePage = {
  status: "ready"; schemaVersion: 1; kind: "proposal";
  checkpointId: string; projectId: string; beforeRevision: string; afterRevision: string;
  applicability: "current" | "stale";
  query: Pick<ProposalChangeInput, "refs" | "context">;
  coverage: { directTargetsOnly: true; supportedFields: string[]; unsupportedChanges: string[]; indirectEffectsIncluded: false };
  total: number; offset: number; limit: number; rows: ProposalFieldRow[]; nextCursor?: string;
};
export type ProposalChangeReadResult = ProposalChangePage | {
  status: "unavailable" | "stale-session" | "invalid-cursor" | "invalid-input";
  reason: string;
};
