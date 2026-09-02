import type { SheetObjectListCopy } from "../components/sheet-object-list";
import { applyAffinePoint, projectPlaceWorldMatrices } from "../geometry/affine-transform";
import { regionBoundsCenter } from "../geometry/region-transform";
import type { EditorProject } from "../model/project-model";
import { canonicalProjectStoryRef } from "./project-adapter";
import type { ResolvedStoryObject } from "./project-adapter";
import { projectStoryData } from "./project-effective";
import { sameStoryRef, storyRefKey, type StoryData, type StoryObjectRef } from "./types";

type DisplayObject = Pick<ResolvedStoryObject, "ref" | "name"> & { metadata?: ResolvedStoryObject["metadata"]; ownerPlaceId?: string };

/** Prefers an explicitly authored base Story label without changing its technical source. */
function authoredStoryObjectLabel(story: StoryData, ref: StoryObjectRef, fallback: string): string {
  return story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref))?.metadata.narrativeLabel?.trim() || fallback;
}

type TransitionMember = {
  ref: StoryObjectRef;
  kind: "stairs" | "elevator";
  levelIds: Set<string>;
  ownerLevelId?: string;
  levelName?: string;
  center?: { x: number; y: number };
  constructionIndex: number;
  transitionIndex: number;
  sourceOwner: boolean;
  label?: string;
};

type TransitionDisplayInfo = { label?: string; ordinal: number; linked: boolean; levelName?: string };
const transitionDisplayInfoCache = new WeakMap<EditorProject, { story: StoryData; value: Map<string, TransitionDisplayInfo> }>();

const transitionMatchTolerance = .5;

function transitionBucket(member: TransitionMember, levelId: string, x: number, y: number) {
  return `${member.kind}\u0000${levelId}\u0000${x}\u0000${y}`;
}

/**
 * Finds landings of one logical vertical transition by shared levels, kind,
 * and position in project coordinates. Raw ids remain scoped to their plan.
 */
function transitionDisplayInfo(project: EditorProject, story: StoryData) {
  const cached = transitionDisplayInfoCache.get(project);
  if (cached?.story === story) return cached.value;
  const members: TransitionMember[] = []; const worldMatrices = projectPlaceWorldMatrices(project);
  project.constructions.forEach((construction, constructionIndex) => {
    const ownerLevels = project.places.filter(({ constructionId, kind }) => constructionId === construction.id && kind === "level");
    construction.transitions.forEach((transition, transitionIndex) => {
      const ref: StoryObjectRef = { kind: "transition", id: transition.id, scopeId: construction.id };
      const levelIds = new Set([
        ...ownerLevels.map(({ id }) => id),
        ...(transition.connectedLevelIds ?? []),
        ...[transition.sourceLevelId, transition.targetLevelId].filter((id): id is string => Boolean(id)),
      ]);
      const ownerLevel = ownerLevels.length === 1 ? ownerLevels[0] : undefined;
      const matrix = ownerLevel && worldMatrices.get(ownerLevel.id);
      const localCenter = regionBoundsCenter(transition.footprint);
      members.push({
        ref,
        kind: transition.kind,
        levelIds,
        ownerLevelId: ownerLevel?.id,
        levelName: ownerLevel?.name,
        center: matrix ? applyAffinePoint(matrix, localCenter) : undefined,
        constructionIndex,
        transitionIndex,
        sourceOwner: Boolean(transition.sourceLevelId && ownerLevels.some(({ id }) => id === transition.sourceLevelId)),
        label: story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref))?.metadata.narrativeLabel?.trim() || undefined,
      });
    });
  });

  const parents = members.map((_, index) => index);
  const find = (index: number): number => parents[index] === index ? index : (parents[index] = find(parents[index]!));
  const union = (first: number, second: number) => { const firstRoot = find(first); const secondRoot = find(second); if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot; };
  const scopedRefs = new Map<string, number>(); const spatial = new Map<string, number[]>();
  members.forEach((member, index) => {
    const refKey = storyRefKey(member.ref); const sameRef = scopedRefs.get(refKey); if (sameRef !== undefined) union(index, sameRef); else scopedRefs.set(refKey, index);
    if (!member.center || !member.ownerLevelId || !Number.isFinite(member.center.x) || !Number.isFinite(member.center.y)) return;
    const bucketX = Math.floor(member.center.x / transitionMatchTolerance); const bucketY = Math.floor(member.center.y / transitionMatchTolerance);
    const candidates = new Set<number>();
    for (const levelId of member.levelIds) for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      for (const candidate of spatial.get(transitionBucket(member, levelId, bucketX + dx, bucketY + dy)) ?? []) candidates.add(candidate);
    }
    for (const candidateIndex of candidates) {
      const candidate = members[candidateIndex]!;
      if (!candidate.center || candidate.ownerLevelId === member.ownerLevelId) continue;
      if (Math.hypot(candidate.center.x - member.center.x, candidate.center.y - member.center.y) <= transitionMatchTolerance) union(index, candidateIndex);
    }
    for (const levelId of member.levelIds) {
      const key = transitionBucket(member, levelId, bucketX, bucketY); const entries = spatial.get(key) ?? []; entries.push(index); spatial.set(key, entries);
    }
  });

  const components = new Map<number, TransitionMember[]>();
  members.forEach((member, index) => { const root = find(index); const records = components.get(root) ?? []; records.push(member); components.set(root, records); });
  const result = new Map<string, TransitionDisplayInfo>();
  for (const records of components.values()) {
    const representative = records.toSorted((first, second) => Number(second.sourceOwner) - Number(first.sourceOwner)
      || first.constructionIndex - second.constructionIndex || first.transitionIndex - second.transitionIndex)[0]!;
    const inherited = [...new Set(records.flatMap(({ label }) => label ? [label] : []))];
    const sharedLabel = representative.label ?? (inherited.length === 1 ? inherited[0] : undefined);
    for (const member of records) result.set(storyRefKey(member.ref), {
      label: member.label || sharedLabel,
      ordinal: representative.transitionIndex + 1,
      linked: records.length > 1,
      levelName: member.levelName,
    });
  }
  transitionDisplayInfoCache.set(project, { story, value: result }); return result;
}

function withTransitionOrdinal(fallback: string, ordinal: number) {
  return /\d+(?!.*\d)/.test(fallback) ? fallback.replace(/\d+(?!.*\d)/, String(ordinal)) : fallback;
}

/**
 * Resolves one authored base-Story label against the project's canonical,
 * scoped references. The returned function deliberately changes display text
 * only; construction ids and route-planner references remain untouched.
 */
export function createProjectStoryLabelResolver(project: EditorProject) {
  const story = projectStoryData(project); const transitions = transitionDisplayInfo(project, story);
  return (ref: StoryObjectRef, fallback: string) => storyLabel(project, story, transitions, ref, fallback);
}

function storyLabel(project: EditorProject, story: StoryData, transitions: ReadonlyMap<string, TransitionDisplayInfo>, ref: StoryObjectRef, fallback: string) {
  const canonical = canonicalProjectStoryRef(project, ref);
  if (canonical.kind !== "transition") return authoredStoryObjectLabel(story, canonical, fallback);
  const display = transitions.get(storyRefKey(canonical));
  return display?.label ?? withTransitionOrdinal(fallback, display?.ordinal ?? 1);
}

function generatedName(project: EditorProject, object: DisplayObject, copy: SheetObjectListCopy, transitions: ReadonlyMap<string, TransitionDisplayInfo>) {
  const construction = object.ref.scopeId && project.constructions.find(({ id }) => id === object.ref.scopeId);
  if (!construction) return undefined;
  if (object.ref.kind === "wall") {
    const index = construction.walls.findIndex(({ id }) => id === object.ref.id); return index < 0 ? undefined : { label: copy.wallName(index + 1), source: `Wall ${object.ref.id}` };
  }
  if (object.ref.kind === "opening") {
    const opening = construction.openings.find(({ id }) => id === object.ref.id); const index = construction.openings.findIndex(({ id }) => id === object.ref.id); return opening && index >= 0 ? { label: copy.openingName(opening.kind, index + 1), source: `${opening.kind} ${opening.id}` } : undefined;
  }
  if (object.ref.kind === "transition") {
    const transition = construction.transitions.find(({ id }) => id === object.ref.id); const index = construction.transitions.findIndex(({ id }) => id === object.ref.id); if (!transition || index < 0) return undefined;
    const ordinal = transitions.get(storyRefKey(object.ref))?.ordinal ?? index + 1;
    return { label: transition.kind === "elevator" ? copy.elevatorName?.(ordinal) ?? copy.stairsName(ordinal) : copy.stairsName(ordinal), source: `${transition.kind} ${transition.id}` };
  }
  return undefined;
}

function disambiguatingLevel(project: EditorProject, object: DisplayObject) {
  if (!object.ref.scopeId) return undefined;
  const hasDuplicate = project.constructions.filter((construction) => object.ref.kind === "wall" ? construction.walls.some(({ id }) => id === object.ref.id) : object.ref.kind === "opening" ? construction.openings.some(({ id }) => id === object.ref.id) : construction.transitions.some(({ id }) => id === object.ref.id)).length > 1;
  if (!hasDuplicate) return undefined;
  const levels = project.places.filter(({ constructionId, kind }) => constructionId === object.ref.scopeId && kind === "level");
  if (object.ownerPlaceId) { const owner = project.places.find(({ id, kind }) => id === object.ownerPlaceId && kind === "level"); if (owner) return owner.name; }
  return levels.length === 1 ? levels[0]?.name : undefined;
}

function baseDisplayName(project: EditorProject, object: DisplayObject, copy: SheetObjectListCopy, transitions: ReadonlyMap<string, TransitionDisplayInfo>): string {
  if (!["wall", "opening", "transition"].includes(object.ref.kind)) return object.name;
  const generated = generatedName(project, object, copy, transitions); if (!generated) return object.name;
  if (object.name !== generated.source) return object.name;
  if (object.metadata?.narrativeLabel?.trim()) return object.metadata.narrativeLabel.trim();
  return object.ref.kind === "transition" ? transitions.get(storyRefKey(object.ref))?.label ?? generated.label : generated.label;
}

function listDisplayName(project: EditorProject, object: DisplayObject, copy: SheetObjectListCopy, transitions: ReadonlyMap<string, TransitionDisplayInfo>): string {
  const short = baseDisplayName(project, object, copy, transitions);
  if (object.ref.kind === "transition") {
    const display = transitions.get(storyRefKey(object.ref));
    if (display?.linked && display.levelName) return `${short} — ${display.levelName}`;
  }
  const generated = generatedName(project, object, copy, new Map());
  if (!generated || object.metadata?.narrativeLabel || object.name !== generated.source) return short;
  const level = disambiguatingLevel(project, object); return level ? `${short} · ${level}` : short;
}

/**
 * Builds one naming batch for a project snapshot. Long lists should reuse this
 * resolver so connected-transition discovery is performed only once.
 */
export function createProjectStoryDisplayNameResolver(project: EditorProject, copy: SheetObjectListCopy) {
  const story = projectStoryData(project); const transitions = transitionDisplayInfo(project, story);
  return {
    label: (ref: StoryObjectRef, fallback: string) => storyLabel(project, story, transitions, ref, fallback),
    base: (object: DisplayObject) => baseDisplayName(project, object, copy, transitions),
    list: (object: DisplayObject) => listDisplayName(project, object, copy, transitions),
  };
}

/** Returns the short display name used on one sheet, without a level suffix. */
export function storyObjectBaseDisplayName(project: EditorProject, object: DisplayObject, copy: SheetObjectListCopy): string {
  if (!["wall", "opening", "transition"].includes(object.ref.kind)) return object.name;
  return createProjectStoryDisplayNameResolver(project, copy).base(object);
}

/** Returns a stable, localized display name without changing authored source data. */
export function storyObjectDisplayName(project: EditorProject, object: DisplayObject, copy: SheetObjectListCopy): string {
  if (!["wall", "opening", "transition"].includes(object.ref.kind)) return object.name;
  return createProjectStoryDisplayNameResolver(project, copy).list(object);
}
