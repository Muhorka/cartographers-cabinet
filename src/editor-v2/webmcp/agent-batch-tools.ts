import { z } from "zod";
import { EditorSession } from "../state/editor-session";
import { EditorCommandCoordinator, type CommandBridge } from "./editor-command-coordinator";
import { inspectEditorContext, type EditorContextBridge } from "./editor-context";
import { assertAgentLocks } from "./agent-change-policy";
import { projectRevision } from "../state/project-revision";
import type { EditorProject } from "../model/project-model";
import type { AgentObjectRef } from "./agent-command-types";
import { inspectProjectObject } from "./project-read-model";

type BatchBridge = CommandBridge & EditorContextBridge & { getActivePlaceId(): string };
type ToolFactory = (session: EditorSession) => WebMcpTool[];
const batchSchema = z.object({
  requestId: z.string().min(1).max(512), expectedRevision: z.string().min(1), expectedContextVersion: z.string().optional(),
  summary: z.string().min(1).max(2000), mode: z.enum(["apply", "propose"]).default("apply"),
  operations: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()), useSelection: z.boolean().optional() }).strict()).min(1).max(100),
}).strict();
const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });

type BatchOperationFailurePayload = {
  status: "blocked";
  operationIndex: number;
  tool: string;
  ref?: unknown;
  refs?: unknown;
  reason: string;
  diagnostics?: unknown;
};

class BatchOperationFailure extends Error {
  constructor(readonly payload: BatchOperationFailurePayload) { super(payload.reason); }
}

function failOperation(index: number, step: { tool: string; input: Record<string, unknown> }, reason: string, diagnostics?: unknown): never {
  throw new BatchOperationFailure({
    status: "blocked", operationIndex: index, tool: step.tool,
    ...(step.input.ref !== undefined ? { ref: step.input.ref } : {}),
    ...(Array.isArray(step.input.refs) ? { refs: step.input.refs } : {}),
    reason,
    ...(diagnostics !== undefined ? { diagnostics } : {}),
  });
}

function selectionRefKey(project: EditorProject, value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const ref = value as Partial<AgentObjectRef> & { kind?: AgentObjectRef["type"] };
  const type = ref.type ?? ref.kind;
  if (!type || typeof ref.id !== "string" || (ref.type && ref.kind && ref.type !== ref.kind)) return undefined;
  if (ref.scopeId !== undefined && typeof ref.scopeId !== "string") return undefined;
  const ownerId = ref.scopeId && project.places.find(({ constructionId }) => constructionId === ref.scopeId)?.id;
  const matches = inspectProjectObject(project, { type, id: ref.id, scopeId: ownerId ?? ref.scopeId });
  if (matches.length !== 1) return undefined;
  const resolved = matches[0].ref;
  return JSON.stringify([resolved.type, resolved.id, resolved.scopeId ?? null]);
}

function assertSelectionInputs(project: EditorProject, input: Record<string, unknown>, selections: AgentObjectRef[]) {
  if (!selections.length) throw new Error("The inspected selection is empty.");
  const selected = new Set(selections.map((ref) => selectionRefKey(project, ref)).filter((key) => key !== undefined));
  const included = (ref: unknown) => { const key = selectionRefKey(project, ref); return key !== undefined && selected.has(key); };
  if (input.ref !== undefined && !included(input.ref)) throw new Error("The explicit ref is outside the inspected selection.");
  if (input.refs !== undefined && (!Array.isArray(input.refs) || !input.refs.every(included))) throw new Error("Explicit refs conflict with the inspected selection.");
}

/** Reuses the existing commands in an isolated session, then commits once to the live history. */
export function createAgentBatchTools(bridge: BatchBridge, factory: ToolFactory): WebMcpTool[] {
  const coordinator = new EditorCommandCoordinator(bridge);
  const completed = new Map<string, { input: string; result: unknown }>();
  const inflight = new Map<string, Promise<unknown>>();
  const run = async (raw: Record<string, unknown>) => {
    const input = batchSchema.parse(raw); const signature = JSON.stringify(input);
    const cached = completed.get(input.requestId);
    if (cached) return cached.input === signature ? { ...cached.result as object, alreadyApplied: true } : { status: "blocked", reason: "request-id-reused-with-different-input" };
    if (inflight.has(input.requestId)) return { status: "busy", reason: "request-in-progress" };
    const operation = (async () => {
      const session = bridge.getSession(); const state = session.getState();
      const context = inspectEditorContext(bridge); const before = state.project;
      if (input.expectedRevision !== projectRevision(before)) return { status: "stale", revision: projectRevision(before) };
      if ((input.expectedContextVersion && input.expectedContextVersion !== context.contextVersion)
        || (input.operations.some(({ useSelection }) => useSelection) && !input.expectedContextVersion)) return { status: "stale-context", contextVersion: context.contextVersion };
      const shadow = new EditorSession(before, { initialPlaceId: state.activePlaceId, initialToolbox: state.toolbox });
      shadow.setBoundaryEditing(state.boundaryEditing);
      const tools = factory(shadow); const targets = new Set<string>();
      for (const [operationIndex, step] of input.operations.entries()) {
        try {
          if (!step.tool.startsWith("prepare_") || /checkpoint|project_(deletion|restore)/.test(step.tool)) throw new Error("Only undoable editor/story preparation commands may be batched.");
          const tool = tools.find(({ name }) => name === step.tool); if (!tool) throw new Error(`Unknown batch command: ${step.tool}`);
          if (step.useSelection) {
            const properties = tool.inputSchema?.properties;
            if (!properties || typeof properties !== "object" || (!Object.hasOwn(properties, "ref") && !Object.hasOwn(properties, "refs"))) throw new Error("This command does not support useSelection.");
            assertSelectionInputs(before, step.input, context.selections);
          }
          const args: Record<string, unknown> = { ...step.input, ...(step.useSelection ? { refs: context.selections } : {}) };
          for (const ref of [...(Array.isArray(args.refs) ? args.refs : []), ...(args.ref ? [args.ref] : [])]) targets.add(JSON.stringify(ref));
          const prepared = await tool.execute(args) as { structuredContent?: unknown };
          const result = prepared.structuredContent as { status?: string; token?: string; reason?: string; diagnostics?: unknown };
          if (result?.status === "no-change") continue;
          if (result?.status !== "prepared" || !result.token) failOperation(operationIndex, step, result?.reason ?? "Batch command could not be prepared.", result?.diagnostics);
          const apply = tools.find(({ name }) => name === "apply_prepared_editor_change");
          if (!apply) throw new Error("The batch command has no transaction adapter.");
          const applied = ((await apply.execute({ token: result.token })) as { structuredContent: { status?: string; reason?: string; diagnostics?: unknown } }).structuredContent;
          if (applied.status !== "applied") failOperation(operationIndex, step, applied.reason ?? "Batch command failed.", applied.diagnostics);
        } catch (error) {
          if (error instanceof BatchOperationFailure) throw error;
          failOperation(operationIndex, step, error instanceof Error ? error.message : String(error));
        }
      }
      const after = shadow.getState().project; assertAgentLocks(before, after);
      const currentSession = bridge.getSession();
      if (currentSession !== session || projectRevision(currentSession.getState().project) !== input.expectedRevision) return { status: "stale", revision: coordinator.revision() };
      if (input.expectedContextVersion && inspectEditorContext(bridge).contextVersion !== input.expectedContextVersion) return { status: "stale-context" };
      const prepared = coordinator.prepare(`agent-batch:${input.requestId}`, () => ({ project: after, summary: input.summary }));
      if (prepared.status !== "prepared") return prepared;
      return input.mode === "propose" ? coordinator.propose(prepared.token) : coordinator.applyWithSafety(prepared.token, targets.size);
    })();
    inflight.set(input.requestId, operation);
    try { const result = await operation; completed.set(input.requestId, { input: signature, result }); return result; }
    catch (error) { return error instanceof BatchOperationFailure ? error.payload : { status: "blocked", reason: error instanceof Error ? error.message : String(error) }; }
    finally { inflight.delete(input.requestId); }
  };
  return [
    { name: "inspect_editor_context", title: "Inspect live editor context", description: "Read the live selection, map, tool, Story lens/scenario/route, and revision. Use for 'these rooms'; registration does not prove another agent sees these tools.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async () => response(inspectEditorContext(bridge)) },
    { name: "execute_editor_batch", title: "Execute or propose one editor task", description: "Execute or propose one atomic task of prepare_* commands. Read inspect_editor_context; expectedContextVersion binds 'these' selection and useSelection injects refs. mode=propose preserves an unapplied alternative; mode=apply executes after authorization without another human approval and safety-traces LARGE edits. Reuse requestId only for identical retry. One undo step; rollback on failure. Blocked results report zero-based operation index, tool, refs, reason, and diagnostics. Permanent project/checkpoint deletion is excluded.", inputSchema: z.toJSONSchema(batchSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (input) => response(await run(input)) },
  ];
}
