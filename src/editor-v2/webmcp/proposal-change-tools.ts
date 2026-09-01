import { z } from "zod";
import { createProposalChangeReader } from "./proposal-change-reader";
import type { EditorAgentBridge } from "./register-agent-tools";

const schema = z.object({
  checkpointId: z.string().min(1).max(512),
  refs: z.array(z.object({ kind: z.enum(["place", "room", "element", "surface", "wall", "opening", "transition"]), id: z.string().min(1).max(512), scopeId: z.string().max(512).optional() }).strict()).max(100).optional(),
  context: z.object({ scenarioId: z.string().max(512).optional(), stepId: z.string().max(512).optional() }).strict().optional(),
  cursor: z.string().max(4096).optional(), limit: z.number().int().min(1).max(50).default(25),
}).strict();

export function createProposalChangeTools(bridge: Pick<EditorAgentBridge, "getSession" | "getCheckpoint">): WebMcpTool[] {
  const read = createProposalChangeReader(bridge);
  return [{ name: "inspect_story_change", title: "Inspect proposed story field changes",
    description: "Read paged direct story.objects and scenario/step field changes from a saved proposal. Compare original before/proposed after in the SAME authored context; return scoped refs, names, authored/effective values, missing data, and coverage limits. Groups, indirect propagation, and other collections are excluded. Default 25/max 50; refs=[] is empty, omitted refs means all; context filters base/scenario/step. Stale data stays historical, never rebased/applied. Read-only; no project/history changes.",
    inputSchema: z.toJSONSchema(schema, { io: "input" }), annotations: { readOnlyHint: true },
    execute: async (raw) => { const result = await read(schema.parse(raw)); return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result }; },
  }];
}
