import type { EditorProject } from "../../model/project-model";
import type { ProjectCheckpoint } from "../../persistence/project-checkpoint";
import { projectRevision, valueRevision } from "../../state/project-revision";
import { canonicalProjectStoryRef } from "../project-adapter";
import { effectiveProjectStoryObject } from "../project-effective";
import { formatStoryFieldValue, storyFieldLabel, resolvedStoryFieldObjectName } from "../field-format";
import { storyRefKey, type StoryViewContext } from "../types";
import { proposalChangeCandidates, proposalSupportedFields, proposalValue, sameProposalValue, type ProposalCandidate } from "./proposal-change-scope";
import type { ProposalChangeInput, ProposalChangeReadResult, ProposalFieldRow, ProposalValue } from "./proposal-change-types";

function contextExists(project: EditorProject, context: StoryViewContext) {
  const scenario = project.story.scenarios.find(({ id }) => id === context.scenarioId);
  return (!context.scenarioId || Boolean(scenario)) && (!context.stepId || Boolean(scenario?.steps.some(({ id }) => id === context.stepId)));
}
function effectiveValue(object: ReturnType<typeof effectiveProjectStoryObject>, key: string): ProposalValue {
  if (!object) return { present: false };
  if (key === "narrativeLabel") return proposalValue(object.name);
  if (key === "narrativeDescription") return proposalValue(object.description);
  if (key.startsWith("property:")) return proposalValue(object.metadata.properties?.[key.slice(9)]);
  if (key.startsWith("access.")) return proposalValue(object.metadata.access?.[key.slice(7) as keyof NonNullable<typeof object.metadata.access>]);
  return proposalValue(object.metadata[key as "owners" | "tags"]);
}
function evidence(object: ReturnType<typeof effectiveProjectStoryObject>, key: string) {
  const property = key.startsWith("property:") ? object?.effectiveProperties.find(({ propertyId }) => propertyId === key.slice(9)) : undefined;
  return { provenanceAvailable: Boolean(property), sources: property ? [property.source, ...(property.patchIds ?? []).map((id) => `patch:${id}`)] : [], conflicts: object?.conflicts ?? [] };
}
function rowFor(before: EditorProject, after: EditorProject, candidate: ProposalCandidate, resolve: typeof effectiveProjectStoryObject): ProposalFieldRow {
  const { ref, source, fieldKey } = candidate; const context = { scenarioId: source.scenarioId, stepId: source.stepId };
  const contextBefore = contextExists(before, context); const contextAfter = contextExists(after, context);
  const resolvedBefore = resolve(before, ref, context); const resolvedAfter = resolve(after, ref, context);
  const old = contextBefore ? resolvedBefore : undefined;
  const next = contextAfter ? resolvedAfter : undefined;
  const effectiveBefore = effectiveValue(old, fieldKey); const effectiveAfter = effectiveValue(next, fieldKey);
  const display = (locale: "pl" | "en") => {
    const format = (project: EditorProject, slot: ProposalValue) => formatStoryFieldValue(project, slot.present ? slot.value : undefined, fieldKey, locale);
    return { field: storyFieldLabel(after, fieldKey, locale), objectBefore: resolvedStoryFieldObjectName(before, ref, resolvedBefore, locale), objectAfter: resolvedStoryFieldObjectName(after, ref, resolvedAfter, locale), authoredBefore: format(before, candidate.before), authoredAfter: format(after, candidate.after), effectiveBefore: format(before, effectiveBefore), effectiveAfter: format(after, effectiveAfter) };
  };
  const scenarioBefore = before.story.scenarios.find(({ id }) => id === source.scenarioId); const scenarioAfter = after.story.scenarios.find(({ id }) => id === source.scenarioId);
  const scope = (project: EditorProject) => project.places.find(({ constructionId, id }) => ref.scopeId && (constructionId === ref.scopeId || id === ref.scopeId))?.name;
  return { id: candidate.id, ref, source, context, fieldKey, authoredPath: candidate.authoredPath, operation: !candidate.before.present ? "add" : !candidate.after.present ? "remove" : "change", authoredBefore: candidate.before, authoredAfter: candidate.after, effectiveBefore, effectiveAfter,
    effectiveChanged: old && next ? !sameProposalValue(effectiveBefore, effectiveAfter) : null,
    missing: { objectBefore: !resolvedBefore, objectAfter: !resolvedAfter, contextBefore: !contextBefore, contextAfter: !contextAfter }, evidence: { before: evidence(old, fieldKey), after: evidence(next, fieldKey) },
    names: { scenarioBefore: scenarioBefore?.name, scenarioAfter: scenarioAfter?.name, stepBefore: scenarioBefore?.steps.find(({ id }) => id === source.stepId)?.name, stepAfter: scenarioAfter?.steps.find(({ id }) => id === source.stepId)?.name, scopeBefore: scope(before), scopeAfter: scope(after) },
    display: { pl: display("pl"), en: display("en") } };
}

/** Reads the original proposal pair, never rebasing it onto current authored data. */
export function readProposalChanges(checkpoint: Pick<ProjectCheckpoint, "id" | "kind" | "projectId" | "baseSnapshot" | "snapshot">, current: EditorProject, input: ProposalChangeInput): ProposalChangeReadResult {
  const before = checkpoint.baseSnapshot; const after = checkpoint.snapshot;
  if (checkpoint.kind !== "proposal" || !before || !after || checkpoint.id !== input.checkpointId || before.id !== after.id || after.id !== checkpoint.projectId || current.id !== checkpoint.projectId) return { status: "unavailable", reason: "proposal-pair-unavailable" };
  const limit = input.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (input.refs?.length ?? 0) > 100) return { status: "invalid-input", reason: "invalid-page-scope" };
  const beforeRevision = projectRevision(before); const afterRevision = projectRevision(after);
  const keys = input.refs?.map((ref) => storyRefKey(canonicalProjectStoryRef(after, canonicalProjectStoryRef(before, ref)))).toSorted();
  const selected = keys && new Set(keys);
  const { candidates, unsupportedChanges } = proposalChangeCandidates(before, after);
  const matches = candidates.filter((candidate) => (!selected || selected.has(storyRefKey(candidate.ref))) && (!input.context || (candidate.source.scenarioId === input.context.scenarioId && candidate.source.stepId === input.context.stepId)));
  const binding = valueRevision({ checkpointId: checkpoint.id, beforeRevision, afterRevision, refs: keys, context: input.context });
  let offset = 0;
  if (input.cursor) {
    try {
      const cursor: unknown = JSON.parse(input.cursor);
      if (!Array.isArray(cursor) || cursor.length !== 2 || cursor[0] !== binding || !Number.isInteger(cursor[1]) || cursor[1] < 0 || cursor[1] > matches.length) throw new Error("cursor mismatch");
      offset = cursor[1];
    } catch { return { status: "invalid-cursor", reason: "proposal-page-changed" }; }
  }
  // Cache only this page read; never retain snapshots or results across revisions/requests.
  const resolved = new Map<string, ReturnType<typeof effectiveProjectStoryObject>>();
  const resolve: typeof effectiveProjectStoryObject = (project, ref, context = {}) => {
    const key = JSON.stringify([project === before ? "before" : "after", storyRefKey(ref), context.scenarioId, context.stepId]);
    if (!resolved.has(key)) resolved.set(key, effectiveProjectStoryObject(project, ref, context));
    return resolved.get(key);
  };
  const rows = matches.slice(offset, offset + limit).map((candidate) => rowFor(before, after, candidate, resolve));
  return { status: "ready", schemaVersion: 1, kind: "proposal", checkpointId: checkpoint.id, projectId: checkpoint.projectId, beforeRevision, afterRevision, applicability: projectRevision(current) === beforeRevision ? "current" : "stale",
    query: structuredClone({ refs: input.refs, context: input.context }),
    coverage: { directTargetsOnly: true, supportedFields: proposalSupportedFields, unsupportedChanges, indirectEffectsIncluded: false }, total: matches.length, offset, limit, rows,
    ...(offset + rows.length < matches.length ? { nextCursor: JSON.stringify([binding, offset + rows.length]) } : {}) };
}
