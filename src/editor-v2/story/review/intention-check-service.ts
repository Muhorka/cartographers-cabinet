import type { EditorProject } from "../../model/project-model";
import { projectRevision } from "../../state/project-revision";
import { effectiveProjectStoryObject, projectStoryAccess } from "../project-effective";
import { storyRefKey } from "../types";
import { evaluateStoryIntention } from "../routes/intention-evaluation";
import type { StoryRouteCalculationService } from "../routes/route-service";
import { canonicalReviewRef, intentionRefs, validateIntentionEndpoints, validateRouteEvidenceGeometry } from "./scope";
import type { IntentionCheckRequest, IntentionReviewResult, ReviewReason, ReviewStatus } from "./types";

/** Shared UI/tool check against a captured project; only the supplied route service computes paths. */
export async function checkStoryIntention(project: EditorProject, input: IntentionCheckRequest, routes: StoryRouteCalculationService): Promise<IntentionReviewResult> {
  const intention = project.story.intentions.find(({ id }) => id === input.intentionId);
  const saved = input.routeId ? project.story.routes.find(({ id }) => id === input.routeId) : undefined;
  const rawQuery = input.query ?? saved?.query;
  const context = input.context ?? { scenarioId: rawQuery?.scenarioId, stepId: rawQuery?.stepId };
  const actorId = input.actorId ?? rawQuery?.actorId ?? (intention?.kind === "access-rule" ? intention.accessEntryId : undefined);
  const allRefs = intention ? intentionRefs(project, intention) : [];
  const refs = allRefs.slice(0, 100);
  const refKeys = new Set(refs.map(storyRefKey));
  const evidence = project.story.evidence.filter((item) => item.refs.some((ref) => refKeys.has(storyRefKey(canonicalReviewRef(project, ref)))));
  const facts = refs.flatMap((ref) => {
    const object = effectiveProjectStoryObject(project, ref, context);
    if (!object) return [];
    const { name, description, metadata, effectiveProperties, conflicts } = object;
    return [{ ref: object.ref, name, description, metadata, effectiveProperties, conflicts }];
  });
  const base: IntentionReviewResult = {
    schemaVersion: 1, revision: projectRevision(project), context, actorId, intentionId: input.intentionId, intention,
    execution: "completed", status: "needs-author-review", reasonCode: "unsupported-intention", reason: "This intention needs author review.",
    proofScope: intention?.kind === "access-rule" ? "permission" : intention?.kind === "custom" ? "author" : "single-route",
    conditions: [], missingFacts: [], refs, facts, localEvidence: evidence.slice(0, 50), sourcesTruncated: allRefs.length > refs.length || evidence.length > 50,
    ...(input.routeId ? { routeId: input.routeId } : {}),
  };
  const finish = (status: ReviewStatus, reasonCode: ReviewReason, reason: string, extra: Partial<IntentionReviewResult> = {}): IntentionReviewResult => ({ ...base, status, reasonCode, reason, ...extra });
  if (!intention) return finish("needs-author-review", "intention-not-found", "The author intention no longer exists.");
  const normalized = { ...intention, subject: canonicalReviewRef(project, intention.subject), target: intention.target ? canonicalReviewRef(project, intention.target) : undefined, through: intention.through?.map((ref) => canonicalReviewRef(project, ref)) };
  const scenario = project.story.scenarios.find(({ id }) => id === context.scenarioId);
  if (context.scenarioId && !scenario || context.stepId && !scenario?.steps.some(({ id }) => id === context.stepId)) {
    return finish("needs-author-review", "context-not-found", "Choose an existing scenario and step.");
  }
  if (intention.kind === "access-rule") {
    const access = projectStoryAccess(project, normalized.subject, actorId, context);
    return finish(access.unknown ? "unknown" : access.allowed ? "satisfied" : "blocked", access.unknown ? "access-unknown" : access.allowed ? "access-allowed" : "access-denied", access.reason, { access, missingFacts: access.unknown ? [access.reason] : [] });
  }
  if (intention.kind === "custom") return base;
  if (input.query && input.routeId) return finish("needs-author-review", "ambiguous-query", "Choose either an explicit query or a saved route.");
  if (input.routeId && !saved) return finish("needs-author-review", "route-not-found", "The selected saved route no longer exists.");
  if (!rawQuery) return finish("needs-author-review", "query-required", "An explicit start/end query or saved route is required.");
  // A saved route supplies authored endpoints, not a cached proof; recalculate in the requested scene.
  const query = { ...rawQuery, scenarioId: context.scenarioId, stepId: context.stepId, actorId };
  const endpoints = validateIntentionEndpoints(project, normalized, query);
  if (!endpoints.valid) return finish("needs-author-review", endpoints.reason, "The explicit route endpoints must belong to the intention subject and target.", { query });
  const geometry = validateRouteEvidenceGeometry(project, query);
  if (!geometry.valid) return finish("needs-author-review", geometry.reason === "endpoint-unresolved" ? "geometry-required" : geometry.reason, "A proof requires authored outdoor bounds or a containing level face and level-local route points.", { query });
  try {
    const outcome = await routes.calculate(project, query);
    if (outcome.status !== "ready") {
      const reasonCode = outcome.status === "timeout" ? "timed-out" : outcome.status === "cancelled" ? "cancelled" : outcome.status === "stale" ? "not-current" : "calculation-failed";
      return finish(outcome.status, reasonCode, outcome.error ?? `Route calculation ${outcome.status}.`, { execution: outcome.status, query });
    }
    const result = outcome.result;
    if (!result) return finish("error", "calculation-failed", "The route calculation returned no result.", { execution: "error", query });
    const extra = { result, query, conditions: result.route?.conditions ?? [], missingFacts: result.missingFacts };
    if (result.status !== "ready" || !result.route) return finish(result.status === "unknown" ? "unknown" : "blocked", result.status === "unknown" ? "route-unknown" : "route-unreachable", result.status === "unknown" ? "The route contains unresolved access facts." : "No route satisfies the requested endpoints.", extra);
    if (intention.kind === "reachability") return finish(result.route.conditions.length ? "conditional" : "satisfied", "route-reachable", "The calculated route is reachable.", { ...extra, evidence: { routeId: result.route.id, refs } });
    const check = evaluateStoryIntention(project, normalized, result);
    const reasonCode = intention.kind === "must-pass"
      ? check.status === "needs-author-review" ? "must-pass-unresolved" : check.status === "blocked" ? "must-pass-missed" : "must-pass-satisfied"
      : check.status === "needs-author-review" ? "avoid-zone-unresolved" : check.status === "blocked" ? "avoid-zone-crossed" : "avoid-zone-satisfied";
    return finish(check.status, reasonCode, check.reason, { ...extra, evidence: check.evidence, conditions: check.conditions ?? extra.conditions });
  } catch (error) {
    return finish("error", "calculation-failed", error instanceof Error ? error.message : String(error), { execution: "error", query });
  }
}
