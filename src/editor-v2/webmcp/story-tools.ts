import { z } from "zod";
import { storyCollectionSchemas, storyDataSchema, storyMetadataSchema, storyViewContextSchema } from "../story/schema";
import { allStoryObjectRefs } from "../story/project-adapter";
import { effectiveProjectStoryObject } from "../story/project-effective";
import { createProjectLensEvaluator, evaluateProjectLens } from "../story/evaluation";
import { visibleStoryLenses } from "../story/lens-view";
import { applyProjectStoryMetadata } from "../story/project-commands";
import { replaceProjectScenarios } from "../story/scenario-commands";
import type { StoryObjectRef, StoryObjectMetadata } from "../story/types";
import { EditorCommandCoordinator } from "./editor-command-coordinator";
import type { EditorAgentBridge } from "./register-agent-tools";
import type { EditorContextBridge, EditorStoryView } from "./editor-context";
import { projectRevision } from "../state/project-revision";
import { storyCollectionEntryId } from "../story/collection-identity";
import { legacyStoryGroups, migrateStoryData, replaceLegacyStoryGroups } from "../story/migration";
import { effectiveWorldEntry } from "../story/world-entry-effective";
import { invalidMemberOfIds } from "../story/membership-semantics";
import { applyStoryCommand } from "../story/operations";

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
const metadataSchema = z.object({ refs: z.array(refSchema).min(1).max(1000), metadata: storyMetadataSchema, action: z.enum(["add", "remove", "replace"]).default("replace"), accessFields: z.array(z.enum(["allow", "deny", "permission", "physicalState", "lock", "keyIds", "guardIds", "secretKnowledge", "hidden", "knownBy"])).optional(), target: z.enum(["base", "scenario"]).optional(), context: storyViewContextSchema.optional(), resetOwnership: z.boolean().optional() }).strict();
const inspectSchema = z.object({ refs: z.array(refSchema).max(1000).optional(), query: z.string().max(2000).optional(), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(50), context: storyViewContextSchema.optional() }).strict();
const viewSchema = z.object({ scenarioId: z.string().optional(), stepId: z.string().optional(), lensId: z.string().optional(), lensIds: z.array(z.string().min(1)).max(100).optional(), previewLens: z.record(z.string(), z.unknown()).nullable().optional(), routeId: z.string().optional(), editTarget: z.enum(["base", "scenario"]).optional(), neutral: z.boolean().optional() }).strict();

/** Story commands use the same preparation, transaction, revision and undo boundary as geometry. */
export function createStoryAgentTools(bridge: Bridge, coordinator: EditorCommandCoordinator): WebMcpTool[] {
  const currentContext = () => { const view = bridge.getEditorContext?.().view; return { scenarioId: view?.scenarioId, stepId: view?.stepId, lensId: view?.lensId }; };
  return [
    { name: "inspect_story_catalog", description: "Read counts/schemas before edits. Zones group objects and share traits without replacing local properties; groups is a legacy alias, not a separate store. Actor access-groups are separate. No paid embedded model.", inputSchema: z.toJSONSchema(readSchema, { io: "input" }), annotations: { readOnlyHint: true }, execute: async (raw) => {
      const input = readSchema.parse(raw); const project = bridge.getSession().getViewState().project;
      const story = migrateStoryData(project.story);
      if (!input.collection) return response({ revision: projectRevision(project), collections: collections.filter((name) => name !== "groups").map((name) => ({ name, count: story[name].length })), legacyAliases: { groups: "zones" }, context: currentContext() });
      const items = input.collection === "groups" ? legacyStoryGroups(story) : story[input.collection]; const entries = items.slice(input.offset, input.offset + input.limit);
      const effectiveEntries = input.collection === "world" ? story.world.slice(input.offset, input.offset + input.limit).map(({ id: entryId }) => effectiveWorldEntry(story, entryId)) : undefined;
      return response({ collection: input.collection, schema: z.toJSONSchema(storyCollectionSchemas[input.collection], { io: "input" }), total: items.length, offset: input.offset, entries, ...(effectiveEntries ? { effectiveEntries } : {}), entryIds: entries.map((entry) => storyCollectionEntryId(entry as unknown as Record<string, unknown>)) });
    } },
    { name: "inspect_story_objects", description: "Read canonical text, effective traits, sources, conflicts and lens explanations. Paginated refs; omit for all. Query is lexical, not embeddings. Defaults to active scenario/step. Distinguish facts from suggestions.", inputSchema: z.toJSONSchema(inspectSchema, { io: "input" }), annotations: { readOnlyHint: true }, execute: async (raw) => {
      const input = inspectSchema.parse(raw); const project = bridge.getSession().getViewState().project; const context = input.context ?? currentContext();
      const refs = input.refs?.map(storyRef) ?? allStoryObjectRefs(project);
      const liveView = input.context ? undefined : bridge.getEditorContext?.().view;
      const activeLenses = visibleStoryLenses(project.story.lenses, { activeLensId: context.lensId, activeLensIds: liveView?.lensIds, previewLens: liveView?.previewLens ?? undefined });
      const evaluate = createProjectLensEvaluator(project, project.story, context);
      const objects = refs.map((ref) => { const object = effectiveProjectStoryObject(project, ref, context); if (!object) return { ref, missing: true }; return { ...object, ...(context.lensId ? { lens: evaluateProjectLens(project, project.story, context.lensId, object.ref, context) } : {}), ...(activeLenses.length ? { lenses: activeLenses.map((lens) => evaluate(lens, object.ref)) } : {}) }; });
      const terms = input.query?.toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? [];
      const matches = objects.filter((object) => terms.every((term) => JSON.stringify(object).toLocaleLowerCase().includes(term)));
      return response({ revision: projectRevision(project), context, total: matches.length, objects: matches.slice(input.offset, input.offset + input.limit) });
    } },
    { name: "prepare_edit_story", description: "Upsert/remove Story entries using inspect_story_catalog schemas. Omitted fields persist; new entries must be complete. For member-of, groupId must identify a faction or people group. General knows memberships do not replace the knownBy list on new hidden passages. Objects use scoped refs. Geometry is unchanged, including removals. Apply/propose via execute_editor_batch or token.", inputSchema: z.toJSONSchema(editSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (raw) => {
      const input = editSchema.parse(raw);
      if (input.action === "upsert" && input.collection === "objects") throw new Error("Use prepare_set_story_metadata for map annotations: it preserves native text, scope, locks and scenario targeting.");
      if (input.action === "upsert" && input.collection === "routes") throw new Error("Use prepare_save_story_route to calculate a verified route from an explicit query.");
      return response(coordinator.prepare(`story:${crypto.randomUUID()}`, (project) => {
        const canonical = migrateStoryData(project.story);
        if (input.action === "remove" && input.collection === "world") {
          if (!input.ids?.length) throw new Error("Removal requires explicit ids from the inspected collection.");
          const removal = applyStoryCommand(canonical, { kind: "bulk", commands: input.ids.map((id) => ({ kind: "remove", collection: "world", id })) });
          const failure = removal.diagnostics.find(({ code }) => code === "blocked" || code === "invalid" || code === "not-found");
          if (failure) throw new Error(failure.message);
          return { project: { ...project, story: removal.story }, summary: `Opowieść: ${input.collection} (${input.action}).` };
        }
        const before = (input.collection === "groups" ? legacyStoryGroups(canonical) : canonical[input.collection]) as unknown as Record<string, unknown>[];
        const identity = storyCollectionEntryId;
        let next = [...before];
        if (input.action === "remove") { if (!input.ids?.length) throw new Error("Removal requires explicit ids from the inspected collection."); next = next.filter((entry) => !input.ids!.includes(identity(entry))); }
        else { if (!input.entries?.length) throw new Error("Upsert requires entries."); for (const entry of input.entries) { const index = next.findIndex((candidate) => identity(candidate) === identity(entry)); if (index >= 0) next[index] = { ...next[index], ...entry }; else next.push(entry); } }
        const story = input.collection === "groups"
          ? replaceLegacyStoryGroups(canonical, storyCollectionSchemas.groups.parse(next))
          : migrateStoryData(storyDataSchema.parse({ ...canonical, [input.collection]: storyCollectionSchemas[input.collection].parse(next) }));
        const invalidBefore = invalidMemberOfIds(canonical); const invalidAfter = invalidMemberOfIds(story);
        const introduced = [...invalidAfter].filter(([id]) => !invalidBefore.has(id));
        if (introduced.length) throw new Error(introduced.map(([, message]) => message).join(" "));
        const changed = input.collection === "scenarios" ? replaceProjectScenarios(project, story.scenarios) : { ...project, story };
        return { project: changed, summary: `Opowieść: ${input.collection} (${input.action}).` };
      }));
    } },
    { name: "prepare_set_story_metadata", description: "Prepare scoped story owners, traits, access, keys, guards, tags or text. Hidden passages use hidden=true and knownBy; [] means nobody knows. Defaults to the active scenario; target=base overrides. replace updates supplied fields, remove deletes them, owners is exact, and resetOwnership=true with metadata={} restores inheritance. Keys grant no permission; editor locks still apply. Native labels/descriptions are updated when supported.", inputSchema: z.toJSONSchema(metadataSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (raw) => {
      const input = metadataSchema.parse(raw); const refs = input.refs.map(storyRef); const context = input.context ?? currentContext(); const target = input.target ?? bridge.getEditorContext?.().view.editTarget;
      return response(coordinator.prepare(`story-metadata:${crypto.randomUUID()}`, (project) => ({ project: applyProjectStoryMetadata(project, { ...input, metadata: input.metadata as StoryObjectMetadata, refs, context, target }), summary: `Zmieniono właściwości opowieści: ${refs.length}.` })));
    } },
    { name: "set_story_view", description: "Show lensIds (several) or lensId, scenario/step/route. previewLens uses the lenses catalog schema without saving; null clears it. neutral=true clears all view filters, not data. Deferred for unfinished drawings/overlaps.", inputSchema: z.toJSONSchema(viewSchema, { io: "input" }), annotations: { readOnlyHint: false }, execute: async (raw) => {
      const input = viewSchema.parse(raw); const project = bridge.getSession().getViewState().project;
      if (!bridge.setStoryView) throw new Error("This host did not expose Story view controls.");
      const { neutral, previewLens, ...fields } = input;
      const patch: EditorStoryView = { ...fields };
      if ("previewLens" in input) patch.previewLens = previewLens === null ? null : storyCollectionSchemas.lenses.parse([previewLens])[0];
      if (patch.lensIds && patch.lensId !== undefined && (patch.lensIds.length !== 1 || patch.lensIds[0] !== patch.lensId)) throw new Error("Supply lensId or lensIds, not conflicting selections.");
      if (patch.lensIds?.some((id) => !project.story.lenses.some((lens) => lens.id === id))) throw new Error("Lens not found.");
      if (patch.lensId && !project.story.lenses.some(({ id }) => id === patch.lensId)) throw new Error("Lens not found.");
      if (patch.routeId && !project.story.routes.some(({ id }) => id === patch.routeId)) throw new Error("Route not found.");
      const scenarioId = patch.scenarioId ?? currentContext().scenarioId;
      const scenario = scenarioId ? project.story.scenarios.find(({ id }) => id === scenarioId) : undefined;
      if (scenarioId && !scenario) throw new Error("Scenario not found.");
      if (patch.stepId && !scenario?.steps.some(({ id }) => id === patch.stepId)) throw new Error("Scenario step not found.");
      const result = bridge.setStoryView(neutral ? { scenarioId: undefined, stepId: undefined, lensId: undefined, lensIds: [], previewLens: null, routeId: undefined, editTarget: "base" } : patch);
      return response(result?.status === "deferred" ? result : { status: "view-updated" });
    } },
  ];
}
