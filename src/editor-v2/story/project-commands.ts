import type { EditorProject } from "../model/project-model";
import { resolveStoryObject, roomScopeMatches } from "./project-adapter";
import { effectiveProjectStoryObject, projectStoryData } from "./project-effective";
import { editedAccessFields } from "./access-edit";
import { defaultStoryAccessPolicy, type StoryAccessPolicy } from "./types";
import { storyMetadataSchema } from "./schema";
import { applyStoryCommand, mergeStoryMetadata } from "./operations";
import { resetStoryOwnership, resolveStoryOwnership } from "./ownership";
import { validateScenarioShape } from "./scenario-commands";
import { assertProjectStoryObjectEditable } from "./story-locks";
import { sameStoryRef, storyRefKey, type StoryData, type StoryMetadataBulkAction, type StoryObjectMetadata, type StoryObjectRef, type StoryTextPatch, type StoryViewContext } from "./types";

export type ProjectStoryMetadataCommand = {
  refs: readonly StoryObjectRef[];
  metadata: Partial<StoryObjectMetadata>;
  action: StoryMetadataBulkAction;
  target?: "base" | "scenario";
  context?: StoryViewContext;
  accessFields?: Array<keyof StoryAccessPolicy>;
  /** Remove the local owners field and restore the inherited ownership layer. */
  resetOwnership?: boolean;
};

function has(value: object, key: PropertyKey) { return Object.prototype.hasOwnProperty.call(value, key); }
function fail(message: string): never { throw new Error(`Story metadata edit rejected: ${message}`); }
function canonicalize(story: StoryData, refs: readonly StoryObjectRef[], project: EditorProject) {
  const resolved = refs.map((ref) => {
    const value = resolveStoryObject(project, story, ref);
    if (!value) fail(`object ${storyRefKey(ref)} is missing or its scope is ambiguous`);
    assertProjectStoryObjectEditable(project, ref, value);
    return value;
  });
  const keys = new Set<string>();
  for (const value of resolved) { const key = storyRefKey(value.ref); if (keys.has(key)) fail(`duplicate canonical object ${key}`); keys.add(key); }
  return resolved;
}
function validateScenarioContext(story: StoryData, context: StoryViewContext) {
  if (!context.scenarioId) fail("scenario target requires context.scenarioId");
  const scenarios = story.scenarios.filter(({ id }) => id === context.scenarioId);
  if (!scenarios.length) fail(`scenario ${context.scenarioId} does not exist`);
  if (scenarios.length > 1) fail(`scenario ${context.scenarioId} is ambiguous`);
  const scenario = scenarios[0]!;
  validateScenarioShape(scenario);
  if (context.stepId && scenario.steps.filter(({ id }) => id === context.stepId).length > 1) fail(`step ${context.stepId} is ambiguous in scenario ${scenario.id}`);
  if (context.stepId && !scenario.steps.some(({ id }) => id === context.stepId)) fail(`step ${context.stepId} does not belong to scenario ${scenario.id}`);
}
function validatePropertyTargets(story: StoryData, refs: readonly StoryObjectRef[], metadata: Partial<StoryObjectMetadata>) {
  for (const propertyId of Object.keys(metadata.properties ?? {})) {
    const definition = story.propertyDefinitions.find(({ id }) => id === propertyId);
    if (definition?.targetKinds?.length && refs.some(({ kind }) => !definition.targetKinds!.includes(kind))) {
      fail(`property ${propertyId} is not applicable to every selected object kind`);
    }
  }
}
function storyMetadataFor(ref: StoryObjectRef, metadata: Partial<StoryObjectMetadata>): Partial<StoryObjectMetadata> {
  return ["wall", "opening", "transition"].includes(ref.kind) ? metadata : Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== "narrativeLabel" && key !== "narrativeDescription"));
}
function nativeTextRequested(ref: StoryObjectRef, metadata: Partial<StoryObjectMetadata>) {
  return !["wall", "opening", "transition"].includes(ref.kind) && (has(metadata, "narrativeLabel") || has(metadata, "narrativeDescription"));
}
function textValue(action: StoryMetadataBulkAction, current: string, metadata: Partial<StoryObjectMetadata>, key: "narrativeLabel" | "narrativeDescription"): string | undefined {
  if (!has(metadata, key)) return current;
  if (action === "remove") { if (key === "narrativeDescription") return undefined; fail(`cannot remove required native ${key}; edit it to a non-empty value instead`); }
  const value = metadata[key];
  if (typeof value !== "string" || key === "narrativeLabel" && !value.trim()) fail(`native ${key} must be a non-empty string`);
  return value;
}
function patchId(target: StoryObjectRef, existing: readonly StoryTextPatch[]) {
  const base = `story-edit:${storyRefKey(target)}`; const used = new Set(existing.map(({ id }) => id)); if (!used.has(base)) return base;
  let index = 2; while (used.has(`${base}:${index}`)) index++; return `${base}:${index}`;
}
function patchIsEmpty(patch: StoryTextPatch) { return !has(patch, "title") && !has(patch, "description") && !patch.properties && !patch.metadata; }
function authoredBaseAccess(story: StoryData, ref: StoryObjectRef): StoryAccessPolicy {
  return story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref))?.metadata.access ?? defaultStoryAccessPolicy();
}
function editPatch(existing: StoryTextPatch | undefined, target: StoryObjectRef, command: ProjectStoryMetadataCommand, allPatches: readonly StoryTextPatch[]): StoryTextPatch | undefined {
  const metadata = command.metadata; const next: StoryTextPatch = { ...(existing ?? { id: patchId(target, allPatches), target }), target };
  const label = has(metadata, "narrativeLabel") ? metadata.narrativeLabel : undefined; const description = has(metadata, "narrativeDescription") ? metadata.narrativeDescription : undefined;
  if (has(metadata, "narrativeLabel")) { if (command.action === "remove") delete next.title; else if (typeof label === "string" && label.trim()) next.title = label; else fail("scenario narrativeLabel must be a non-empty string"); }
  if (has(metadata, "narrativeDescription")) { if (command.action === "remove") delete next.description; else if (typeof description === "string") next.description = description; else fail("scenario narrativeDescription must be a string"); }
  const propertyChange = metadata.properties;
  if (propertyChange !== undefined) {
    const properties = { ...(next.properties ?? {}) };
    if (command.action === "remove") for (const key of Object.keys(propertyChange)) delete properties[key]; else Object.assign(properties, propertyChange);
    if (Object.keys(properties).length) next.properties = properties; else delete next.properties;
  }
  const patchMetadata = { ...metadata }; delete patchMetadata.properties; delete patchMetadata.narrativeLabel; delete patchMetadata.narrativeDescription;
  if (Object.keys(patchMetadata).length) {
    const merged = mergeStoryMetadata(next.metadata ?? {}, patchMetadata, command.action);
    if (Object.keys(merged).length) next.metadata = merged; else delete next.metadata;
  }
  return patchIsEmpty(next) ? undefined : next;
}
function applyScenario(story: StoryData, refs: readonly StoryObjectRef[], command: ProjectStoryMetadataCommand, context: StoryViewContext) {
  if (!context.scenarioId) fail("scenario target requires context.scenarioId");
  const scenario = story.scenarios.find(({ id }) => id === context.scenarioId); if (!scenario) fail(`scenario ${context.scenarioId} does not exist`);
  const step = context.stepId ? scenario.steps.find(({ id }) => id === context.stepId) : undefined; if (context.stepId && !step) fail(`step ${context.stepId} does not belong to scenario ${scenario.id}`);
  const container = step ? step.patches : scenario.patches; const nextPatches = [...container];
  for (const target of refs) {
    const index = nextPatches.findLastIndex(({ target: candidate }) => sameStoryRef(candidate, target)); const next = editPatch(index >= 0 ? nextPatches[index] : undefined, target, command, nextPatches);
    if (next) { if (index >= 0) nextPatches[index] = next; else nextPatches.push(next); } else if (index >= 0) nextPatches.splice(index, 1);
  }
  const scenarios = story.scenarios.map((candidate) => candidate.id !== scenario.id ? candidate : step ? { ...candidate, steps: candidate.steps.map((candidateStep) => candidateStep.id === step.id ? { ...candidateStep, patches: nextPatches } : candidateStep) } : { ...candidate, patches: nextPatches });
  return { ...story, scenarios };
}
function nativeText(project: EditorProject, ref: StoryObjectRef, metadata: Partial<StoryObjectMetadata>, action: StoryMetadataBulkAction): EditorProject {
  if (!nativeTextRequested(ref, metadata)) return project;
  const nameChange = has(metadata, "narrativeLabel"); const descriptionChange = has(metadata, "narrativeDescription");
  let next = project;
  if (ref.kind === "place" || ref.kind === "room") {
    const matchesPlace = (place: EditorProject["places"][number]) => ref.kind === "place"
      ? place.id === ref.id && place.kind !== "room" && place.kind !== "standalone-room"
      : place.id === ref.id && (place.kind === "room" || place.kind === "standalone-room") && roomScopeMatches(project, place, ref.scopeId);
    next = { ...next, places: next.places.map((place) => matchesPlace(place) ? { ...place, ...(nameChange ? { name: textValue(action, place.name, metadata, "narrativeLabel") } : {}), ...(descriptionChange ? { description: textValue(action, place.description ?? "", metadata, "narrativeDescription") } : {}) } : place) };
    if (ref.kind === "room") next = { ...next, constructions: next.constructions.map((document) => document.id !== ref.scopeId ? document : { ...document, rooms: document.rooms.map((room) => room.id === ref.id ? { ...room, ...(nameChange ? { name: textValue(action, room.name, metadata, "narrativeLabel") } : {}), ...(descriptionChange ? { description: textValue(action, room.description ?? "", metadata, "narrativeDescription") } : {}) } : room) }) };
  } else if (ref.kind === "element") next = { ...next, elements: next.elements.map((element) => element.id === ref.id ? { ...element, ...(nameChange ? { name: textValue(action, element.name, metadata, "narrativeLabel") } : {}), ...(descriptionChange ? { description: textValue(action, element.description ?? "", metadata, "narrativeDescription") } : {}) } : element) };
  else if (ref.kind === "surface") next = { ...next, surfaces: next.surfaces.map((surface) => surface.id === ref.id ? { ...surface, ...(nameChange ? { name: textValue(action, surface.name, metadata, "narrativeLabel") } : {}), ...(descriptionChange ? { description: textValue(action, surface.description ?? "", metadata, "narrativeDescription") } : {}) } : surface) };
  return next;
}
/** Pure, all-or-nothing Story metadata/text edit over native project records. */
export function applyProjectStoryMetadata(project: EditorProject, command: ProjectStoryMetadataCommand): EditorProject {
  const parsed = storyMetadataSchema.partial().safeParse(command.metadata); if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "invalid metadata");
  if (!command.refs.length) return project;
  const context = command.context ?? {}; const target = command.target ?? (context.scenarioId ? "scenario" : "base"); const story = projectStoryData(project); const resolved = canonicalize(story, command.refs, project); validatePropertyTargets(story, resolved.map(({ ref }) => ref), command.metadata);
  if (target === "scenario") validateScenarioContext(story, context);
  const refs = resolved.map(({ ref }) => ref); let nextStory = story;
  if (command.resetOwnership) {
    if (Object.keys(command.metadata).length || command.accessFields?.length) fail("ownership reset cannot be combined with other metadata fields");
    return refs.reduce((current, ref) => resetStoryOwnership(current, { ref, target, context }), project);
  }
  if (command.accessFields && command.metadata.access) {
    const { access, ...other } = command.metadata;
    return refs.reduce((current, ref) => {
      const policy = target === "base"
        ? authoredBaseAccess(projectStoryData(current), ref)
        : effectiveProjectStoryObject(current, ref, context)?.metadata.access ?? defaultStoryAccessPolicy();
      // Do not materialize an empty scenario patch while splitting the access
      // edit. An empty intermediate patch is invalid StoryData and would make
      // the next recursive pass fall back to the legacy migration path.
      const changed = Object.keys(other).length
        ? applyProjectStoryMetadata(current, { ...command, refs: [ref], metadata: other, accessFields: undefined })
        : current;
      return applyProjectStoryMetadata(changed, { ...command, refs: [ref], action: "replace", metadata: { access: editedAccessFields(policy, access, command.accessFields!, command.action) }, accessFields: undefined });
    }, project);
  }
  if (has(command.metadata, "owners") && command.action !== "replace") {
    const { owners, ...other } = command.metadata;
    return refs.reduce((current, ref) => {
      const ownership = resolveStoryOwnership(current, current.story, ref, target === "scenario" ? context : {});
      const before = ownership.effectiveOwners;
      const requested = owners ?? [];
      const nextOwners = command.action === "add" ? [...new Set([...before, ...requested])] : before.filter((owner) => !requested.includes(owner));
      const shouldWriteOwners = ownership.directPresent || JSON.stringify(before) !== JSON.stringify(nextOwners);
      const changed = shouldWriteOwners
        ? applyProjectStoryMetadata(current, { ...command, refs: [ref], metadata: { owners: nextOwners }, action: "replace", accessFields: undefined })
        : current;
      return Object.keys(other).length
        ? applyProjectStoryMetadata(changed, { ...command, refs: [ref], metadata: other, accessFields: undefined })
        : changed;
    }, project);
  }
  if (target === "scenario") nextStory = applyScenario(story, refs, command, context);
  else {
    const storyRefs = refs.filter((ref) => Object.keys(storyMetadataFor(ref, command.metadata)).length > 0);
    const canonicalObjects = story.objects.map((object) => { const oldResolved = resolveStoryObject(project, story, object.ref); const match = oldResolved && resolved.find(({ ref }) => sameStoryRef(ref, oldResolved.ref)); return match ? { ...object, ref: match.ref } : object; });
    if (new Set(canonicalObjects.map(({ ref }) => storyRefKey(ref))).size !== canonicalObjects.length) fail("legacy room aliases collapse to duplicate narrative records");
    nextStory = { ...story, objects: canonicalObjects };
    const existing = new Set(canonicalObjects.map(({ ref }) => storyRefKey(ref))); const seed = command.action === "replace" ? storyRefs.filter((ref) => !existing.has(storyRefKey(ref))) : [];
    if (seed.length) nextStory = { ...nextStory, objects: [...nextStory.objects, ...seed.map((ref) => ({ ref, metadata: {} }))] };
    const existingRefs = new Set(nextStory.objects.map(({ ref }) => storyRefKey(ref)));
    for (const ref of storyRefs.filter((candidate) => command.action !== "remove" || existingRefs.has(storyRefKey(candidate)))) {
      const metadata = storyMetadataFor(ref, command.metadata); if (!Object.keys(metadata).length) continue;
      const result = applyStoryCommand(nextStory, { kind: "bulk-metadata", refs: [ref], action: command.action, metadata });
      if (result.diagnostics.some(({ code }) => code === "invalid" || code === "not-found")) fail(result.diagnostics.map(({ message }) => message).join("; ")); nextStory = result.story;
    }
  }
  let next = { ...project, story: nextStory };
  if (target === "base") for (const ref of refs) next = nativeText(next, ref, command.metadata, command.action);
  return next;
}
