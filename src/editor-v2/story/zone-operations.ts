import type { EditorProject, RegionShape } from "../model/project-model";
import { canonicalProjectStoryRef, allStoryObjectRefs } from "./project-adapter";
import { storyRefKey, type StoryObjectMetadata, type StoryObjectRef, type StoryZone, type StoryZoneRelation } from "./types";

/** Selection-like values accepted by the zone commands. */
export type ZoneSelectionRef = StoryObjectRef | { kind: StoryObjectRef["kind"]; id: string; scopeId?: string };

export type ZoneSelectionOptions = {
  id?: string;
  name: string;
  description?: string;
  ownerPlaceId?: string;
  shape?: RegionShape;
  tags?: string[];
  metadata?: StoryObjectMetadata;
  color?: string;
  refs: readonly ZoneSelectionRef[];
};

/** Construction wall segments are technical support records, not narrative zone members. */
export function isTechnicalWallSegment(ref: ZoneSelectionRef): boolean {
  return ref.kind === "wall";
}

/** Canonicalizes and de-duplicates refs while keeping the project's scope aliases stable. */
export function canonicalZoneRefs(project: EditorProject, refs: readonly ZoneSelectionRef[]): StoryObjectRef[] {
  const projectRefs = allStoryObjectRefs(project);
  const unique = new Map<string, StoryObjectRef>();
  for (const ref of refs) {
    if (!ref.id.trim()) continue;
    const canonical = canonicalProjectStoryRef(project, ref);
    // Map selections do not carry construction scope. Recover it when the id is
    // unique; leave ambiguous ids untouched so a caller cannot guess a floor.
    const scopedCandidates = projectRefs.filter((candidate) => candidate.kind === canonical.kind && candidate.id === canonical.id);
    const scoped = !canonical.scopeId && scopedCandidates.length === 1 ? scopedCandidates[0] : canonical;
    unique.set(storyRefKey(scoped), scoped);
  }
  return [...unique.values()];
}

/** Returns real project objects suitable for authored zone membership. */
export function filterEligibleZoneMembers(project: EditorProject, refs: readonly ZoneSelectionRef[]): StoryObjectRef[] {
  const known = new Set(allStoryObjectRefs(project).map(storyRefKey));
  return canonicalZoneRefs(project, refs).filter((ref) => !isTechnicalWallSegment(ref) && known.has(storyRefKey(ref)));
}

/** Short alias used by selection and inspector integrations. */
export function zoneMemberRefs(project: EditorProject, refs: readonly ZoneSelectionRef[]): StoryObjectRef[] {
  return filterEligibleZoneMembers(project, refs);
}

function nextZoneId(project: EditorProject): string {
  const candidate = globalThis.crypto?.randomUUID?.();
  if (candidate && !project.story.zones.some(({ id }) => id === candidate)) return candidate;
  let index = project.story.zones.length + 1;
  while (project.story.zones.some(({ id }) => id === `zone-${index}`)) index += 1;
  return `zone-${index}`;
}

function selectionMembers(project: EditorProject, refs: readonly ZoneSelectionRef[], existing: ReadonlyArray<StoryZone["members"][number]> = []) {
  const previous = new Map(existing.map((member) => [storyRefKey(canonicalProjectStoryRef(project, member.ref)), member]));
  return filterEligibleZoneMembers(project, refs).map((ref) => {
    const authored = previous.get(storyRefKey(ref));
    return authored ? { ...authored, ref } : { ref, relation: "inside" as StoryZoneRelation, partial: false };
  });
}

/** Creates one distinct zone from a mixed map selection without changing geometry. */
export function createProjectZone(project: EditorProject, options: ZoneSelectionOptions): EditorProject {
  const id = options.id?.trim() || nextZoneId(project);
  if (project.story.zones.some((zone) => zone.id === id)) throw new Error(`A story zone with id ${id} already exists.`);
  const name = options.name.trim();
  if (!name) throw new Error("A story zone needs a name.");
  const zone: StoryZone = {
    id,
    name,
    ...(options.description === undefined ? {} : { description: options.description }),
    ...(options.ownerPlaceId === undefined ? {} : { ownerPlaceId: options.ownerPlaceId }),
    ...(options.shape === undefined ? {} : { shape: structuredClone(options.shape) }),
    members: selectionMembers(project, options.refs),
    tags: [...(options.tags ?? [])],
    ...(options.metadata === undefined ? {} : { metadata: structuredClone(options.metadata) }),
    ...(options.color === undefined ? {} : { color: options.color }),
  };
  return { ...project, story: { ...project.story, zones: [...project.story.zones, zone] } };
}

/** Compatibility name for callers that describe the operation by its UI source. */
export function createZoneFromMixedSelection(project: EditorProject, options: ZoneSelectionOptions): EditorProject {
  return createProjectZone(project, options);
}

/** Replaces a zone's selected members, retaining authored relation/partial/note fields for retained refs. */
export function editProjectZoneFromSelection(project: EditorProject, zoneId: string, refs: readonly ZoneSelectionRef[]): EditorProject {
  const zone = project.story.zones.find(({ id }) => id === zoneId);
  if (!zone) throw new Error(`Story zone ${zoneId} was not found.`);
  const next = { ...zone, members: selectionMembers(project, refs, zone.members) };
  return { ...project, story: { ...project.story, zones: project.story.zones.map((candidate) => candidate.id === zoneId ? next : candidate) } };
}

export function editZoneFromSelection(project: EditorProject, zoneId: string, refs: readonly ZoneSelectionRef[]): EditorProject {
  return editProjectZoneFromSelection(project, zoneId, refs);
}
