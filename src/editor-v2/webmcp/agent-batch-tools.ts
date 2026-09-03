import { z } from "zod";
import { EditorSession } from "../state/editor-session";
import { EditorCommandCoordinator, type CommandBridge } from "./editor-command-coordinator";
import { inspectEditorContext, type EditorContextBridge } from "./editor-context";
import { assertAgentLocks } from "./agent-change-policy";
import { projectRevision } from "../state/project-revision";
import type { EditorProject } from "../model/project-model";
import type { AgentObjectRef } from "./agent-command-types";
import { inspectProjectObject } from "./project-read-model";
import { boundedBytes, boundedCount, serializedJsonBytes } from "./retention-budget";

type BatchBridge = CommandBridge & EditorContextBridge & { getActivePlaceId(): string };
type ToolFactoryResult = WebMcpTool[] | { tools: WebMcpTool[]; dispose?(): void };
type ToolFactory = (session: EditorSession) => ToolFactoryResult;
type RetainedBatchResult = { input: string; result: unknown; session: EditorSession; createdAt: number; retainedBytes: number };
const COMPLETED_BATCH_TTL_MS = 30 * 60 * 1000;
const MAX_COMPLETED_BATCHES = 1_000;
const MAX_COMPLETED_BYTES = 32 * 1024 * 1024;
const MAX_BATCH_INPUT_BYTES = 1024 * 1024;
const MAX_INFLIGHT_BATCHES = 8;
const batchSchema = z.object({
  requestId: z.string().min(1).max(512), expectedRevision: z.string().min(1), expectedContextVersion: z.string().optional(),
  summary: z.string().min(1).max(2000), mode: z.enum(["apply", "propose"]).default("apply"),
  operations: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()), useSelection: z.boolean().optional() }).strict()).min(1).max(100),
}).strict();
const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });

export type AgentBatchToolOptions = {
  maxCompleted?: number;
  maxCompletedBytes?: number;
  maxInputBytes?: number;
  maxInflight?: number;
};

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
export function createAgentBatchTools(bridge: BatchBridge, factory: ToolFactory, options: AgentBatchToolOptions = {}): WebMcpTool[] {
  const coordinator = new EditorCommandCoordinator(bridge);
  const completed = new Map<string, RetainedBatchResult>();
  const inflight = new Map<string, Promise<unknown>>();
  const maxCompleted = boundedCount(options.maxCompleted, MAX_COMPLETED_BATCHES);
  const maxCompletedBytes = boundedBytes(options.maxCompletedBytes, MAX_COMPLETED_BYTES);
  const maxInputBytes = boundedBytes(options.maxInputBytes, MAX_BATCH_INPUT_BYTES);
  const maxInflight = boundedCount(options.maxInflight, MAX_INFLIGHT_BATCHES);
  const maintainCompleted = () => {
    const cutoff = Date.now() - COMPLETED_BATCH_TTL_MS;
    for (const [requestId, entry] of completed) if (entry.createdAt <= cutoff) completed.delete(requestId);
    const bytes = () => { let total = 0; for (const entry of completed.values()) total += entry.retainedBytes; return total; };
    while (completed.size > maxCompleted || bytes() > maxCompletedBytes) completed.delete(completed.keys().next().value!);
  };
  const repeatResult = (entry: RetainedBatchResult) => {
    const { result } = entry;
    if (!result || typeof result !== "object") return result;
    const value = result as { status?: string; revision?: string; baseRevision?: string };
    const sameSession = entry.session === bridge.getSession();
    if (value.status === "applied") return { ...value, alreadyApplied: true, stillCurrent: sameSession && value.revision === coordinator.revision() };
    if (value.status === "proposed") return { ...value, alreadyProposed: true, stillCurrent: sameSession && value.baseRevision === coordinator.revision() };
    return undefined;
  };
  const run = async (raw: Record<string, unknown>) => {
    let rawSerialized: string;
    try { rawSerialized = JSON.stringify(raw); } catch { return { status: "blocked", reason: "invalid-batch-input" }; }
    if (rawSerialized === undefined || serializedJsonBytes(rawSerialized) > maxInputBytes) return { status: "blocked", reason: "batch-input-too-large" };
    const input = batchSchema.parse(raw); const signature = JSON.stringify(input);
    maintainCompleted();
    const cached = completed.get(input.requestId);
    if (cached && cached.input !== signature) return { status: "blocked", reason: "request-id-reused-with-different-input" };
    const repeated = cached && repeatResult(cached);
    if (repeated) return repeated;
    if (inflight.has(input.requestId)) return { status: "busy", reason: "request-in-progress" };
    if (inflight.size >= maxInflight) return { status: "busy", reason: "too-many-requests-in-progress" };
    let sourceSession: EditorSession | undefined;
    const operation = (async () => {
      const session = bridge.getSession(); sourceSession = session; const state = session.getViewState();
      const context = inspectEditorContext(bridge); const before = state.project;
      if (input.expectedRevision !== projectRevision(before)) return { status: "stale", revision: projectRevision(before) };
      if ((input.expectedContextVersion && input.expectedContextVersion !== context.contextVersion)
        || (input.operations.some(({ useSelection }) => useSelection) && !input.expectedContextVersion)) return { status: "stale-context", contextVersion: context.contextVersion };
      const shadow = new EditorSession(before, { initialPlaceId: state.activePlaceId, initialToolbox: state.toolbox });
      shadow.setBoundaryEditing(state.boundaryEditing);
      const created = factory(shadow);
      const bundle = Array.isArray(created) ? { tools: created } : created;
      const tools = bundle.tools; const targets = new Set<string>();
      try {
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
        const after = shadow.getViewState().project; assertAgentLocks(before, after);
        const currentSession = bridge.getSession();
        if (currentSession !== session || projectRevision(currentSession.getViewState().project) !== input.expectedRevision) return { status: "stale", revision: coordinator.revision() };
        if (input.expectedContextVersion && inspectEditorContext(bridge).contextVersion !== input.expectedContextVersion) return { status: "stale-context" };
        const prepared = coordinator.prepare(`agent-batch:${input.requestId}`, () => ({ project: after, summary: input.summary }));
        if (prepared.status !== "prepared") return prepared;
        return input.mode === "propose" ? coordinator.propose(prepared.token) : coordinator.applyWithSafety(prepared.token, targets.size);
      } finally {
        bundle.dispose?.();
      }
    })();
    inflight.set(input.requestId, operation);
    try {
      const result = await operation;
      const retainedBytes = serializedJsonBytes(signature) + (() => { try { return serializedJsonBytes(JSON.stringify(result)); } catch { return Number.POSITIVE_INFINITY; } })();
      if (retainedBytes <= maxCompletedBytes && maxCompleted) completed.set(input.requestId, { input: signature, result, session: sourceSession ?? bridge.getSession(), createdAt: Date.now(), retainedBytes });
      maintainCompleted();
      return result;
    }
    catch (error) { return error instanceof BatchOperationFailure ? error.payload : { status: "blocked", reason: error instanceof Error ? error.message : String(error) }; }
    finally { inflight.delete(input.requestId); }
  };
  return [
    { name: "inspect_editor_context", title: "Inspect live editor context", description: "Read selections, the separate Inspector target (inspectedPlaceId), displayed map (activePlaceId), tools, Story view, and revision. Use for 'these rooms'; registration does not prove tool access.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async () => response(inspectEditorContext(bridge)) },
    { name: "execute_editor_batch", title: "Execute or propose one editor task", description: "Execute or propose one atomic task of prepare_* commands. Read inspect_editor_context; expectedContextVersion binds 'these' selection and useSelection injects refs. mode=propose preserves an unapplied alternative; mode=apply executes after authorization without another human approval and safety-traces LARGE edits. Reuse requestId only for identical retry. One undo step; rollback on failure. Blocked results report zero-based operation index, tool, refs, reason, and diagnostics. Permanent project/checkpoint deletion is excluded.", inputSchema: z.toJSONSchema(batchSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (input) => response(await run(input)) },
  ];
}
