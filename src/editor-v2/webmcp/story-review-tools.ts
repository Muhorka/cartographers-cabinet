import { z } from "zod";
import { projectRevision } from "../state/project-revision";
import { createStoryRouteCalculationService, type StoryRouteCalculationService } from "../story/routes/route-service";
import { routeRequestSchema } from "../story/routes/schema";
import { createSceneCheckService } from "../story/review/scene-check-service";
import { inspectEditorContext, type EditorContextBridge } from "./editor-context";
import type { EditorAgentBridge } from "./register-agent-tools";

const schema = z.object({
  scope: z.enum(["selection", "all"]).default("selection"),
  expectedContextVersion: z.string().min(1).optional(),
  refs: z.array(z.object({ kind: z.enum(["place", "room", "element", "surface", "wall", "opening", "transition"]), id: z.string().min(1), scopeId: z.string().optional() }).strict()).max(100).optional(),
  intentionIds: z.array(z.string().min(1)).max(50).optional(),
  actorId: z.string().min(1).optional(),
  context: z.object({ scenarioId: z.string().optional(), stepId: z.string().optional() }).strict().optional(),
  query: routeRequestSchema.optional(), routeId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(25),
}).strict();
const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });

export function createStoryReviewTools(bridge: EditorAgentBridge & EditorContextBridge, suppliedRoutes?: StoryRouteCalculationService): WebMcpTool[] {
  const service = createSceneCheckService(suppliedRoutes ?? createStoryRouteCalculationService());
  return [{
    name: "check_story_scene", title: "Check the scene's author intentions",
    description: "Read bounded author-intention checks. Default inspected selection; expectedContextVersion binds implicit selection, or provide canonical refs; scope=all checks up to limit. Use an actor and explicit query/saved route; saved queries recalculate in the current scene. Return facts, conditions, sources, truncation, failures. must-pass/avoid-zone cover only the calculated route. No status, geometry, or story mutation.",
    inputSchema: z.toJSONSchema(schema, { io: "input" }), annotations: { readOnlyHint: true },
    execute: async (raw) => {
      const input = schema.parse(raw);
      const session = bridge.getSession(); const project = session.getState().project;
      const inspected = inspectEditorContext(bridge);
      const implicitSelection = input.scope === "selection" && input.refs === undefined;
      if (implicitSelection && (!inspected.selectionAvailable || input.expectedContextVersion !== inspected.contextVersion)) {
        return response({ status: "stale-context", contextVersion: inspected.contextVersion });
      }
      if (input.expectedContextVersion && input.expectedContextVersion !== inspected.contextVersion) return response({ status: "stale-context", contextVersion: inspected.contextVersion });
      const revision = projectRevision(project);
      const refs = input.refs ?? (input.scope === "selection" ? inspected.selections.map(({ type, id, scopeId }) => ({ kind: type, id, scopeId })) : undefined);
      const context = input.context ?? { scenarioId: inspected.view.scenarioId, stepId: inspected.view.stepId };
      const isCurrent = () => bridge.getSession() === session && projectRevision(session.getState().project) === revision && inspectEditorContext(bridge).contextVersion === inspected.contextVersion;
      return response(await service.check(project, { ...input, refs, context }, isCurrent));
    },
  }];
}
