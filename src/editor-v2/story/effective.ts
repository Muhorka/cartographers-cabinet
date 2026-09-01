import { defaultStoryAccessPolicy, sameStoryRef, type StoryAccessPolicy, type StoryData, type StoryObject, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyValue, type StoryScenario, type StoryTextPatch, type StoryViewContext, type StoryZone } from "./types";
import { migrateStoryData } from "./migration";

type StoryView = { scenario?: StoryScenario; stepId?: string; patches: StoryTextPatch[] };
function storyView(story: StoryData, context: StoryViewContext = {}): StoryView {
  const scenario = context.scenarioId ? story.scenarios.find(({ id }) => id === context.scenarioId) : undefined;
  const step = scenario && context.stepId ? scenario.steps.find(({ id }) => id === context.stepId) : undefined;
  return { scenario, stepId: step?.id, patches: [...(scenario?.patches ?? []), ...(step?.patches ?? [])] };
}

function equalValue(first: StoryPropertyValue | undefined, second: StoryPropertyValue) { return JSON.stringify(first) === JSON.stringify(second); }
function patchFor(patches: StoryTextPatch[], ref: StoryObjectRef) { return patches.filter(({ target }) => sameStoryRef(target, ref)); }
type EffectiveProperty = { propertyId: string; value: StoryPropertyValue; source: "base" | "scenario" | "step"; patchIds: string[]; conflict: boolean };
type EffectiveStoryObject = StoryObject & { label?: string; description?: string; effectiveProperties: EffectiveProperty[]; view: StoryView; conflicts: string[] };
type CompleteMetadata = { narrativeLabel?: string; narrativeDescription?: string; owners: string[]; access: ReturnType<typeof defaultStoryAccessPolicy>; tags: string[]; properties: Record<string, StoryPropertyValue> };
type StoryMetadataContributor = { kind: "zone" | "native" | "parent"; id: string; metadata: StoryObjectMetadata };
export type EffectiveStoryOptions = { applicableZones?: readonly StoryZone[]; contributors?: readonly StoryMetadataContributor[] };

function mergeAccess(first: ReturnType<typeof defaultStoryAccessPolicy>, second: ReturnType<typeof defaultStoryAccessPolicy>) {
  const permission: StoryAccessPolicy["permission"] = first.permission === "nobody" || second.permission === "nobody" ? "nobody" : first.permission === "restricted" || second.permission === "restricted" ? "restricted" : "open";
  const physicalState: StoryAccessPolicy["physicalState"] = first.physicalState === "closed" || second.physicalState === "closed" ? "closed" : "open";
  const lock: StoryAccessPolicy["lock"] = first.lock === "sealed" || second.lock === "sealed" ? "sealed" : first.lock === "locked" || second.lock === "locked" ? "locked" : "none";
  return {
    ...first,
    ...second,
    allow: [...new Set([...first.allow, ...second.allow])],
    deny: [...new Set([...first.deny, ...second.deny])],
    keyIds: [...new Set([...first.keyIds, ...second.keyIds])],
    guardIds: [...new Set([...first.guardIds, ...second.guardIds])],
    secretKnowledge: [...new Set([...first.secretKnowledge, ...second.secretKnowledge])],
    permission,
    physicalState,
    lock,
    hidden: Boolean(first.hidden || second.hidden),
    knownBy: [...new Set([...(first.knownBy ?? []), ...(second.knownBy ?? [])])],
  };
}

function mergeMetadata(contributors: readonly StoryMetadataContributor[], local?: StoryObjectMetadata): { metadata: StoryObjectMetadata; conflicts: string[] } {
  const conflicts = new Set<string>(); const zoneProperties = new Map<string, StoryPropertyValue>(); const inherited: CompleteMetadata = { owners: [], access: defaultStoryAccessPolicy(), tags: [], properties: {} };
  for (const contributor of contributors) {
    const metadata = contributor.metadata;
    inherited.owners = [...new Set([...inherited.owners, ...(metadata.owners ?? [])])]; inherited.tags = [...new Set([...inherited.tags, ...(metadata.tags ?? [])])];
    for (const [key, value] of Object.entries(metadata.properties ?? {})) {
      if (contributor.kind === "zone") {
        const conflictId = `zone:${key}`;
        if (conflicts.has(conflictId)) continue;
        if (zoneProperties.has(key) && !equalValue(zoneProperties.get(key), value)) {
          conflicts.add(conflictId); delete inherited.properties[key]; continue;
        }
        zoneProperties.set(key, value);
      }
      inherited.properties[key] = value;
    }
    if (metadata.access) inherited.access = mergeAccess(inherited.access, { ...defaultStoryAccessPolicy(), ...metadata.access });
  }
  if (!local) return { metadata: inherited, conflicts: [...conflicts] };
  const localProperties = local.properties ?? {};
  for (const key of Object.keys(localProperties)) { inherited.properties[key] = localProperties[key]!; conflicts.delete(`zone:${key}`); }
  return { metadata: { ...inherited, ...local, owners: local.owners ?? inherited.owners, access: local.access ?? inherited.access, tags: local.tags ? [...new Set([...inherited.tags, ...local.tags])] : inherited.tags, properties: inherited.properties }, conflicts: [...conflicts] };
}

export function effectiveStoryMetadata(input: StoryData, ref: StoryObjectRef, options: EffectiveStoryOptions = {}): { metadata: StoryObjectMetadata; conflicts: string[] } {
  const story = migrateStoryData(input);
  const applicableZones = options.applicableZones ?? story.zones.filter(({ members }) => members.some((member) => sameStoryRef(member.ref, ref)));
  const zones: StoryMetadataContributor[] = applicableZones.flatMap(({ id, metadata }) => metadata ? [{ kind: "zone" as const, id, metadata }] : []);
  const contributors = [...(options.contributors ?? []), ...zones];
  const local = story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref))?.metadata;
  return mergeMetadata(contributors, local);
}

export function effectiveStoryObject(input: StoryData, ref: StoryObjectRef, context: StoryViewContext = {}, options: EffectiveStoryOptions = {}): EffectiveStoryObject | undefined {
  const story = migrateStoryData(input);
  const original = story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref)); if (!original) return undefined;
  const inherited = effectiveStoryMetadata(story, ref, options); const view = storyView(story, context); const scenarioPatches = view.scenario ? patchFor(view.scenario.patches ?? [], ref) : [];
  const step = view.stepId ? view.scenario?.steps.find(({ id }) => id === view.stepId) : undefined; const stepPatches = step ? patchFor(step.patches, ref) : [];
  const conflicts = new Set(inherited.conflicts);
  const entries = new Map<string, EffectiveProperty>(); for (const [propertyId, value] of Object.entries(inherited.metadata.properties ?? {})) entries.set(propertyId, { propertyId, value, source: "base", patchIds: [], conflict: false });
  const apply = (patches: StoryTextPatch[], source: "scenario" | "step") => { for (const patch of patches) for (const [propertyId, value] of Object.entries(patch.properties ?? {})) { const prior = entries.get(propertyId); const conflict = Boolean(prior && prior.source === source && !equalValue(prior.value, value)); conflicts.delete(`zone:${propertyId}`); entries.set(propertyId, { propertyId, value, source, patchIds: [...(prior?.patchIds ?? []), patch.id], conflict }); } };
  apply(scenarioPatches, "scenario"); apply(stepPatches, "step");
  let currentMetadata = inherited.metadata; for (const patch of [...scenarioPatches, ...stepPatches]) if (patch.metadata) currentMetadata = { ...currentMetadata, ...patch.metadata, access: patch.metadata.access ?? currentMetadata.access };
  const textPatches = [...scenarioPatches, ...stepPatches]; const label = [...textPatches].reverse().find(({ title }) => title !== undefined)?.title ?? currentMetadata.narrativeLabel; const description = [...textPatches].reverse().find(({ description: value }) => value !== undefined)?.description ?? currentMetadata.narrativeDescription;
  return { ...original, metadata: { ...currentMetadata, properties: Object.fromEntries([...entries].map(([key, value]) => [key, value.value])) }, label, description, effectiveProperties: [...entries.values()], view, conflicts: [...conflicts] };
}

/** Identity closure used by access policy, ownership, and possession checks. */
export function storyActorGroups(story: StoryData, actorId: string) {
  const groups = new Set<string>([actorId]); let changed = true;
  while (changed) { changed = false; for (const membership of story.memberships) if (membership.kind === "member-of" && groups.has(membership.subjectId) && !groups.has(membership.groupId)) { groups.add(membership.groupId); changed = true; } }
  return groups;
}
export type StoryAccessResult = { allowed: boolean; physicalOpen: boolean; reason: string; unknown?: boolean };
export function storyAccessForMetadata(story: StoryData, metadata: StoryObjectMetadata, actorId?: string): StoryAccessResult {
  const access = { ...defaultStoryAccessPolicy(), ...(metadata.access ?? {}) }; const groups = actorId ? storyActorGroups(story, actorId) : new Set<string>();
  if (access.permission === "nobody") return { allowed: false, physicalOpen: access.physicalState === "open", reason: "nobody" };
  if (access.deny.some((id) => groups.has(id))) return { allowed: false, physicalOpen: access.physicalState === "open", reason: "explicit-deny" };
  if (actorId && access.hidden && !(access.knownBy ?? []).some((id) => groups.has(id))) return { allowed: false, physicalOpen: access.physicalState === "open", reason: "hidden", unknown: true };
  if ((metadata.owners ?? []).some((id) => groups.has(id))) return { allowed: true, physicalOpen: access.physicalState === "open", reason: "owner" };
  const permission = access.permission === "open" || access.allow.some((id) => groups.has(id));
  if (!actorId && access.permission === "restricted") return { allowed: false, physicalOpen: access.physicalState === "open", reason: "actor-required", unknown: true };
  return { allowed: permission, physicalOpen: access.physicalState === "open", reason: permission ? "allowed" : "not-allowed" };
}
