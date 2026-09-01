import { EditorCommandCoordinator } from "./editor-command-coordinator";
import { createEditorAgentTools, type EditorAgentBridge } from "./register-agent-tools";
import { createStoryAgentTools } from "./story-tools";
import { createStoryAssignmentTools } from "./story-assignment-tools";
import { createStoryRouteTools } from "./story-route-tools";
import type { EditorContextBridge } from "./editor-context";
import type { StoryRouteCalculationService } from "../story/routes/route-service";

export function createEditorCommandTools(bridge: EditorAgentBridge & EditorContextBridge, _coordinator?: EditorCommandCoordinator, routeService?: StoryRouteCalculationService): WebMcpTool[] {
  const coordinator = _coordinator ?? new EditorCommandCoordinator(bridge);
  return [...createEditorAgentTools(bridge, coordinator), ...createStoryAgentTools(bridge, coordinator), ...createStoryAssignmentTools(bridge, coordinator), ...createStoryRouteTools(bridge, coordinator, routeService)];
}
