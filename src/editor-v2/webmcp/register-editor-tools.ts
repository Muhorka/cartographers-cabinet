import type { EditorProject } from "../model/project-model";
import { isSuccessfulWebMcpResult, recordWebMcpCall, reportWebMcpDiagnostics } from "./diagnostics";
import { constructionSnapshot, currentMapSnapshot, drawingCatalogSnapshot, hierarchySnapshot, inspectProjectObject, projectConsistencyReport, projectOverview, searchProjectObjects, validContainerSnapshot, type ProjectObjectType } from "./project-read-model";
import type { EditorAgentBridge } from "./register-agent-tools";
import { createEditorCommandTools } from "./create-editor-command-tools";
import { createProjectLibraryTools, type ProjectLibraryBridge } from "./register-project-tools";
import { createAgentBatchTools } from "./agent-batch-tools";
import type { EditorContextBridge } from "./editor-context";
import { createStoryRouteCalculationService } from "../story/routes/route-service";
import { createStoryReviewTools } from "./story-review-tools";
import { createProposalChangeTools } from "./proposal-change-tools";
import { createWorkshopGuideTools } from "./workshop-guide-tools";

export type EditorToolBridge = EditorAgentBridge & ProjectLibraryBridge & EditorContextBridge & { getProject(): EditorProject };
const structuredResponse = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });
const emptyInput = { type: "object", properties: {}, additionalProperties: false };
const objectTypes = ["place", "room", "element", "surface", "wall", "opening", "transition"];

function text(input: Record<string, unknown>, key: string) {
  const value = input[key]; if (typeof value !== "string" || !value.trim()) throw new TypeError(`${key} must be a non-empty string`); return value;
}

export async function registerEditorV2Tools(bridge: EditorToolBridge) {
  if (!document.modelContext) { reportWebMcpDiagnostics({ state: "unavailable", registered: 0, total: 0, errors: [] }); return { available: false, registered: 0, dispose: () => undefined }; }
  const controller = new AbortController();
  const routeService = createStoryRouteCalculationService();
  const reviewRouteService = createStoryRouteCalculationService();
  const readTools: WebMcpTool[] = [
    { name: "inspect_cartographers_project", title: "Inspect the cartographer's project", description: "Read open-project roots, active map, and object counts. Read-only.", inputSchema: emptyInput, annotations: { readOnlyHint: true }, execute: async () => structuredResponse(projectOverview(bridge.getProject(), bridge.getActivePlaceId())) },
    { name: "list_project_hierarchy", title: "List the project hierarchy", description: "List world/location/building/level/room/custom levels with parent and full path. Read-only.", inputSchema: emptyInput, annotations: { readOnlyHint: true }, execute: async () => structuredResponse({ places: hierarchySnapshot(bridge.getProject()) }) },
    { name: "inspect_open_map", title: "Inspect the open map", description: "Read open-map context, nearby places, terrain, equipment, sketches, and construction counts. Read-only.", inputSchema: emptyInput, annotations: { readOnlyHint: true }, execute: async () => structuredResponse(currentMapSnapshot(bridge.getProject(), bridge.getActivePlaceId())) },
    { name: "search_project_objects", title: "Search project objects", description: "Search names, descriptions, tags, kinds, owners, and properties across map objects. Read-only.", inputSchema: { type: "object", properties: { query: { type: "string" }, types: { type: "array", items: { type: "string", enum: objectTypes } }, limit: { type: "number", minimum: 1, maximum: 100 } }, required: ["query"], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input) => {
      const query = text(input, "query"); const types = input.types;
      if (types !== undefined && (!Array.isArray(types) || types.some((type) => typeof type !== "string" || !objectTypes.includes(type)))) throw new TypeError("types contains an unknown object type");
      if (input.limit !== undefined && (typeof input.limit !== "number" || !Number.isFinite(input.limit))) throw new TypeError("limit must be a finite number");
      const matches = searchProjectObjects(bridge.getProject(), query, { types: types as ProjectObjectType[] | undefined, limit: input.limit as number | undefined });
      return structuredResponse({ query, count: matches.length, matches });
    } },
    { name: "inspect_project_object", title: "Inspect a project object", description: "Read stored details and geometry for an id/type/scope; ambiguous ids return all matches. Read-only.", inputSchema: { type: "object", properties: { id: { type: "string" }, type: { type: "string", enum: objectTypes }, scopeId: { type: "string" } }, required: ["id"], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input) => {
      const id = text(input, "id"); if (input.type !== undefined && (typeof input.type !== "string" || !objectTypes.includes(input.type))) throw new TypeError("type is unknown"); if (input.scopeId !== undefined && typeof input.scopeId !== "string") throw new TypeError("scopeId must be a string");
      const matches = inspectProjectObject(bridge.getProject(), { id, type: input.type as ProjectObjectType | undefined, scopeId: input.scopeId as string | undefined });
      return structuredResponse({ id, count: matches.length, ambiguous: matches.length > 1, matches });
    } },
    { name: "check_project_consistency", title: "Check project consistency", description: "Check structure/geometry; report broken refs, wall networks, room faces, and openings. Never repair. Read-only.", inputSchema: emptyInput, annotations: { readOnlyHint: true }, execute: async () => structuredResponse(projectConsistencyReport(bridge.getProject())) },
    { name: "inspect_drawing_catalog", title: "Inspect drawing layers and tools", description: "Read semantic layers, object catalogue, construction categories, subjects, eraser behavior, and compatible tools. Read-only.", inputSchema: { type: "object", properties: { placeId: { type: "string" } }, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input) => structuredResponse(drawingCatalogSnapshot(bridge.getProject(), input.placeId as string | undefined ?? bridge.getActivePlaceId())) },
    { name: "inspect_map_construction", title: "Inspect a level construction", description: "Read walls, rooms, openings, stairs, faces and diagnostics for a level/room. Points use the inspected owner's local floor coordinates in metres; never use parent-map coordinates.", inputSchema: { type: "object", properties: { placeId: { type: "string" } }, required: ["placeId"], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input) => structuredResponse({ construction: constructionSnapshot(bridge.getProject(), text(input, "placeId")) }) },
    { name: "list_valid_object_containers", title: "List valid containers for an object", description: "List legal destination places for a place/element while preserving hierarchy and containment. Read-only.", inputSchema: { type: "object", properties: { type: { type: "string", enum: ["place", "element"] }, id: { type: "string" } }, required: ["type", "id"], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input) => structuredResponse({ containers: validContainerSnapshot(bridge.getProject(), { type: text(input, "type") as "place" | "element", id: text(input, "id") }) }) },
    ...createWorkshopGuideTools(),
  ];
  const tools = [
    ...readTools,
    ...createProposalChangeTools(bridge),
    ...createStoryReviewTools(bridge, reviewRouteService),
    ...createEditorCommandTools(bridge, undefined, routeService),
    ...createProjectLibraryTools(bridge),
    ...createAgentBatchTools(bridge, (session) => {
      // A batch owns its route worker. Concurrent agent tasks must not cancel
      // the interactive route request or another isolated batch.
      const batchRouteService = createStoryRouteCalculationService();
      return {
        tools: createEditorCommandTools({
          getSession: () => session,
          getActivePlaceId: () => session.getViewState().activePlaceId ?? bridge.getActivePlaceId(),
          getEditorContext: () => bridge.getEditorContext?.() ?? { selections: [], mode: "drawing", view: {} },
          getLocale: () => bridge.getLocale?.() ?? "en",
          refresh: () => undefined,
        }, undefined, batchRouteService),
        dispose: () => batchRouteService.dispose(),
      };
    }),
  ];
  const registrations = await Promise.allSettled(tools.map((tool) => document.modelContext!.registerTool({ ...tool, execute: async (input) => { const result = await tool.execute(input); if (isSuccessfulWebMcpResult(result)) recordWebMcpCall(tool.name); return result; } }, { signal: controller.signal })));
  const registered = registrations.filter(({ status }) => status === "fulfilled").length;
  const errors = registrations.flatMap((result, index) => result.status === "rejected" ? [`${tools[index].name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`] : []);
  reportWebMcpDiagnostics({ state: errors.length ? "error" : "ready", registered: errors.length ? 0 : registered, total: tools.length, errors });
  return { available: registered === tools.length, registered, dispose: () => { routeService.dispose(); reviewRouteService.dispose(); controller.abort(); } };
}
