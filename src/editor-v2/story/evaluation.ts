import { sameStoryRef, storyRefKey, type StoryData, type StoryLens, type StoryLensExpression, type StoryObjectMetadata, type StoryObjectRef, type StoryViewContext } from "./types";
import type { EditorProject } from "../model/project-model";
import { allStoryObjectRefs, canonicalProjectStoryRef, zoneMatchesProject } from "./project-adapter";
import { canonicalLensExpression, createProjectStoryObjectResolver, projectStoryData } from "./project-effective";
import { effectiveStoryMetadata, effectiveStoryObject, storyAccessForMetadata, type StoryAccessResult } from "./effective";
import { migrateStoryData } from "./migration";
export { effectiveStoryMetadata, effectiveStoryObject, type StoryAccessResult } from "./effective";

function equalValue(first: unknown, second: unknown) { return JSON.stringify(first) === JSON.stringify(second); }
function objectTags(story: StoryData, ref: StoryObjectRef, context: StoryViewContext, resolve?: MetadataResolver) {
  return new Set(resolve?.(ref, context)?.tags ?? effectiveStoryObject(story, ref, context)?.metadata.tags ?? effectiveStoryMetadata(story, ref).metadata.tags ?? []);
}
function inZone(story: StoryData, zoneId: string, ref: StoryObjectRef) { return Boolean(story.zones.find(({ id, members }) => id === zoneId && members.some((member) => sameStoryRef(member.ref, ref)))); }
type MetadataResolver = (ref: StoryObjectRef, context: StoryViewContext) => StoryObjectMetadata | undefined;
function predicateMatch(story: StoryData, ref: StoryObjectRef, predicate: Extract<StoryLensExpression, { kind: "predicate" }>["predicate"], context: StoryViewContext, zoneMatcher?: (zoneId: string, ref: StoryObjectRef) => boolean, resolve?: MetadataResolver) {
  if (predicate.kind === "object") return sameStoryRef(predicate.ref, ref);
  if (predicate.kind === "tag") return objectTags(story, ref, context, resolve).has(predicate.value);
  if (predicate.kind === "group") {
    const zone = story.zones.find(({ legacyGroupId }) => legacyGroupId === predicate.groupId);
    return Boolean(zone && (zoneMatcher ? zoneMatcher(zone.id, ref) : inZone(story, zone.id, ref)));
  }
  if (predicate.kind === "zone") return zoneMatcher ? zoneMatcher(predicate.zoneId, ref) : inZone(story, predicate.zoneId, ref);
  const current = resolve?.(ref, context) ?? effectiveStoryObject(story, ref, context)?.metadata ?? effectiveStoryMetadata(story, ref).metadata;
  if (predicate.kind === "property") return equalValue(current.properties?.[predicate.propertyId], predicate.equals);
  if (predicate.kind === "owner") return Boolean(current.owners?.includes(predicate.entryId));
  const access = storyAccessForMetadata(story, current, predicate.entryId);
  return predicate.state === "denied" ? !access.allowed : access.allowed;
}
function evaluateExpression(story: StoryData, ref: StoryObjectRef, expression: StoryLensExpression, reasons: string[], context: StoryViewContext, zoneMatcher?: (zoneId: string, ref: StoryObjectRef) => boolean, resolve?: MetadataResolver): boolean {
  if (expression.kind === "predicate") { const matched = predicateMatch(story, ref, expression.predicate, context, zoneMatcher, resolve); reasons.push(`${expression.predicate.kind}:${matched ? "match" : "no-match"}`); return matched; }
  if (expression.kind === "not") { const matched = !evaluateExpression(story, ref, expression.item, reasons, context, zoneMatcher, resolve); reasons.push(`not:${matched}`); return matched; }
  const values = expression.items.map((item) => evaluateExpression(story, ref, item, reasons, context, zoneMatcher, resolve));
  const matched = expression.kind === "all" ? values.every(Boolean) : values.some(Boolean); reasons.push(`${expression.kind}:${matched}`); return matched;
}

export type LensEvaluation = { lensId: string; color: string; match: boolean; reasons: string[] };
export function evaluateLens(story: StoryData, lensId: string, ref: StoryObjectRef, context: StoryViewContext = {}): LensEvaluation | undefined {
  const canonical = migrateStoryData(story); const lens = canonical.lenses.find(({ id }) => id === lensId); if (!lens) return undefined;
  const reasons: string[] = []; return { lensId, color: lens.color, match: evaluateExpression(canonical, ref, lens.expression, reasons, context), reasons };
}
export function evaluateProjectLens(project: EditorProject, story: StoryData, lensId: string, ref: StoryObjectRef, context: StoryViewContext = {}): LensEvaluation | undefined {
  const lens = story.lenses.find(({ id }) => id === lensId); if (!lens) return undefined;
  return createProjectLensEvaluator(project, story, context)(lens, ref);
}

/** Saved and temporary lenses share evaluation; cache lives only for this read. */
export function createProjectLensEvaluator(project: EditorProject, story: StoryData, context: StoryViewContext = {}) {
  const effectiveProject = story === project.story ? project : { ...project, story }; const canonicalStory = projectStoryData(effectiveProject);
  const refs = allStoryObjectRefs(effectiveProject);
  const resolveStoryObject = createProjectStoryObjectResolver(effectiveProject, context, canonicalStory);
  const metadata = new Map<string, StoryObjectMetadata | undefined>(); const zoneMatches = new Map<string, boolean>();
  const expressions = new Map<StoryLensExpression, StoryLensExpression>();
  const resolve: MetadataResolver = (target) => {
    const key = storyRefKey(target);
    if (!metadata.has(key)) metadata.set(key, resolveStoryObject(target)?.metadata);
    return metadata.get(key);
  };
  return (lens: StoryLens, ref: StoryObjectRef): LensEvaluation => {
    const canonicalRef = canonicalProjectStoryRef(effectiveProject, ref, refs); const reasons: string[] = [];
    if (!expressions.has(lens.expression)) expressions.set(lens.expression, canonicalLensExpression(project, lens.expression));
    const zoneMatcher = (zoneId: string, target: StoryObjectRef) => {
      const key = `${zoneId}:${storyRefKey(target)}`;
      if (!zoneMatches.has(key)) zoneMatches.set(key, zoneMatchesProject(effectiveProject, canonicalStory, zoneId, target, refs).matches);
      return zoneMatches.get(key)!;
    };
    return { lensId: lens.id, color: lens.color, match: evaluateExpression(canonicalStory, canonicalRef, expressions.get(lens.expression)!, reasons, context, zoneMatcher, resolve), reasons };
  };
}

export type StorySearchHit = { kind: "object" | "world" | "evidence"; id: string; label: string; refs: StoryObjectRef[]; score: number };
export function searchStory(story: StoryData, query: string, limit = 50): StorySearchHit[] {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean); if (!terms.length) return [];
  const score = (haystack: string) => terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0); const hits: StorySearchHit[] = [];
  for (const object of story.objects) {
    const label = object.metadata.narrativeLabel ?? object.ref.id;
    const value = `${object.ref.id} ${object.ref.kind} ${object.metadata.narrativeLabel ?? ""} ${object.metadata.narrativeDescription ?? ""} ${(object.metadata.tags ?? []).join(" ")} ${JSON.stringify(object.metadata.properties ?? {})}`.toLocaleLowerCase();
    const hit = score(value); if (hit) hits.push({ kind: "object", id: storyRefKey(object.ref), label, refs: [object.ref], score: hit });
  }
  for (const entry of story.world) { const hit = score(`${entry.name} ${entry.description ?? ""} ${entry.tags.join(" ")}`.toLocaleLowerCase()); if (hit) hits.push({ kind: "world", id: entry.id, label: entry.name, refs: [], score: hit }); }
  for (const item of story.evidence) { const hit = score(`${item.text} ${item.locator ?? ""}`.toLocaleLowerCase()); if (hit) hits.push({ kind: "evidence", id: item.id, label: item.text, refs: item.refs, score: hit }); }
  return hits.sort((first, second) => second.score - first.score || first.label.localeCompare(second.label)).slice(0, limit);
}

export function storyAccess(story: StoryData, ref: StoryObjectRef, actorId?: string, context: StoryViewContext = {}): StoryAccessResult {
  const current = effectiveStoryObject(story, ref, context)?.metadata ?? effectiveStoryMetadata(story, ref).metadata; return storyAccessForMetadata(story, current, actorId);
}
