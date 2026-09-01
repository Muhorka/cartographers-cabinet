import type { StoryData, StoryPropertyValue, StoryWorldEntry } from "./types";

/** One value and the world entries whose authored properties support it. */
type EffectiveWorldPropertyValue = {
  value: StoryPropertyValue;
  sourceIds: string[];
};

/** The resolved view of one property, including ambiguous inherited values. */
type EffectiveWorldProperty = {
  propertyId: string;
  value?: StoryPropertyValue;
  sourceIds: string[];
  values: EffectiveWorldPropertyValue[];
  inherited: boolean;
  conflict: boolean;
};

type EffectiveWorldConflict = {
  propertyId: string;
  values: EffectiveWorldPropertyValue[];
};

/**
 * A world entry with group properties resolved for display and agent rules.
 *
 * `properties` contains only an unambiguous effective value.  An inherited
 * conflict is deliberately omitted from it and is available in `conflicts`
 * and `propertySources`, so callers cannot accidentally pick a group value.
 */
export type EffectiveWorldEntry = Omit<StoryWorldEntry, "properties" | "tags"> & {
  properties: Record<string, StoryPropertyValue>;
  tags: string[];
  inheritedFrom: string[];
  propertySources: Record<string, EffectiveWorldProperty>;
  conflicts: EffectiveWorldConflict[];
};

function valuesEqual(first: StoryPropertyValue, second: StoryPropertyValue) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function groupAncestors(story: StoryData, entryId: string, worldById: ReadonlyMap<string, StoryWorldEntry>) {
  const groups: StoryWorldEntry[] = [];
  const visited = new Set<string>([entryId]);
  const pending = [entryId];

  // A queue gives deterministic, nearest-first provenance while visited also
  // makes malformed cyclic memberships terminate safely.
  while (pending.length) {
    const subjectId = pending.shift()!;
    for (const membership of story.memberships) {
      if (membership.kind !== "member-of" || membership.subjectId !== subjectId || visited.has(membership.groupId)) continue;
      const group = worldById.get(membership.groupId);
      // Factions can also be membership containers (for example a guild or
      // court), while characters and keys are always leaves in this graph.
      if (!group || (group.kind !== "access-group" && group.kind !== "faction")) continue;
      visited.add(group.id);
      groups.push(group);
      pending.push(group.id);
    }
  }
  return groups;
}

function addCandidate(candidates: EffectiveWorldPropertyValue[], value: StoryPropertyValue, sourceId: string) {
  const existing = candidates.find((candidate) => valuesEqual(candidate.value, value));
  if (existing) existing.sourceIds.push(sourceId);
  else candidates.push({ value, sourceIds: [sourceId] });
}

/**
 * Resolve a world entry's own properties plus properties inherited through
 * direct and transitive `member-of` relationships.
 *
 * Own values always win, including when groups disagree. Without an own value,
 * equal inherited values merge their provenance; unequal inherited values stay
 * explicit conflicts and produce no effective property value. The input is
 * never mutated, so removing a membership naturally removes only its inherited
 * contribution on the next call.
 */
export function effectiveWorldEntry(story: StoryData, entryId: string): EffectiveWorldEntry | undefined {
  const worldById = new Map(story.world.map((entry) => [entry.id, entry]));
  const entry = worldById.get(entryId);
  if (!entry) return undefined;

  const inheritedEntries = groupAncestors(story, entryId, worldById);
  const inheritedFrom = inheritedEntries.map(({ id }) => id);
  const propertyCandidates = new Map<string, EffectiveWorldPropertyValue[]>();

  for (const group of inheritedEntries) {
    for (const [propertyId, value] of Object.entries(group.properties)) {
      const candidates = propertyCandidates.get(propertyId) ?? [];
      addCandidate(candidates, value, group.id);
      propertyCandidates.set(propertyId, candidates);
    }
  }

  const propertySources: Record<string, EffectiveWorldProperty> = {};
  const properties: Record<string, StoryPropertyValue> = {};
  const conflicts: EffectiveWorldConflict[] = [];
  const propertyIds = new Set([...propertyCandidates.keys(), ...Object.keys(entry.properties)]);

  for (const propertyId of propertyIds) {
    const ownValue = entry.properties[propertyId];
    if (ownValue !== undefined || Object.prototype.hasOwnProperty.call(entry.properties, propertyId)) {
      const own = { value: ownValue!, sourceIds: [entry.id] };
      propertySources[propertyId] = { propertyId, value: ownValue, sourceIds: own.sourceIds, values: [own], inherited: false, conflict: false };
      properties[propertyId] = ownValue!;
      continue;
    }

    const values = propertyCandidates.get(propertyId) ?? [];
    const sourceIds = values.flatMap(({ sourceIds: ids }) => ids);
    const conflict = values.length > 1;
    propertySources[propertyId] = { propertyId, value: conflict ? undefined : values[0]?.value, sourceIds, values, inherited: true, conflict };
    if (conflict) conflicts.push({ propertyId, values });
    else if (values[0]) properties[propertyId] = values[0].value;
  }

  return {
    ...entry,
    properties,
    tags: [...new Set([...entry.tags, ...inheritedEntries.flatMap(({ tags }) => tags)])],
    inheritedFrom,
    propertySources,
    conflicts,
  };
}

/** Resolve all world entries without exposing mutable source objects. */
export function effectiveWorldEntries(story: StoryData) {
  return story.world.map(({ id }) => effectiveWorldEntry(story, id)!);
}
