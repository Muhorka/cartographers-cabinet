import type { EditorProject } from "../../model/project-model";
import { projectRevision, valueRevision } from "../../state/project-revision";
import type { RouteCalculationOutcome, StoryRouteCalculationService } from "../routes/route-service";
import { checkStoryIntention } from "./intention-check-service";
import { intentionsForScope } from "./scope";
import type { SceneCheckRequest, SceneReviewReport } from "./types";

/** Each attempt owns its immutable snapshot and request-local route cache. Checks are sequential. */
export function createSceneCheckService(routes: StoryRouteCalculationService) {
  let generation = 0;
  return {
    cancel() { generation += 1; routes.cancel(); },
    async check(project: EditorProject, request: SceneCheckRequest, isCurrent: () => boolean = () => true): Promise<SceneReviewReport> {
      generation += 1;
      const attempt = generation;
      routes.cancel();
      const snapshot = structuredClone(project);
      const input = structuredClone(request);
      const selected = intentionsForScope(snapshot, input.refs).filter(({ id }) => !input.intentionIds || input.intentionIds.includes(id));
      const limit = Math.min(50, Math.max(1, Math.floor(input.limit ?? 25)));
      const report: SceneReviewReport = { schemaVersion: 1, revision: projectRevision(snapshot), context: input.context ?? {}, status: "complete", total: selected.length, truncated: selected.length > limit, results: [] };
      const cached = new Map<string, RouteCalculationOutcome>();
      const sharedRoutes: StoryRouteCalculationService = {
        ...routes,
        async calculate(source, query) {
          const key = valueRevision(query);
          const previous = cached.get(key);
          if (previous) return previous;
          const outcome = await routes.calculate(source, query);
          if (outcome.status === "ready") cached.set(key, outcome);
          return outcome;
        },
      };
      const interruption = (): "cancelled" | "stale" | undefined => attempt !== generation ? "cancelled" : !isCurrent() ? "stale" : undefined;
      for (const intention of selected.slice(0, limit)) {
        const before = interruption();
        if (before) return { ...report, status: before, results: [] };
        const result = await checkStoryIntention(snapshot, { ...input, intentionId: intention.id }, sharedRoutes);
        const after = interruption();
        if (after) return { ...report, status: after, results: [] };
        report.results.push(result);
        // A cancelled worker is an interrupted observation, never a geometric conclusion.
        if (result.execution === "cancelled") return { ...report, status: "cancelled", results: [] };
      }
      const final = interruption();
      return final ? { ...report, status: final, results: [] } : report;
    },
  };
}
