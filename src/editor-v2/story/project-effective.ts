import type { EditorProject } from "../model/project-model";
import { effectiveCanonicalStoryMetadata, effectiveCanonicalStoryObject, effectiveStoryObject, storyAccessForMetadata, type StoryAccessResult } from "./effective";
import { migrateStoryData } from "./migration";
import { allStoryObjectRefs, canonicalProjectStoryRef, resolveStoryObject, zoneMatchesProject } from "./project-adapter";
import { resolveStoryOwnership } from "./ownership";
import { defaultStoryAccessPolicy, sameStoryRef, storyRefKey, type StoryAccessPolicy, type StoryData, type StoryLensExpression, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyValue, type StoryRelation, type StoryViewContext, type StoryZone } from "./types";
import { immutableSnapshot, isImmutableSnapshot } from "../state/immutable-snapshot";

const projectStoryDataCache = new WeakMap<EditorProject, StoryData>();

/** Returns migrated narrative data and normalizes resolvable legacy room scopes. */
export function projectStoryData(project: EditorProject): StoryData {
  const cacheable = isImmutableSnapshot(project);
  if (cacheable) {
    const cached = projectStoryDataCache.get(project);
    if (cached) return cached;
  }
  const migrated = migrateStoryData(project.story); const seen = new Set<string>();
  const canonical = (ref: StoryObjectRef) => canonicalProjectStoryRef(project, ref);
  const objects = migrated.objects.map((object) => { const resolved = resolveStoryObject(project, migrated, object.ref); const candidate = resolved?.ref ?? canonical(object.ref); if (seen.has(storyRefKey(candidate))) return { ...object, ref: candidate }; seen.add(storyRefKey(candidate)); return { ...object, ref: candidate }; });
  const zones = migrated.zones.map((zone) => ({ ...zone, members: zone.members.map((member) => ({ ...member, ref: canonical(member.ref) })) }));
  const scenarios = migrated.scenarios.map((scenario) => ({
    ...scenario,
    patches: scenario.patches.map((patch) => ({ ...patch, target: canonical(patch.target) })),
    steps: scenario.steps.map((step) => ({ ...step, patches: step.patches.map((patch) => ({ ...patch, target: canonical(patch.target) })) })),
  }));
  const lenses = migrated.lenses.map((lens) => ({ ...lens, expression: canonicalLensExpression(project, lens.expression) }));
  const endpoint = (value: StoryRelation["from"]) => "kind" in value ? canonical(value) : value;
  const relations = migrated.relations.map((relation) => ({ ...relation, from: endpoint(relation.from), to: endpoint(relation.to) }));
  const intentions = migrated.intentions.map((intention) => ({ ...intention, subject: canonical(intention.subject), target: intention.target ? canonical(intention.target) : undefined, through: intention.through?.map(canonical) }));
  const evidence = migrated.evidence.map((item) => ({ ...item, refs: item.refs.map(canonical) }));
  const story = { ...migrated, objects, zones, scenarios, lenses, relations, intentions, evidence };
  if (!cacheable) return story;
  const immutable = immutableSnapshot(story);
  projectStoryDataCache.set(project, immutable);
  return immutable;
}

export function canonicalLensExpression(project: EditorProject, expression: StoryLensExpression): StoryLensExpression {
  if (expression.kind === "predicate") return expression.predicate.kind === "object" ? { ...expression, predicate: { ...expression.predicate, ref: canonicalProjectStoryRef(project, expression.predicate.ref) } } : expression;
  if (expression.kind === "not") return { ...expression, item: canonicalLensExpression(project, expression.item) };
  return { ...expression, items: expression.items.map((item) => canonicalLensExpression(project, item)) };
}

function joinAccess(first: StoryAccessPolicy, second: StoryAccessPolicy): StoryAccessPolicy {
  const lock = first.lock === "sealed" || second.lock === "sealed" ? "sealed" : first.lock === "locked" || second.lock === "locked" ? "locked" : "none";
  const permission: StoryAccessPolicy["permission"] = first.permission === "nobody" || second.permission === "nobody" ? "nobody" : first.permission === "restricted" || second.permission === "restricted" ? "restricted" : "open";
  const knownBy = first.knownBy === undefined && second.knownBy === undefined ? undefined : [...new Set([...(first.knownBy ?? []), ...(second.knownBy ?? [])])];
  return { ...defaultStoryAccessPolicy(), ...first, ...second, allow: [...new Set([...first.allow, ...second.allow])], deny: [...new Set([...first.deny, ...second.deny])], keyIds: [...new Set([...first.keyIds, ...second.keyIds])], guardIds: [...new Set([...first.guardIds, ...second.guardIds])], secretKnowledge: [...new Set([...first.secretKnowledge, ...second.secretKnowledge])], permission, physicalState: first.physicalState === "closed" || second.physicalState === "closed" ? "closed" : "open", lock, hidden: Boolean(first.hidden || second.hidden), ...(knownBy === undefined ? {} : { knownBy }) };
}

/** Zone membership is always resolved against project geometry and canonical refs. */
export function projectZonesForRef(project: EditorProject, story: StoryData, ref: StoryObjectRef, knownRefs?: readonly StoryObjectRef[]): StoryZone[] {
  const canonical = canonicalProjectStoryRef(project, ref, knownRefs);
  return story.zones.filter(({ id }) => zoneMatchesProject(project, story, id, canonical, knownRefs).matches);
}

type ProjectZonesResolver = (ref: StoryObjectRef) => StoryZone[];

function zonePropertySources(ref: StoryObjectRef, zonesForRef: ProjectZonesResolver) {
  const sources = new Map<string, string[]>();
  for (const zone of zonesForRef(ref)) for (const propertyId of Object.keys(zone.metadata?.properties ?? {})) sources.set(propertyId, [...(sources.get(propertyId) ?? []), zone.id]);
  return sources;
}

/** Native access/tags/property values inherit through the editor place hierarchy. */
function nativeMetadata(project: EditorProject, resolved: ReturnType<typeof resolveStoryObject> extends infer R ? Exclude<R, undefined> : never): StoryObjectMetadata {
  const chain: EditorProject["places"] = []; const seen = new Set<string>(); let id = resolved.ownerPlaceId;
  while (id && !seen.has(id)) { seen.add(id); const place = project.places.find(({ id: candidate }) => candidate === id); if (!place) break; chain.unshift(place); id = place.parentId; }
  let metadata: StoryObjectMetadata = {};
  for (const place of chain) metadata = { ...metadata, tags: [...new Set([...(metadata.tags ?? []), ...place.tags])], properties: { ...(metadata.properties ?? {}), ...place.properties }, access: joinAccess(metadata.access ?? defaultStoryAccessPolicy(), place.access.length ? { ...defaultStoryAccessPolicy(), permission: "restricted", allow: [...place.access] } : defaultStoryAccessPolicy()) };
  metadata = { ...metadata, ...resolved.legacyMetadata, tags: [...new Set([...(metadata.tags ?? []), ...(resolved.legacyMetadata.tags ?? [])])], properties: { ...(metadata.properties ?? {}), ...(resolved.legacyMetadata.properties ?? {}) }, access: joinAccess(metadata.access ?? defaultStoryAccessPolicy(), resolved.legacyMetadata.access ?? defaultStoryAccessPolicy()) };
  return metadata;
}
function parentPlaces(project: EditorProject, resolved: ReturnType<typeof resolveStoryObject> extends infer R ? Exclude<R, undefined> : never) {
  const chain: EditorProject["places"] = []; const seen = new Set<string>(); let id = resolved.ownerPlaceId;
  while (id && !seen.has(id)) {
    seen.add(id); const parent = project.places.find(({ id: candidate }) => candidate === id); if (!parent) break;
    chain.push(parent); id = parent.parentId;
  }
  return chain;
}
function parentStoryMetadata(project: EditorProject, story: StoryData, resolved: ReturnType<typeof resolveStoryObject> extends infer R ? Exclude<R, undefined> : never, context: StoryViewContext, zonesForRef: ProjectZonesResolver): StoryObjectMetadata {
  const chain = parentPlaces(project, resolved);
  let metadata: StoryObjectMetadata = {};
  // Apply the outer container first: the nearest parent then wins scalar values.
  for (const parent of [...chain].reverse()) {
    const parentRef: StoryObjectRef = { kind: "place", id: parent.id };
    const hasRecord = story.objects.some(({ ref }) => sameStoryRef(ref, parentRef));
    const parentStory = hasRecord ? story : { ...story, objects: [...story.objects, { ref: parentRef, metadata: {} }] };
    const parentObject = parentStory.objects.find(({ ref }) => sameStoryRef(ref, parentRef));
    const zones = zonesForRef(parentRef);
    const inherited = parentObject
      ? effectiveCanonicalStoryObject(parentStory, parentObject, context, { applicableZones: zones }).metadata
      : effectiveCanonicalStoryMetadata(parentStory, parentRef, { applicableZones: zones }).metadata;
    metadata = { ...metadata, tags: [...new Set([...(metadata.tags ?? []), ...(inherited.tags ?? [])])], properties: { ...(metadata.properties ?? {}), ...(inherited.properties ?? {}) }, access: joinAccess(metadata.access ?? defaultStoryAccessPolicy(), inherited.access ?? defaultStoryAccessPolicy()) };
  }
  return metadata;
}

type PropertyEvidence = { propertyId: string; value: StoryPropertyValue; source: string; patchIds?: string[]; conflict?: boolean };
function parentPropertyEvidence(project: EditorProject, story: StoryData, resolved: ReturnType<typeof resolveStoryObject> extends infer R ? Exclude<R, undefined> : never, context: StoryViewContext, zonesForRef: ProjectZonesResolver) {
  const entries = new Map<string, PropertyEvidence>(); const conflicts: string[] = [];
  for (const parent of [...parentPlaces(project, resolved)].reverse()) {
    const ref: StoryObjectRef = { kind: "place", id: parent.id }; const hasRecord = story.objects.some(({ ref: candidate }) => sameStoryRef(candidate, ref));
    const parentStory = hasRecord ? story : { ...story, objects: [...story.objects, { ref, metadata: {} }] };
    const parentObject = parentStory.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref));
    const effective = parentObject ? effectiveCanonicalStoryObject(parentStory, parentObject, context, { applicableZones: zonesForRef(ref) }) : undefined;
    const zoneSources = zonePropertySources(ref, zonesForRef);
    for (const item of effective?.effectiveProperties ?? []) {
      const previous = entries.get(item.propertyId); const conflict = Boolean(previous && JSON.stringify(previous.value) !== JSON.stringify(item.value));
      if (conflict) conflicts.push(`parent:${item.propertyId}`);
      const zoneIds = item.source === "base" ? zoneSources.get(item.propertyId) : undefined;
      const source = zoneIds?.length ? `parent:${parent.id}:zone:${zoneIds.join(",")}` : `parent:${parent.id}:${item.source}`;
      entries.set(item.propertyId, { ...item, source, conflict: Boolean(item.conflict || conflict) });
    }
  }
  return { entries, conflicts };
}
function childPropertyEvidence(story: StoryData, ref: StoryObjectRef, effective: ReturnType<typeof effectiveStoryObject>, nativeProperties: Record<string, StoryPropertyValue>, zonesForRef: ProjectZonesResolver) {
  const entries = new Map<string, PropertyEvidence>(); if (!effective) return entries;
  const local = story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref))?.metadata.properties ?? {};
  const zoneSources = zonePropertySources(ref, zonesForRef);
  for (const item of effective.effectiveProperties) {
    let source: string = item.source;
    if (item.source === "base") {
      if (item.propertyId in local) source = "local";
      else if (item.propertyId in nativeProperties) source = `native:${ref.kind}:${ref.id}`;
      else { const zoneIds = zoneSources.get(item.propertyId) ?? []; if (!zoneIds.length) continue; source = `zone:${zoneIds.join(",")}`; }
    }
    entries.set(item.propertyId, { ...item, source });
  }
  return entries;
}
function nativePropertyEvidence(project: EditorProject, resolved: ReturnType<typeof resolveStoryObject> extends infer R ? Exclude<R, undefined> : never) {
  const entries = new Map<string, PropertyEvidence>();
  for (const place of [...parentPlaces(project, resolved)].reverse()) for (const [propertyId, value] of Object.entries(place.properties)) entries.set(propertyId, { propertyId, value, source: `native:${place.id}` });
  for (const [propertyId, value] of Object.entries(resolved.legacyMetadata.properties ?? {})) entries.set(propertyId, { propertyId, value, source: `native:${resolved.ref.kind}:${resolved.ref.id}` });
  return entries;
}

/** Hydrates one map object for UI/routes: native source text/flags plus effective story metadata. */
function effectiveProjectStoryObjectFromCanonicalStory(project: EditorProject, story: StoryData, ref: StoryObjectRef, context: StoryViewContext = {}, zonesForRef: ProjectZonesResolver = (target) => projectZonesForRef(project, story, target, knownRefs), knownRefs?: readonly StoryObjectRef[]) {
  const resolved = resolveStoryObject(project, story, ref, knownRefs); if (!resolved) return undefined;
  const narrative = story.objects.find(({ ref: candidate }) => candidate.kind === resolved.ref.kind && candidate.id === resolved.ref.id && candidate.scopeId === resolved.ref.scopeId);
  const nativeProperties = resolved.legacyMetadata.properties ?? {};
  const ownMetadata = { ...narrative?.metadata, properties: { ...nativeProperties, ...narrative?.metadata.properties } };
  const zones = zonesForRef(resolved.ref);
  const native = nativeMetadata(project, resolved); const parents = parentStoryMetadata(project, story, resolved, context, zonesForRef);
  const effective = effectiveCanonicalStoryObject(story, { ref: resolved.ref, metadata: ownMetadata }, context, { applicableZones: zones, contributors: [{ kind: "native", id: `native:${resolved.ref.kind}:${resolved.ref.id}`, metadata: native }, { kind: "parent", id: `parent:${resolved.ownerPlaceId ?? "root"}`, metadata: parents }] });
  const ownership = resolveStoryOwnership(project, story, resolved.ref, context);
  const metadata: StoryObjectMetadata = { ...effective.metadata, owners: ownership.effectiveOwners };
  const hasScenarioText = Boolean(effective?.view.scenario && effective?.view.patches.some(({ target, title, description: text }) => sameStoryRef(target, resolved.ref) && (title !== undefined || text !== undefined)));
  const hasNativeText = ["wall", "opening", "transition"].includes(resolved.ref.kind);
  const propertyEvidence = nativePropertyEvidence(project, resolved); const parentEvidence = parentPropertyEvidence(project, story, resolved, context, zonesForRef); for (const [propertyId, item] of parentEvidence.entries) propertyEvidence.set(propertyId, item);
  for (const [propertyId, item] of childPropertyEvidence(story, resolved.ref, effective, nativeProperties, zonesForRef)) propertyEvidence.set(propertyId, item);
  for (const propertyId of propertyEvidence.keys()) if (!Object.hasOwn(metadata.properties ?? {}, propertyId)) propertyEvidence.delete(propertyId);
  for (const [propertyId, value] of Object.entries(metadata.properties ?? {})) propertyEvidence.set(propertyId, { ...(propertyEvidence.get(propertyId) ?? { propertyId, source: "effective" }), value });
  return { ...resolved, name: hasScenarioText || hasNativeText ? effective?.label ?? resolved.name : resolved.name, description: hasScenarioText || hasNativeText ? effective?.description ?? resolved.description : resolved.description, metadata, storyView: effective?.view, effectiveProperties: [...propertyEvidence.values()], conflicts: [...new Set([...(effective?.conflicts ?? []), ...parentEvidence.conflicts])] };
}

export function effectiveProjectStoryObject(project: EditorProject, ref: StoryObjectRef, context: StoryViewContext = {}) {
  return effectiveProjectStoryObjectFromCanonicalStory(project, projectStoryData(project), ref, context);
}

/** One canonical story migration and one result per scoped ref for a single read batch. */
export function createProjectStoryObjectResolver(project: EditorProject, context: StoryViewContext = {}, canonicalStory?: StoryData) {
  const story = canonicalStory ?? projectStoryData(project);
  const refs = allStoryObjectRefs(project);
  const resolved = new Map<string, ReturnType<typeof effectiveProjectStoryObjectFromCanonicalStory>>();
  const zones = new Map<string, StoryZone[]>();
  const zonesForRef = (ref: StoryObjectRef) => {
    const key = storyRefKey(ref);
    if (!zones.has(key)) zones.set(key, projectZonesForRef(project, story, ref, refs));
    return zones.get(key)!;
  };
  return (ref: StoryObjectRef) => {
    const key = storyRefKey(ref);
    if (!resolved.has(key)) resolved.set(key, effectiveProjectStoryObjectFromCanonicalStory(project, story, ref, context, zonesForRef, refs));
    return resolved.get(key);
  };
}

/** Access decision hydrated with native object and parent-place metadata. */
export function projectStoryAccess(project: EditorProject, ref: StoryObjectRef, actorId?: string, context: StoryViewContext = {}): StoryAccessResult {
  const object = effectiveProjectStoryObject(project, ref, context);
  return object ? storyAccessForMetadata(projectStoryData(project), object.metadata, actorId) : { allowed: false, physicalOpen: false, reason: "object-not-found", unknown: true };
}
