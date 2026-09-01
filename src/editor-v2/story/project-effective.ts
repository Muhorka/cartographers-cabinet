import type { EditorProject } from "../model/project-model";
import { effectiveStoryMetadata, effectiveStoryObject, storyAccessForMetadata, type StoryAccessResult } from "./effective";
import { migrateStoryData } from "./migration";
import { canonicalProjectStoryRef, resolveStoryObject, zoneMatchesProject } from "./project-adapter";
import { resolveStoryOwnership } from "./ownership";
import { defaultStoryAccessPolicy, sameStoryRef, storyRefKey, type StoryAccessPolicy, type StoryData, type StoryLensExpression, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyValue, type StoryRelation, type StoryViewContext, type StoryZone } from "./types";

/** Returns migrated narrative data and normalizes resolvable legacy room scopes. */
export function projectStoryData(project: EditorProject): StoryData {
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
  return { ...migrated, objects, zones, scenarios, lenses, relations, intentions, evidence };
}

function canonicalLensExpression(project: EditorProject, expression: StoryLensExpression): StoryLensExpression {
  if (expression.kind === "predicate") return expression.predicate.kind === "object" ? { ...expression, predicate: { ...expression.predicate, ref: canonicalProjectStoryRef(project, expression.predicate.ref) } } : expression;
  if (expression.kind === "not") return { ...expression, item: canonicalLensExpression(project, expression.item) };
  return { ...expression, items: expression.items.map((item) => canonicalLensExpression(project, item)) };
}

function joinAccess(first: StoryAccessPolicy, second: StoryAccessPolicy): StoryAccessPolicy {
  const lock = first.lock === "sealed" || second.lock === "sealed" ? "sealed" : first.lock === "locked" || second.lock === "locked" ? "locked" : "none";
  return { ...defaultStoryAccessPolicy(), ...first, ...second, allow: [...new Set([...first.allow, ...second.allow])], deny: [...new Set([...first.deny, ...second.deny])], keyIds: [...new Set([...first.keyIds, ...second.keyIds])], guardIds: [...new Set([...first.guardIds, ...second.guardIds])], secretKnowledge: [...new Set([...first.secretKnowledge, ...second.secretKnowledge])], permission: first.permission === "restricted" || second.permission === "restricted" ? "restricted" : "open", physicalState: first.physicalState === "closed" || second.physicalState === "closed" ? "closed" : "open", lock };
}

/** Zone membership is always resolved against project geometry and canonical refs. */
export function projectZonesForRef(project: EditorProject, story: StoryData, ref: StoryObjectRef): StoryZone[] {
  const canonical = canonicalProjectStoryRef(project, ref);
  return story.zones.filter(({ id }) => zoneMatchesProject(project, story, id, canonical).matches);
}

function zonePropertySources(project: EditorProject, story: StoryData, ref: StoryObjectRef) {
  const sources = new Map<string, string[]>();
  for (const zone of projectZonesForRef(project, story, ref)) for (const propertyId of Object.keys(zone.metadata?.properties ?? {})) sources.set(propertyId, [...(sources.get(propertyId) ?? []), zone.id]);
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
function parentStoryMetadata(project: EditorProject, story: StoryData, resolved: ReturnType<typeof resolveStoryObject> extends infer R ? Exclude<R, undefined> : never, context: StoryViewContext): StoryObjectMetadata {
  const chain = parentPlaces(project, resolved);
  let metadata: StoryObjectMetadata = {};
  // Apply the outer container first: the nearest parent then wins scalar values.
  for (const parent of [...chain].reverse()) {
    const parentRef: StoryObjectRef = { kind: "place", id: parent.id };
    const hasRecord = story.objects.some(({ ref }) => sameStoryRef(ref, parentRef));
    const parentStory = hasRecord ? story : { ...story, objects: [...story.objects, { ref: parentRef, metadata: {} }] };
    const inherited = effectiveStoryObject(parentStory, parentRef, context, { applicableZones: projectZonesForRef(project, story, parentRef) })?.metadata ?? effectiveStoryMetadata(parentStory, parentRef, { applicableZones: projectZonesForRef(project, story, parentRef) }).metadata;
    metadata = { ...metadata, tags: [...new Set([...(metadata.tags ?? []), ...(inherited.tags ?? [])])], properties: { ...(metadata.properties ?? {}), ...(inherited.properties ?? {}) }, access: joinAccess(metadata.access ?? defaultStoryAccessPolicy(), inherited.access ?? defaultStoryAccessPolicy()) };
  }
  return metadata;
}

type PropertyEvidence = { propertyId: string; value: StoryPropertyValue; source: string; patchIds?: string[]; conflict?: boolean };
function parentPropertyEvidence(project: EditorProject, story: StoryData, resolved: ReturnType<typeof resolveStoryObject> extends infer R ? Exclude<R, undefined> : never, context: StoryViewContext) {
  const entries = new Map<string, PropertyEvidence>(); const conflicts: string[] = [];
  for (const parent of [...parentPlaces(project, resolved)].reverse()) {
    const ref: StoryObjectRef = { kind: "place", id: parent.id }; const hasRecord = story.objects.some(({ ref: candidate }) => sameStoryRef(candidate, ref));
    const parentStory = hasRecord ? story : { ...story, objects: [...story.objects, { ref, metadata: {} }] };
    const effective = effectiveStoryObject(parentStory, ref, context, { applicableZones: projectZonesForRef(project, story, ref) });
    const zoneSources = zonePropertySources(project, story, ref);
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
function childPropertyEvidence(project: EditorProject, story: StoryData, ref: StoryObjectRef, effective: ReturnType<typeof effectiveStoryObject>, nativeProperties: Record<string, StoryPropertyValue>) {
  const entries = new Map<string, PropertyEvidence>(); if (!effective) return entries;
  const local = story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref))?.metadata.properties ?? {};
  const zoneSources = zonePropertySources(project, story, ref);
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
export function effectiveProjectStoryObject(project: EditorProject, ref: StoryObjectRef, context: StoryViewContext = {}) {
  const story = projectStoryData(project); const resolved = resolveStoryObject(project, story, ref); if (!resolved) return undefined;
  const narrative = story.objects.find(({ ref: candidate }) => candidate.kind === resolved.ref.kind && candidate.id === resolved.ref.id && candidate.scopeId === resolved.ref.scopeId);
  const nativeProperties = resolved.legacyMetadata.properties ?? {};
  const ownMetadata = { ...narrative?.metadata, properties: { ...nativeProperties, ...narrative?.metadata.properties } };
  const transient: StoryData = { ...story, objects: [...story.objects.filter((object) => !sameStoryRef(object.ref, resolved.ref)), { ref: resolved.ref, metadata: ownMetadata }] };
  const zones = projectZonesForRef(project, story, resolved.ref);
  const native = nativeMetadata(project, resolved); const parents = parentStoryMetadata(project, story, resolved, context);
  const effective = effectiveStoryObject(transient, resolved.ref, context, { applicableZones: zones, contributors: [{ kind: "native", id: `native:${resolved.ref.kind}:${resolved.ref.id}`, metadata: native }, { kind: "parent", id: `parent:${resolved.ownerPlaceId ?? "root"}`, metadata: parents }] });
  const ownership = resolveStoryOwnership(project, story, resolved.ref, context);
  const metadata: StoryObjectMetadata = { ...(effective?.metadata ?? {}), owners: ownership.effectiveOwners };
  const hasScenarioText = Boolean(effective?.view.scenario && effective?.view.patches.some(({ target, title, description: text }) => sameStoryRef(target, resolved.ref) && (title !== undefined || text !== undefined)));
  const hasNativeText = ["wall", "opening", "transition"].includes(resolved.ref.kind);
  const propertyEvidence = nativePropertyEvidence(project, resolved); const parentEvidence = parentPropertyEvidence(project, story, resolved, context); for (const [propertyId, item] of parentEvidence.entries) propertyEvidence.set(propertyId, item);
  for (const [propertyId, item] of childPropertyEvidence(project, story, resolved.ref, effective, nativeProperties)) propertyEvidence.set(propertyId, item);
  for (const propertyId of propertyEvidence.keys()) if (!Object.hasOwn(metadata.properties ?? {}, propertyId)) propertyEvidence.delete(propertyId);
  for (const [propertyId, value] of Object.entries(metadata.properties ?? {})) propertyEvidence.set(propertyId, { ...(propertyEvidence.get(propertyId) ?? { propertyId, source: "effective" }), value });
  return { ...resolved, name: hasScenarioText || hasNativeText ? effective?.label ?? resolved.name : resolved.name, description: hasScenarioText || hasNativeText ? effective?.description ?? resolved.description : resolved.description, metadata, storyView: effective?.view, effectiveProperties: [...propertyEvidence.values()], conflicts: [...new Set([...(effective?.conflicts ?? []), ...parentEvidence.conflicts])] };
}

/** Access decision hydrated with native object and parent-place metadata. */
export function projectStoryAccess(project: EditorProject, ref: StoryObjectRef, actorId?: string, context: StoryViewContext = {}): StoryAccessResult {
  const object = effectiveProjectStoryObject(project, ref, context);
  return object ? storyAccessForMetadata(projectStoryData(project), object.metadata, actorId) : { allowed: false, physicalOpen: false, reason: "object-not-found", unknown: true };
}
