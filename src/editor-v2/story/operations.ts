import { storyCollectionSchemas, storyDataSchema } from "./schema";
import { legacyStoryGroups, migrateStoryData, replaceLegacyStoryGroups } from "./migration";
import { defaultStoryAccessPolicy, sameStoryRef, storyRefKey, type StoryCommandResult, type StoryData, type StoryDiagnostic, type StoryEvidence, type StoryGroup, type StoryLens, type StoryMetadataBulkCommand, type StoryObject, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyDefinition, type StoryPropertyValue, type StoryRelation, type StoryScenario, type StoryWorldEntry, type StoryZone } from "./types";
import { memberOfSemanticIssue } from "./membership-semantics";

type StoryCollection = "world" | "propertyDefinitions" | "objects" | "groups" | "zones" | "lenses" | "scenarios" | "relations" | "intentions" | "evidence" | "routes";
type StoryItem = StoryWorldEntry | StoryPropertyDefinition | StoryObject | StoryGroup | StoryZone | StoryLens | StoryScenario | StoryRelation | StoryData["intentions"][number] | StoryEvidence | StoryData["routes"][number];
type NonBulkCommand =
  | { kind: "add"; collection: StoryCollection; item: StoryItem }
  | { kind: "remove"; collection: StoryCollection; id: string }
  | { kind: "replace"; collection: StoryCollection; items: StoryItem[] }
  | { kind: "delete-object"; ref: StoryObjectRef };
export type StoryCommand = NonBulkCommand | StoryMetadataBulkCommand | { kind: "bulk"; commands: NonBulkCommand[] };

function clone<T>(value: T): T { return structuredClone(value); }
function idFor(item: StoryItem) { return "ref" in item ? storyRefKey(item.ref) : item.id; }
function diagnostic(code: string, message: string, refs?: StoryObjectRef[], ids?: string[]): StoryDiagnostic { return { code, message, ...(refs ? { refs } : {}), ...(ids ? { ids } : {}) }; }
function collectionItems(story: StoryData, collection: StoryCollection) { return story[collection] as StoryItem[]; }

const worldReferenceFields = ["allow", "deny", "keyIds", "guardIds", "secretKnowledge", "knownBy"] as const;
function withoutDeletedWorldReferences(metadata: StoryObjectMetadata | undefined, deletedIds: ReadonlySet<string>) {
  if (!metadata) return metadata;
  const next = { ...metadata };
  if (metadata.owners) next.owners = metadata.owners.filter((id) => !deletedIds.has(id));
  if (metadata.access) {
    const access = { ...metadata.access };
    for (const field of worldReferenceFields) {
      const values = access[field];
      if (values) access[field] = values.filter((id) => !deletedIds.has(id));
    }
    next.access = access;
  }
  return next;
}

/** Removes only live access/ownership references; authored history stays inspectable. */
function removeWorldEntryReferences(story: StoryData, deletedIds: ReadonlySet<string>) {
  const cleanPatch = <T extends { metadata?: StoryObjectMetadata }>(patch: T): T => ({ ...patch, ...(patch.metadata ? { metadata: withoutDeletedWorldReferences(patch.metadata, deletedIds) } : {}) });
  return {
    ...story,
    memberships: story.memberships.filter(({ subjectId, groupId }) => !deletedIds.has(subjectId) && !deletedIds.has(groupId)),
    objects: story.objects.map((object) => ({ ...object, metadata: withoutDeletedWorldReferences(object.metadata, deletedIds)! })),
    groups: story.groups.map((group) => ({ ...group, entryIds: group.entryIds.filter((id) => !deletedIds.has(id)), metadata: withoutDeletedWorldReferences(group.metadata, deletedIds)! })),
    zones: story.zones.map((zone) => ({ ...zone, ...(zone.entryIds ? { entryIds: zone.entryIds.filter((id) => !deletedIds.has(id)) } : {}), ...(zone.metadata ? { metadata: withoutDeletedWorldReferences(zone.metadata, deletedIds) } : {}) })),
    scenarios: story.scenarios.map((scenario) => ({ ...scenario, patches: scenario.patches.map(cleanPatch), steps: scenario.steps.map((step) => ({ ...step, patches: step.patches.map(cleanPatch) })) })),
  };
}

function operationalRouteReference(story: StoryData, deletedWorldIds: ReadonlySet<string>, deletedScenarioIds: ReadonlySet<string>, deletedStepRefs: ReadonlySet<string>) {
  return story.routes.find((route) => {
    const { actorId, scenarioId, stepId } = route.query;
    return Boolean(actorId && deletedWorldIds.has(actorId)) || Boolean(scenarioId && deletedScenarioIds.has(scenarioId)) || Boolean(scenarioId && stepId && deletedStepRefs.has(`${scenarioId}:${stepId}`));
  });
}

export function mergeStoryMetadata(base: StoryObjectMetadata, change: Partial<StoryObjectMetadata>, action: StoryMetadataBulkCommand["action"]): StoryObjectMetadata {
  const combine = (before: string[], after: string[]) => action === "replace" ? [...after] : action === "add" ? [...new Set([...before, ...after])] : before.filter((entry) => !after.includes(entry));
  const beforeAccess = { ...defaultStoryAccessPolicy(), ...(base.access ?? {}) }; const afterAccess = change.access;
  const accessField = (before: string[], after: string[] | undefined) => after === undefined ? before : action === "replace" ? [...after] : combine(before, after);
  const optionalAccessField = (before: string[] | undefined, after: string[] | undefined) => after === undefined ? before : action === "replace" ? [...after] : combine(before ?? [], after);
  const knownBy = afterAccess ? optionalAccessField(beforeAccess.knownBy, afterAccess.knownBy) : undefined;
  const access = afterAccess ? { ...beforeAccess, ...(action === "replace" ? afterAccess : {}), allow: accessField(beforeAccess.allow, afterAccess.allow), deny: accessField(beforeAccess.deny, afterAccess.deny), keyIds: accessField(beforeAccess.keyIds, afterAccess.keyIds), guardIds: accessField(beforeAccess.guardIds, afterAccess.guardIds), secretKnowledge: accessField(beforeAccess.secretKnowledge, afterAccess.secretKnowledge), ...(knownBy === undefined ? {} : { knownBy }) } : base.access;
  const properties: Record<string, StoryPropertyValue> = { ...(base.properties ?? {}) };
  if (change.properties !== undefined) {
    if (action === "replace" || action === "add") Object.assign(properties, change.properties);
    else for (const key of Object.keys(change.properties)) delete properties[key];
  }
  const field = (before: string[], after: string[] | undefined) => after === undefined ? before : combine(before, after);
  const textField = (before: string | undefined, after: string | undefined) => after === undefined ? before : action === "remove" ? undefined : after;
  const next: StoryObjectMetadata = {};
  if (change.properties !== undefined || base.properties !== undefined) next.properties = properties;
  const narrativeLabel = textField(base.narrativeLabel, change.narrativeLabel); const narrativeDescription = textField(base.narrativeDescription, change.narrativeDescription);
  if (narrativeLabel !== undefined) next.narrativeLabel = narrativeLabel; if (narrativeDescription !== undefined) next.narrativeDescription = narrativeDescription;
  if (change.owners !== undefined || base.owners !== undefined) next.owners = field(base.owners ?? [], change.owners);
  if (change.tags !== undefined || base.tags !== undefined) next.tags = field(base.tags ?? [], change.tags);
  if (access !== undefined) next.access = access;
  return next;
}

export function danglingStoryReferences(story: StoryData): StoryDiagnostic[] {
  const known = new Set(story.objects.map(({ ref }) => storyRefKey(ref)));
  const worldIds = new Set(story.world.map(({ id }) => id));
  const diagnostics: StoryDiagnostic[] = [];
  const inspect = (ref: StoryObjectRef, source: string) => { if (!known.has(storyRefKey(ref))) diagnostics.push(diagnostic("unresolved-reference", `${source} references ${storyRefKey(ref)}; it was not retargeted.`, [ref])); };
  const inspectWorld = (id: string, source: string) => { if (!worldIds.has(id)) diagnostics.push(diagnostic("unresolved-world-reference", `${source} references world entry ${id}; it was not retargeted.`, undefined, [id])); };
  for (const group of story.groups) group.memberRefs.forEach((ref) => inspect(ref, `Group ${group.id}`));
  for (const group of story.groups) group.entryIds.forEach((id) => inspectWorld(id, `Group ${group.id}`));
  for (const membership of story.memberships) {
    inspectWorld(membership.subjectId, "Membership subject"); inspectWorld(membership.groupId, "Membership group");
    const issue = memberOfSemanticIssue(story, membership); if (issue) diagnostics.push(diagnostic("invalid-membership-target", issue, undefined, [membership.subjectId, membership.groupId]));
  }
  const inspectMetadata = (metadata: StoryObjectMetadata | undefined, source: string) => {
    const access = metadata?.access;
    for (const id of [...(metadata?.owners ?? []), ...(access?.allow ?? []), ...(access?.deny ?? []), ...(access?.keyIds ?? []), ...(access?.guardIds ?? []), ...(access?.secretKnowledge ?? []), ...(access?.knownBy ?? [])]) inspectWorld(id, source);
  };
  for (const object of story.objects) inspectMetadata(object.metadata, `Object ${storyRefKey(object.ref)}`);
  for (const group of story.groups) inspectMetadata(group.metadata, `Group ${group.id}`);
  for (const zone of story.zones) { zone.members.forEach(({ ref }) => inspect(ref, `Zone ${zone.id}`)); zone.entryIds?.forEach((id) => inspectWorld(id, `Zone ${zone.id}`)); inspectMetadata(zone.metadata, `Zone ${zone.id}`); }
  for (const scenario of story.scenarios) { const patches = [...scenario.patches, ...scenario.steps.flatMap(({ patches: values }) => values)]; patches.forEach((patch) => { inspect(patch.target, `Scenario ${scenario.id}`); inspectMetadata(patch.metadata, `Scenario ${scenario.id}`); }); }
  for (const relation of story.relations) for (const actor of [relation.from, relation.to]) if ("kind" in actor) inspect(actor, `Relation ${relation.id}`);
  for (const intention of story.intentions) inspect(intention.subject, `Intention ${intention.id}`);
  for (const item of story.evidence) item.refs.forEach((ref) => inspect(ref, `Evidence ${item.id}`));
  return diagnostics;
}

function applyOne(input: StoryData, command: NonBulkCommand): { story: StoryData; diagnostics: StoryDiagnostic[] } {
  const story = clone(input); const diagnostics: StoryDiagnostic[] = [];
  if (command.kind === "delete-object") {
    const key = storyRefKey(command.ref); story.objects = story.objects.filter(({ ref }) => storyRefKey(ref) !== key);
    if (story.objects.length === input.objects.length) diagnostics.push(diagnostic("not-found", `Story object ${key} does not exist.`, [command.ref]));
    return { story, diagnostics: [...diagnostics, ...danglingStoryReferences(story)] };
  }
  if (command.collection === "groups") return applyLegacyGroupCommand(story, command);
  const items = collectionItems(story, command.collection);
  if (command.kind === "add") {
    if (items.some((item) => idFor(item) === idFor(command.item))) return { story: input, diagnostics: [diagnostic("duplicate", `An item with id ${idFor(command.item)} already exists.`, "ref" in command.item ? [command.item.ref] : undefined, "ref" in command.item ? undefined : [idFor(command.item)])] };
    items.push(clone(command.item));
  } else if (command.kind === "remove") {
    const kept = items.filter((item) => idFor(item) !== command.id); if (kept.length === items.length) diagnostics.push(diagnostic("not-found", `No ${command.collection} item ${command.id} exists.`, undefined, [command.id])); else (story as unknown as Record<StoryCollection, StoryItem[]>)[command.collection] = kept;
  } else {
    (story as unknown as Record<StoryCollection, StoryItem[]>)[command.collection] = clone(command.items);
  }
  if (command.collection === "world") {
    const remaining = new Set(story.world.map(({ id }) => id));
    const deletedIds = new Set(input.world.map(({ id }) => id).filter((id) => !remaining.has(id)));
    const routeReference = operationalRouteReference(input, deletedIds, new Set(), new Set());
    if (routeReference) return { story: input, diagnostics: [diagnostic("blocked", `Cannot delete world entry ${[...deletedIds][0]}; saved route ${routeReference.id} uses it as its actor.`)] };
    if (deletedIds.size) Object.assign(story, removeWorldEntryReferences(story, deletedIds));
  }
  if (command.collection === "scenarios") {
    const beforeById = new Map(input.scenarios.map((scenario) => [scenario.id, scenario]));
    const remainingScenarioIds = new Set(story.scenarios.map(({ id }) => id));
    const deletedScenarioIds = new Set(input.scenarios.map(({ id }) => id).filter((id) => !remainingScenarioIds.has(id)));
    const deletedStepRefs = new Set<string>();
    for (const [scenarioId, before] of beforeById) {
      const after = story.scenarios.find((scenario) => scenario.id === scenarioId);
      if (!after || !Array.isArray(after.steps)) continue;
      const remainingStepIds = new Set(after.steps.map(({ id }) => id));
      for (const step of before.steps) if (!remainingStepIds.has(step.id)) deletedStepRefs.add(`${scenarioId}:${step.id}`);
    }
    const routeReference = operationalRouteReference(input, new Set(), deletedScenarioIds, deletedStepRefs);
    if (routeReference) return { story: input, diagnostics: [diagnostic("blocked", `Cannot delete scenario context; saved route ${routeReference.id} still uses it.`)] };
  }
  const parsed = storyDataSchema.safeParse(story);
  if (!parsed.success) return { story: input, diagnostics: [diagnostic("invalid", parsed.error.issues[0]?.message ?? "Invalid story command.")] };
  return { story: parsed.data, diagnostics: [...diagnostics, ...danglingStoryReferences(parsed.data)] };
}

function asLegacyGroup(item: StoryItem): StoryGroup | undefined {
  const parsed = storyCollectionSchemas.groups.safeParse([item]);
  return parsed.success ? parsed.data[0] : undefined;
}

function applyLegacyGroupCommand(input: StoryData, command: Exclude<NonBulkCommand, { kind: "delete-object" }>): { story: StoryData; diagnostics: StoryDiagnostic[] } {
  const current = legacyStoryGroups(input); const diagnostics: StoryDiagnostic[] = [];
  if (command.kind === "add") {
    const group = asLegacyGroup(command.item);
    if (!group) return { story: input, diagnostics: [diagnostic("invalid", "A legacy object group must contain memberRefs, entryIds, and metadata.")] };
    if (current.some(({ id }) => id === group.id)) return { story: input, diagnostics: [diagnostic("duplicate", `An item with id ${group.id} already exists.`, undefined, [group.id])] };
    return { story: replaceLegacyStoryGroups(input, [...current, clone(group)]), diagnostics };
  }
  if (command.kind === "remove") {
    if (!current.some(({ id }) => id === command.id)) return { story: input, diagnostics: [diagnostic("not-found", `No groups item ${command.id} exists.`, undefined, [command.id])] };
    return { story: replaceLegacyStoryGroups(input, current.filter(({ id }) => id !== command.id)), diagnostics };
  }
  const groups = command.items.flatMap((item) => { const group = asLegacyGroup(item); return group ? [clone(group)] : []; });
  if (groups.length !== command.items.length) return { story: input, diagnostics: [diagnostic("invalid", "A legacy object group must contain memberRefs, entryIds, and metadata.")] };
  return { story: replaceLegacyStoryGroups(input, groups), diagnostics };
}

function applyBulkMetadata(input: StoryData, command: StoryMetadataBulkCommand) {
  const story = clone(input); const diagnostics: StoryDiagnostic[] = [];
  for (const ref of command.refs) {
    let object = story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref));
    if (!object && command.action === "add") { object = { ref, metadata: {} }; story.objects.push(object); diagnostics.push(diagnostic("seeded-reference", `Created sparse narrative metadata for ${storyRefKey(ref)}.`, [ref])); }
    if (!object) diagnostics.push(diagnostic("not-found", `Story object ${storyRefKey(ref)} does not exist.`, [ref]));
    else object.metadata = mergeStoryMetadata(object.metadata, command.metadata, command.action);
  }
  const parsed = storyDataSchema.safeParse(story); return parsed.success ? { story: parsed.data, diagnostics } : { story: input, diagnostics: [diagnostic("invalid", parsed.error.issues[0]?.message ?? "Invalid metadata command.")] };
}

export function applyStoryCommand(input: StoryData, command: StoryCommand): StoryCommandResult {
  const source = migrateStoryData(input); let result = { story: source, diagnostics: [] as StoryDiagnostic[] };
  if (command.kind === "bulk-metadata") { const next = applyBulkMetadata(source, command); return { story: next.story, changed: next.diagnostics.every(({ code }) => code !== "invalid" && code !== "not-found") && JSON.stringify(source) !== JSON.stringify(next.story), diagnostics: next.diagnostics }; }
  const commands = command.kind === "bulk" ? command.commands : [command];
  for (const operation of commands) {
    const next = applyOne(result.story, operation);
    if (next.diagnostics.some(({ code }) => code === "duplicate" || code === "invalid" || code === "not-found" || code === "blocked")) return { story: source, changed: false, diagnostics: next.diagnostics };
    result = { story: next.story, diagnostics: [...result.diagnostics, ...next.diagnostics] };
  }
  return { story: result.story, changed: JSON.stringify(source) !== JSON.stringify(result.story), diagnostics: result.diagnostics };
}
