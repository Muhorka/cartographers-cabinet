import { z } from "zod";
import { storyCollectionSchemas, storyDataSchema, storyMetadataSchema, storyViewContextSchema } from "../story/schema";
import { allStoryObjectRefs } from "../story/project-adapter";
import { effectiveProjectStoryObject } from "../story/project-effective";
import { evaluateProjectLens } from "../story/evaluation";
import { applyProjectStoryMetadata } from "../story/project-commands";
import { replaceProjectScenarios } from "../story/scenario-commands";
import type { StoryObjectRef, StoryObjectMetadata } from "../story/types";
import { EditorCommandCoordinator } from "./editor-command-coordinator";
import type { EditorAgentBridge } from "./register-agent-tools";
import type { EditorContextBridge } from "./editor-context";
import { projectRevision } from "../state/project-revision";
import { storyCollectionEntryId } from "../story/collection-identity";
import { legacyStoryGroups, migrateStoryData, replaceLegacyStoryGroups } from "../story/migration";

type Bridge = EditorAgentBridge & EditorContextBridge;
const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });
const refSchema = z.object({ kind: z.enum(["place", "room", "element", "surface", "wall", "opening", "transition"]).optional(), type: z.enum(["place", "room", "element", "surface", "wall", "opening", "transition"]).optional(), id: z.string().min(1), scopeId: z.string().optional() }).strict();
function storyRef(ref: z.infer<typeof refSchema>): StoryObjectRef {
  const kind = ref.kind ?? ref.type; if (!kind || ref.kind && ref.type && ref.kind !== ref.type) throw new Error("A reference needs one consistent kind/type.");
  return { kind, id: ref.id, ...(ref.scopeId ? { scopeId: ref.scopeId } : {}) };
}
const collections = Object.keys(storyCollectionSchemas) as [keyof typeof storyCollectionSchemas, ...Array<keyof typeof storyCollectionSchemas>];
const collectionSchema = z.enum(collections);
const readSchema = z.object({ collection: collectionSchema.optional(), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(50) }).strict();
const editSchema = z.object({ collection: collectionSchema, action: z.enum(["upsert", "remove"]), entries: z.array(z.record(z.string(), z.unknown())).max(1000).optional(), ids: z.array(z.string()).max(1000).optional() }).strict();
const metadataSchema = z.object({ refs: z.array(refSchema).min(1).max(1000), metadata: storyMetadataSchema, action: z.enum(["add", "remove", "replace"]).default("replace"), accessFields: z.array(z.enum(["allow", "deny", "permission", "physicalState", "lock", "keyIds", "guardIds", "secretKnowledge"])).optional(), target: z.enum(["base", "scenario"]).optional(), context: storyViewContextSchema.optional(), resetOwnership: z.boolean().optional() }).strict();
const inspectSchema = z.object({ refs: z.array(refSchema).max(1000).optional(), query: z.string().max(2000).optional(), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(50), context: storyViewContextSchema.optional() }).strict();
const viewSchema = z.object({ scenarioId: z.string().optional(), stepId: z.string().optional(), lensId: z.string().optional(), routeId: z.string().optional(), editTarget: z.enum(["base", "scenario"]).optional(), neutral: z.boolean().optional() }).strict();

/** Story commands use the same preparation, transaction, revision and undo boundary as geometry. */
export function createStoryAgentTools(bridge: Bridge, coordinator: EditorCommandCoordinator): WebMcpTool[] {
  const currentContext = () => { const view = bridge.getEditorContext?.().view; return { scenarioId: view?.scenarioId, stepId: view?.stepId, lensId: view?.lensId }; };
  return [
    { name: "inspect_story_catalog", description: "Read Story counts and exact schemas. Zones are the single object-group model, sharing traits with members while preserving local properties. groups is a legacy adapter, not another collection to populate. Actor access-groups remain separate. Read before editing; no paid embedded model.", inputSchema: z.toJSONSchema(readSchema, { io: "input" }), annotations: { readOnlyHint: true }, execute: async (raw) => {
      const input = readSchema.parse(raw); const project = bridge.getSession().getState().project;
      const story = migrateStoryData(project.story);
      if (!input.collection) return response({ revision: projectRevision(project), collections: collections.filter((name) => name !== "groups").map((name) => ({ name, count: story[name].length })), legacyAliases: { groups: "zones" }, context: currentContext() });
      const items = input.collection === "groups" ? legacyStoryGroups(story) : story[input.collection]; const entries = items.slice(input.offset, input.offset + input.limit);
      return response({ collection: input.collection, schema: z.toJSONSchema(storyCollectionSchemas[input.collection], { io: "input" }), total: items.length, offset: input.offset, entries, entryIds: entries.map((entry) => storyCollectionEntryId(entry as unknown as Record<string, unknown>)) });
    } },
    { name: "inspect_story_objects", description: "Read canonical names, descriptions, effective properties, provenance, conflicts, and optional lens explanations. Paginated exact refs; query is lexical, not embedding search. Omit refs for all; context defaults to active scenario/step. Separate author facts from suggestions.", inputSchema: z.toJSONSchema(inspectSchema, { io: "input" }), annotations: { readOnlyHint: true }, execute: async (raw) => {
      const input = inspectSchema.parse(raw); const project = bridge.getSession().getState().project; const context = input.context ?? currentContext();
      const refs = input.refs?.map(storyRef) ?? allStoryObjectRefs(project);
      const objects = refs.map((ref) => { const object = effectiveProjectStoryObject(project, ref, context); if (!object) return { ref, missing: true }; return { ...object, ...(context.lensId ? { lens: evaluateProjectLens(project, project.story, context.lensId, object.ref, context) } : {}) }; });
      const terms = input.query?.toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? [];
      const matches = objects.filter((object) => terms.every((term) => JSON.stringify(object).toLocaleLowerCase().includes(term)));
      return response({ revision: projectRevision(project), context, total: matches.length, objects: matches.slice(input.offset, input.offset + input.limit) });
    } },
    { name: "prepare_edit_story", description: "Prepare a Story collection upsert/removal using inspect_story_catalog schemas. Omitted fields stay unchanged; new entries must be complete. Memberships use subjectId/groupId/kind; objects use scoped refs. No geometry edits; removals never delete geometry. Apply/propose via execute_editor_batch or a prepared token.", inputSchema: z.toJSONSchema(editSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (raw) => {
      const input = editSchema.parse(raw);
      if (input.action === "upsert" && input.collection === "objects") throw new Error("Use prepare_set_story_metadata for map annotations: it preserves native text, scope, locks and scenario targeting.");
      if (input.action === "upsert" && input.collection === "routes") throw new Error("Use prepare_save_story_route to calculate a verified route from an explicit query.");
      return response(coordinator.prepare(`story:${crypto.randomUUID()}`, (project) => {
        const canonical = migrateStoryData(project.story);
        const before = (input.collection === "groups" ? legacyStoryGroups(canonical) : canonical[input.collection]) as unknown as Record<string, unknown>[];
        const identity = storyCollectionEntryId;
        let next = [...before];
        if (input.action === "remove") { if (!input.ids?.length) throw new Error("Removal requires explicit ids from the inspected collection."); next = next.filter((entry) => !input.ids!.includes(identity(entry))); }
        else { if (!input.entries?.length) throw new Error("Upsert requires entries."); for (const entry of input.entries) { const index = next.findIndex((candidate) => identity(candidate) === identity(entry)); if (index >= 0) next[index] = { ...next[index], ...entry }; else next.push(entry); } }
        const story = input.collection === "groups"
          ? replaceLegacyStoryGroups(canonical, storyCollectionSchemas.groups.parse(next))
          : migrateStoryData(storyDataSchema.parse({ ...canonical, [input.collection]: storyCollectionSchemas[input.collection].parse(next) }));
        const changed = input.collection === "scenarios" ? replaceProjectScenarios(project, story.scenarios) : { ...project, story };
        return { project: changed, summary: `Opowieść: ${input.collection} (${input.action}).` };
      }));
    } },
    { name: "prepare_set_story_metadata", description: "Prepare scoped ownership, grouped typed properties, access exceptions, keys/guards/secrets, tags or narrative text. Default target: active scenario; target=base edits base. replace affects supplied fields/property keys (owners is the exact list; [] means none); remove affects supplied values/keys. resetOwnership=true with metadata={} restores inherited owners. Keys do not grant permission; editor locks apply. narrativeLabel/narrativeDescription also update supported native text.", inputSchema: z.toJSONSchema(metadataSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (raw) => {
      const input = metadataSchema.parse(raw); const refs = input.refs.map(storyRef); const context = input.context ?? currentContext(); const target = input.target ?? bridge.getEditorContext?.().view.editTarget;
      return response(coordinator.prepare(`story-metadata:${crypto.randomUUID()}`, (project) => ({ project: applyProjectStoryMetadata(project, { ...input, metadata: input.metadata as StoryObjectMetadata, refs, context, target }), summary: `Zmieniono właściwości opowieści: ${refs.length}.` })));
    } },
    { name: "set_story_view", description: "Show a saved lens/scenario/step/route. neutral=true clears view filters. Only supplied fields change; geometry, colors, and base properties do not. Deferred while a drawing draft or overlap review is resolved.", inputSchema: z.toJSONSchema(viewSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (raw) => {
      const input = viewSchema.parse(raw); const project = bridge.getSession().getState().project;
      if (!bridge.setStoryView) throw new Error("This host did not expose Story view controls.");
      const { neutral, ...patch } = input;
      if (patch.lensId && !project.story.lenses.some(({ id }) => id === patch.lensId)) throw new Error("Lens not found.");
      if (patch.routeId && !project.story.routes.some(({ id }) => id === patch.routeId)) throw new Error("Route not found.");
      const scenarioId = patch.scenarioId ?? currentContext().scenarioId;
      const scenario = scenarioId ? project.story.scenarios.find(({ id }) => id === scenarioId) : undefined;
      if (scenarioId && !scenario) throw new Error("Scenario not found.");
      if (patch.stepId && !scenario?.steps.some(({ id }) => id === patch.stepId)) throw new Error("Scenario step not found.");
      const result = bridge.setStoryView(neutral ? { scenarioId: undefined, stepId: undefined, lensId: undefined, routeId: undefined, editTarget: "base" } : patch);
      return response(result?.status === "deferred" ? result : { status: "view-updated" });
    } },
  ];
}
