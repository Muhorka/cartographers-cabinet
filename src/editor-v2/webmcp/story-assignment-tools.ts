import { z } from "zod";
import { createAndAssignStoryEntry } from "../story/project-quick-assignment";
import { assignProjectKeyHolders } from "../story/project-key-holders";
import { storyObjectRefSchema, storyViewContextSchema } from "../story/schema";
import type { StoryViewContext } from "../story/types";
import { EditorCommandCoordinator } from "./editor-command-coordinator";
import type { EditorAgentBridge } from "./register-agent-tools";
import type { EditorContextBridge } from "./editor-context";

type Bridge = EditorAgentBridge & EditorContextBridge;

const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });
const assignmentKind = z.enum(["character", "faction", "boolean-property"]);
const assignmentSchema = z.object({
  refs: z.array(storyObjectRefSchema).min(1).max(1000),
  kind: assignmentKind,
  name: z.string().trim().min(1).max(2_000),
  target: z.enum(["base", "scenario"]).optional(),
  context: storyViewContextSchema.optional(),
}).strict();
const openingRefSchema = storyObjectRefSchema.extend({ kind: z.literal("opening"), scopeId: z.string().trim().min(1) });
const keyHoldersSchema = z.object({
  ref: openingRefSchema,
  keyId: z.string().trim().min(1).optional(),
  holderIds: z.array(z.string().trim().min(1)).max(10_000),
  keyName: z.string().trim().min(1).max(2_000).optional(),
  target: z.enum(["base", "scenario"]).optional(),
  context: storyViewContextSchema.optional(),
}).strict();

function viewContext(bridge: Bridge): StoryViewContext {
  const view = bridge.getEditorContext?.().view;
  return { scenarioId: view?.scenarioId, stepId: view?.stepId, lensId: view?.lensId };
}

function commandTarget(bridge: Bridge, context: StoryViewContext, target: "base" | "scenario" | undefined) {
  return target ?? bridge.getEditorContext?.().view.editTarget ?? (context.scenarioId ? "scenario" : "base");
}

/** Story assignment commands share the coordinator's prepare/apply and batch boundary. */
export function createStoryAssignmentTools(bridge: Bridge, coordinator: EditorCommandCoordinator): WebMcpTool[] {
  return [
    {
      name: "prepare_assign_story_entry",
      title: "Prepare assigning a Story entry",
      description: "Prepare creating/reusing a character, faction, or boolean property and assigning it to exact scoped refs. Name is the only required field; apply via token or batch.",
      inputSchema: z.toJSONSchema(assignmentSchema, { io: "input" }),
      annotations: { readOnlyHint: false },
      execute: async (raw) => {
        const input = assignmentSchema.parse(raw);
        const context = input.context ?? viewContext(bridge);
        const target = commandTarget(bridge, context, input.target);
        return response(coordinator.prepare(`story-entry-assignment:${crypto.randomUUID()}`, (project) => ({
          project: createAndAssignStoryEntry(project, { refs: input.refs, kind: input.kind, name: input.name, target, context }),
          summary: `Assigned Story ${input.kind} to ${input.refs.length} object(s).`,
        })));
      },
    },
    {
      name: "prepare_assign_door_key",
      title: "Prepare assigning a door key",
      description: "Assign a key and character/faction/access-group holders to one scoped opening. keyName allows creation without holders; an entirely empty assignment is a no-op. Multiple attached keys require keyId. Preserve access/unrelated memberships.",
      inputSchema: z.toJSONSchema(keyHoldersSchema, { io: "input" }),
      annotations: { readOnlyHint: false },
      execute: async (raw) => {
        const input = keyHoldersSchema.parse(raw);
        const context = input.context ?? viewContext(bridge);
        const target = commandTarget(bridge, context, input.target);
        return response(coordinator.prepare(`story-door-key:${crypto.randomUUID()}`, (project) => ({
          project: assignProjectKeyHolders(project, { ref: input.ref, keyId: input.keyId, holderIds: input.holderIds, keyName: input.keyName, target, context }),
          summary: `Assigned door key holders for ${input.ref.id}.`,
        })));
      },
    },
  ];
}
