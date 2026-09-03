import { z } from "zod";
import { isStoryRouteCurrent, storyRouteRevision } from "../story/routes/revision";
import { routeRequestSchema } from "../story/routes/schema";
import { checkStoryIntention } from "../story/review/intention-check-service";
import { storyViewContextSchema } from "../story/schema";
import { projectRevision } from "../state/project-revision";
import { createStoryRouteCalculationService } from "../story/routes/route-service";
import type { EditorAgentBridge } from "./register-agent-tools";
import { inspectEditorContext, type EditorContextBridge } from "./editor-context";
import type { EditorCommandCoordinator } from "./editor-command-coordinator";

const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });
const routeQuery = z.object({ query: routeRequestSchema }).strict();
const saveQuery = routeQuery.extend({ id: z.string().min(1).optional(), name: z.string().trim().min(1).max(2000) }).strict();
const intentionQuery = z.object({ intentionId: z.string().min(1), actorId: z.string().optional(), context: storyViewContextSchema.optional(), query: routeRequestSchema.optional(), routeId: z.string().min(1).optional() }).strict();
export function createStoryRouteTools(bridge: EditorAgentBridge & EditorContextBridge, coordinator: EditorCommandCoordinator, suppliedRouteService?: ReturnType<typeof createStoryRouteCalculationService>): WebMcpTool[] {
  const routeService = suppliedRouteService ?? createStoryRouteCalculationService();
  const context = (): { scenarioId?: string; stepId?: string } => { const view = bridge.getEditorContext?.().view; return { scenarioId: view?.scenarioId, stepId: view?.stepId }; };
  const capture = (query: z.infer<typeof routeRequestSchema>, requestedContext = context()) => {
    const session = bridge.getSession(); const project = session.getViewState().project; const inspected = inspectEditorContext(bridge);
    return { session, project, query: { ...requestedContext, ...query }, baseRevision: projectRevision(project), contextVersion: inspected.contextVersion };
  };
  const isStale = (run: ReturnType<typeof capture>) => {
    try { const current = bridge.getSession(); return current !== run.session || projectRevision(current.getViewState().project) !== run.baseRevision || inspectEditorContext(bridge).contextVersion !== run.contextVersion; }
    catch { return true; }
  };
  const staleResponse = (run: ReturnType<typeof capture>) => response({ status: "stale" as const, expectedRevision: run.baseRevision, actualRevision: (() => { try { return projectRevision(bridge.getSession().getViewState().project); } catch { return undefined; } })() });
  const calculate = async (run: ReturnType<typeof capture>) => {
    const outcome = await routeService.calculate(run.project, run.query); if (outcome.status !== "ready") return response({ status: outcome.status, error: outcome.error, attemptId: outcome.attemptId });
    if (isStale(run)) return staleResponse(run); return response(outcome.result);
  };
  return [
    { name: "find_story_routes", description: "Read routes through openings, floors and outdoors using access/traveller width. Coordinates: LOCAL metres per place; defaults: active scenario/step. Vehicles follow roads; foot/mounted may go offroad. Returns ready/unreachable/unknown, revision, conditions, up to 3 alternatives. Timeout/cancel/error/stale never prove inaccessibility. Limit20s; new requests cancel old. Unknown guards/secrets remain missing facts.", inputSchema: z.toJSONSchema(routeQuery, { io: "input" }), annotations: { readOnlyHint: true }, execute: async (raw) => {
      const { query } = routeQuery.parse(raw); return calculate(capture(query));
    } },
    { name: "prepare_save_story_route", description: "Calculate/save a named route, actual result and revision, not caller paths. Geometry/narrative changes invalidate it; saving records does not. Never save timeout/cancel/error/stale results. Commit via execute_editor_batch.", inputSchema: z.toJSONSchema(saveQuery, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (raw) => {
      const input = saveQuery.parse(raw); const run = capture(input.query); const outcome = await routeService.calculate(run.project, run.query);
      if (outcome.status !== "ready") return response({ status: outcome.status, error: outcome.error, attemptId: outcome.attemptId });
      if (isStale(run)) return staleResponse(run);
      const result = outcome.result!; const id = input.id ?? crypto.randomUUID();
      return response(coordinator.prepare(`story-route:${crypto.randomUUID()}`, (project) => {
        const record = { id, name: input.name, query: run.query, result, sourceRevision: result.sourceRevision };
        return { project: { ...project, story: { ...project.story, routes: [...project.story.routes.filter(({ id: routeId }) => routeId !== record.id), record] } }, summary: `Zachowano trasę „${input.name}”.` };
      }));
    } },
    { name: "check_story_intention", description: "Read an author intention with evidence. Access uses effective lens/route rules; reachability/geometry need an explicit matching query; must-pass/avoid-zone prove only the calculated route and authored geometry. Conditional routes stay conditional. Read-only.", inputSchema: z.toJSONSchema(intentionQuery, { io: "input" }), annotations: { readOnlyHint: true }, execute: async (raw) => {
      const input = intentionQuery.parse(raw);
      const active = context();
      const requestedContext = input.context ?? { scenarioId: input.query?.scenarioId ?? active.scenarioId, stepId: input.query?.stepId ?? active.stepId };
      const run = capture(input.query ?? { from: { placeId: "__none__", point: { x: 0, y: 0 } }, to: { placeId: "__none__", point: { x: 0, y: 0 } } }, requestedContext);
      const result = await checkStoryIntention(run.project, { ...input, context: requestedContext }, routeService);
      if (isStale(run)) return response({ ...result, status: "stale", execution: "stale", reasonCode: "not-current", reason: "The project or scene changed during the check.", result: undefined });
      return response(result);
    } },
    { name: "inspect_saved_story_routes", description: "List saved route requests and whether source geometry/narrative revision is current. Recalculate stale routes; do not describe them as verified.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async () => {
      const project = bridge.getSession().getViewState().project; const revision = storyRouteRevision(project);
      return response({ revision, routes: project.story.routes.map((route) => ({ ...route, stale: !isStoryRouteCurrent(project, route) })) });
    } },
  ];
}
