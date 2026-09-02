import { storyDataSchema, storyMetadataSchema, storyObjectRefSchema } from "./schema";
import { routeRecordSchema } from "./routes/schema";
import { defaultStoryAccessPolicy, emptyStoryData, storyRefKey, type StoryData, type StoryLensExpression, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyDefinition, type StoryWorldEntry, type StoryGroup, type StoryZone } from "./types";
import { immutableSnapshot, isImmutableSnapshot } from "../state/immutable-snapshot";

const migratedStorySnapshots = new WeakMap<object, StoryData>();

type LegacyRecord = { id: string; name: string; description?: string; [key: string]: unknown };
function records(value: unknown): LegacyRecord[] { return Array.isArray(value) ? value.filter((entry): entry is LegacyRecord => Boolean(entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string" && typeof (entry as { name?: unknown }).name === "string")) : []; }
function legacyWorld(input: Record<string, unknown>): StoryWorldEntry[] {
  const worldbook = input.worldbook && typeof input.worldbook === "object" ? input.worldbook as Record<string, unknown> : {};
  return (["characters", "factions", "accessGroups", "keys"] as const).flatMap((collection) => records(input[collection] ?? worldbook[collection]).map((entry) => ({ id: entry.id, kind: collection === "accessGroups" ? "access-group" : collection === "keys" ? "key" : collection === "characters" ? "character" : "faction", name: entry.name, description: entry.description, tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === "string") : [], properties: {} })));
}
function legacyPropertyDefinitions(input: Record<string, unknown>): StoryPropertyDefinition[] {
  return records(input.propertyDefinitions).map((entry) => ({ id: entry.id, name: entry.name, type: entry.type === "number" ? "number" : entry.type === "boolean" ? "boolean" : entry.type === "choice" ? "single" : "text", options: Array.isArray(entry.options) ? entry.options.filter((option): option is string => typeof option === "string") : [] }));
}

function stringList(value: unknown) { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []; }
function legacyRefs(value: unknown): StoryObjectRef[] { return Array.isArray(value) ? value.flatMap((entry) => { const parsed = storyObjectRefSchema.safeParse(entry); return parsed.success ? [parsed.data] : []; }) : []; }
function legacyMetadata(value: unknown): StoryObjectMetadata {
  const parsed = storyMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data as unknown as StoryObjectMetadata : { access: defaultStoryAccessPolicy(), tags: [], properties: {} };
}
function legacyZoneMembers(value: unknown): StoryZone["members"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>; const ref = legacyRefs([candidate.ref ?? entry])[0]; if (!ref) return [];
    const relation = ["inside", "overlaps", "touches", "near"].includes(String(candidate.relation)) ? candidate.relation as StoryZone["members"][number]["relation"] : "inside";
    return [{ ref, relation, partial: candidate.partial === true, ...(typeof candidate.note === "string" ? { note: candidate.note } : {}) }];
  });
}
function legacyGroupRecords(input: Record<string, unknown>): StoryGroup[] {
  return records(input.objectGroups ?? input.groups).map((entry) => ({ id: entry.id, name: entry.name, description: entry.description, memberRefs: legacyRefs(entry.memberRefs ?? entry.members), entryIds: stringList(entry.entryIds), metadata: legacyMetadata(entry.metadata) }));
}
function legacyZoneRecords(input: Record<string, unknown>): StoryZone[] {
  return records(input.zones).map((entry) => ({ id: entry.id, name: entry.name, description: entry.description, members: legacyZoneMembers(entry.members), tags: stringList(entry.tags), ...(entry.metadata === undefined ? {} : { metadata: legacyMetadata(entry.metadata) }), ...(typeof entry.ownerPlaceId === "string" ? { ownerPlaceId: entry.ownerPlaceId } : {}), ...(typeof entry.color === "string" ? { color: entry.color } : {}), ...(Array.isArray(entry.entryIds) ? { entryIds: stringList(entry.entryIds) } : {}), ...(typeof entry.legacyGroupId === "string" ? { legacyGroupId: entry.legacyGroupId } : {}) }));
}

function uniqueLegacyZoneId(groupId: string, used: Set<string>) {
  const base = `legacy-group:${groupId}`.slice(0, 512); let candidate = base; let suffix = 2;
  while (used.has(candidate)) { const marker = `:${suffix++}`; candidate = `${base.slice(0, 512 - marker.length)}${marker}`; }
  return candidate;
}
function compareIds(first: { id: string }, second: { id: string }) { return first.id < second.id ? -1 : first.id > second.id ? 1 : 0; }
function rewriteLegacyGroupLens(expression: StoryLensExpression, zoneIds: ReadonlyMap<string, string>): StoryLensExpression {
  if (expression.kind === "predicate") return expression.predicate.kind === "group" && zoneIds.has(expression.predicate.groupId) ? { ...expression, predicate: { kind: "zone", zoneId: zoneIds.get(expression.predicate.groupId)! } } : expression;
  if (expression.kind === "not") return { ...expression, item: rewriteLegacyGroupLens(expression.item, zoneIds) };
  return { ...expression, items: expression.items.map((item) => rewriteLegacyGroupLens(item, zoneIds)) };
}

/** Converts object groups to canonical zones without merging independent zones. */
export function normalizeStoryZones(story: StoryData): StoryData {
  if (!story.groups.length) return story;
  const zones = structuredClone(story.zones); const used = new Set(zones.map(({ id }) => id)); const zoneIds = new Map<string, string>();
  const groups = [...story.groups].sort(compareIds);
  for (const group of groups) {
    const imported = zones.filter(({ legacyGroupId }) => legacyGroupId === group.id).sort(compareIds)[0];
    if (imported) { zoneIds.set(group.id, imported.id); continue; }
    const id = used.has(group.id) ? uniqueLegacyZoneId(group.id, used) : group.id;
    used.add(id); zoneIds.set(group.id, id);
    zones.push({ id, name: group.name, ...(group.description === undefined ? {} : { description: group.description }), members: group.memberRefs.map((ref) => ({ ref: structuredClone(ref), relation: "inside", partial: false })), tags: [...(group.metadata.tags ?? [])], metadata: structuredClone(group.metadata), entryIds: [...group.entryIds], legacyGroupId: group.id });
  }
  return { ...story, groups: [], zones, lenses: story.lenses.map((lens) => ({ ...lens, expression: rewriteLegacyGroupLens(lens.expression, zoneIds) })) };
}

/** Legacy object-group view used by old catalogues and commands. */
export function legacyStoryGroups(story: StoryData): StoryGroup[] {
  return story.zones.filter(({ legacyGroupId }) => Boolean(legacyGroupId)).map((zone) => ({ id: zone.legacyGroupId!, name: zone.name, description: zone.description, memberRefs: zone.members.map(({ ref }) => structuredClone(ref)), entryIds: [...(zone.entryIds ?? [])], metadata: structuredClone(zone.metadata ?? {}) }));
}

function zoneFromLegacyGroup(group: StoryGroup, id: string, previous?: StoryZone): StoryZone {
  const previousMembers = new Map(previous?.members.map((member) => [storyRefKey(member.ref), member]));
  const members = group.memberRefs.map((ref) => {
    const retained = previousMembers.get(storyRefKey(ref));
    return retained ? { ...structuredClone(retained), ref: structuredClone(ref) } : { ref: structuredClone(ref), relation: "inside" as const, partial: false };
  });
  return {
    ...(previous ? structuredClone(previous) : {}), id, name: group.name,
    ...(group.description === undefined ? previous?.description === undefined ? {} : { description: previous.description } : { description: group.description }),
    members, tags: [...(previous?.tags ?? (group.metadata.tags ?? []))],
    metadata: structuredClone(group.metadata), entryIds: [...group.entryIds], legacyGroupId: group.id,
  };
}

/** Replaces only zones originating from legacy groups; independent zones stay intact. */
export function replaceLegacyStoryGroups(story: StoryData, groups: readonly StoryGroup[]): StoryData {
  const current = normalizeStoryZones(story); const independent = current.zones.filter(({ legacyGroupId }) => !legacyGroupId); const imported = current.zones.filter(({ legacyGroupId }) => Boolean(legacyGroupId));
  const byLegacyId = new Map(imported.map((zone) => [zone.legacyGroupId!, zone])); const retainedIds = new Set(groups.flatMap((group) => { const previous = byLegacyId.get(group.id); return previous ? [previous.id] : []; })); const used = new Set([...independent.map(({ id }) => id), ...retainedIds]);
  const next = [...groups].sort(compareIds).map((group) => {
    const previous = byLegacyId.get(group.id); const id = previous?.id ?? (used.has(group.id) ? uniqueLegacyZoneId(group.id, used) : group.id); used.add(id); return zoneFromLegacyGroup(group, id, previous);
  });
  return { ...current, groups: [], zones: [...independent, ...next], lenses: current.lenses };
}

function migrateStoryDataUncached(input: unknown): StoryData {
  if (input === undefined || input === null) return emptyStoryData();
  const canonicalInput = input && typeof input === "object" && (input as { version?: unknown }).version === 1 ? { routes: [], ...(input as Record<string, unknown>) } : input;
  const canonical = storyDataSchema.safeParse(canonicalInput); if (canonical.success) return normalizeStoryZones(canonical.data);
  if (!input || typeof input !== "object") return emptyStoryData();
  const source = input as Record<string, unknown>;
  const routes = Array.isArray(source.routes) ? source.routes.flatMap((entry) => { const parsed = routeRecordSchema.safeParse(entry); return parsed.success ? [parsed.data] : []; }) : [];
  return normalizeStoryZones(storyDataSchema.parse({ ...emptyStoryData(), world: legacyWorld(source), propertyDefinitions: legacyPropertyDefinitions(source), groups: legacyGroupRecords(source), zones: legacyZoneRecords(source), lenses: records(source.lenses).map((entry) => ({ id: entry.id, name: entry.name, color: typeof entry.color === "string" ? entry.color : "#6e6254", expression: { kind: "all", items: [] } })), scenarios: records(source.scenarios).map((entry) => ({ id: entry.id, name: entry.name, description: entry.description, patches: [], steps: [] })), relations: records(source.relations).map((entry) => ({ id: entry.id, from: { entryId: entry.fromId && typeof entry.fromId === "string" ? entry.fromId : "unknown" }, to: { entryId: entry.toId && typeof entry.toId === "string" ? entry.toId : "unknown" }, kind: "custom", label: typeof entry.label === "string" ? entry.label : undefined })), intentions: records(source.intentions).map((entry) => ({ id: entry.id, subject: { kind: "place", id: "unresolved" }, kind: "custom", text: entry.description ?? entry.name, status: "draft" })), routes }));
}

/** Accept canonical StoryData, no story, or the early collection-oriented UI shape. */
export function migrateStoryData(input: unknown): StoryData {
  if (!isImmutableSnapshot(input)) return migrateStoryDataUncached(input);
  const cached = migratedStorySnapshots.get(input);
  if (cached) return cached;
  const migrated = immutableSnapshot(migrateStoryDataUncached(input));
  migratedStorySnapshots.set(input, migrated);
  return migrated;
}
