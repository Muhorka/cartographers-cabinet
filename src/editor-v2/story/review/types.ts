import type { EditorProject } from "../../model/project-model";
import type { StoryAccessResult } from "../effective";
import type { StoryEvidence, StoryObjectRef, StoryViewContext } from "../types";
import type { StoryRouteRequest, StoryRouteResult } from "../routes/types";
import type { effectiveProjectStoryObject } from "../project-effective";

type ReviewIntention = EditorProject["story"]["intentions"][number];
export type ReviewContext = Pick<StoryViewContext, "scenarioId" | "stepId">;
type ReviewExecution = "completed" | "cancelled" | "timeout" | "stale" | "error";
export type ReviewStatus = "satisfied" | "conditional" | "blocked" | "unknown" | "needs-author-review" | Exclude<ReviewExecution, "completed">;
export type ReviewReason = "intention-not-found" | "context-not-found" | "route-not-found" | "query-required" | "ambiguous-query"
  | "unsupported-intention" | "endpoint-mismatch" | "endpoint-unresolved" | "target-required" | "geometry-required"
  | "access-allowed" | "access-denied" | "access-unknown" | "route-reachable" | "route-unreachable" | "route-unknown"
  | "must-pass-satisfied" | "must-pass-missed" | "must-pass-unresolved" | "avoid-zone-satisfied" | "avoid-zone-crossed" | "avoid-zone-unresolved"
  | "calculation-failed" | "not-current" | "cancelled" | "timed-out";

type EffectiveObject = NonNullable<ReturnType<typeof effectiveProjectStoryObject>>;
type ReviewFact = Pick<EffectiveObject, "ref" | "name" | "description" | "metadata" | "effectiveProperties" | "conflicts">;
export type IntentionCheckRequest = {
  intentionId: string;
  actorId?: string;
  context?: ReviewContext;
  query?: StoryRouteRequest;
  routeId?: string;
};

/** A transient observation. It never changes the author's accepted/draft intention. */
export type IntentionReviewResult = {
  schemaVersion: 1;
  revision: string;
  context: ReviewContext;
  actorId?: string;
  intentionId: string;
  intention?: ReviewIntention;
  execution: ReviewExecution;
  status: ReviewStatus;
  reasonCode: ReviewReason;
  reason: string;
  proofScope: "permission" | "single-route" | "author";
  conditions: string[];
  missingFacts: string[];
  refs: StoryObjectRef[];
  facts: ReviewFact[];
  localEvidence: StoryEvidence[];
  sourcesTruncated: boolean;
  evidence?: { routeId?: string; refs?: StoryObjectRef[]; zoneId?: string };
  query?: StoryRouteRequest;
  routeId?: string;
  result?: StoryRouteResult;
  access?: StoryAccessResult;
};

export type SceneCheckRequest = Omit<IntentionCheckRequest, "intentionId"> & {
  refs?: readonly StoryObjectRef[];
  intentionIds?: readonly string[];
  limit?: number;
};
export type SceneReviewReport = {
  schemaVersion: 1;
  revision: string;
  context: ReviewContext;
  status: "complete" | "cancelled" | "stale" | "error";
  total: number;
  truncated: boolean;
  results: IntentionReviewResult[];
};
