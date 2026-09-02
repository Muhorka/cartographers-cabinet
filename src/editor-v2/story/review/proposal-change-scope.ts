import type { EditorProject } from "../../model/project-model";
import { sameJsonValue } from "../../model/json-value";
import { canonicalProjectStoryRef } from "../project-adapter";
import { storyRefKey, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyValue, type StoryTextPatch } from "../types";
import type { ProposalChangeSource, ProposalValue } from "./proposal-change-types";

export const proposalSupportedFields = ["owners", "tags", "narrativeLabel", "narrativeDescription", "access.allow", "access.deny", "access.permission", "access.physicalState", "access.lock", "access.keyIds", "access.guardIds", "access.secretKnowledge", "access.hidden", "access.knownBy", "property:*"];
const accessKeys = ["allow", "deny", "permission", "physicalState", "lock", "keyIds", "guardIds", "secretKnowledge", "hidden", "knownBy"] as const;
type AuthoredField = { key: string; slot: ProposalValue };
type SourceRecord = { ref: StoryObjectRef; source: ProposalChangeSource; fields: Map<string, AuthoredField> };
export type ProposalCandidate = { id: string; ref: StoryObjectRef; source: ProposalChangeSource; fieldKey: string; authoredPath: string; before: ProposalValue; after: ProposalValue };
export const proposalValue = (value: StoryPropertyValue | undefined): ProposalValue => value === undefined ? { present: false } : { present: true, value: structuredClone(value) };
export const sameProposalValue = sameJsonValue;

function fields(metadata?: StoryObjectMetadata, patch?: StoryTextPatch) {
  const result = new Map<string, AuthoredField>();
  const add = (path: string, key: string, value: StoryPropertyValue | undefined) => { if (value !== undefined) result.set(path, { key, slot: proposalValue(value) }); };
  for (const key of ["owners", "tags", "narrativeLabel", "narrativeDescription"] as const) add(`metadata.${key}`, key, metadata?.[key]);
  for (const key of accessKeys) add(`metadata.access.${key}`, `access.${key}`, metadata?.access?.[key]);
  for (const [key, value] of Object.entries(metadata?.properties ?? {})) add(`metadata.properties.${key}`, `property:${key}`, value);
  if (patch) {
    add("title", "narrativeLabel", patch.title); add("description", "narrativeDescription", patch.description);
    for (const [key, value] of Object.entries(patch.properties ?? {})) add(`properties.${key}`, `property:${key}`, value);
  }
  return result;
}

function sources(project: EditorProject) {
  const records = new Map<string, SourceRecord>(); const ambiguous = new Set<string>(); const identities = new Map<string, string[]>();
  const contexts = new Set<string>(); const ambiguousContexts = new Set<string>();
  const addContext = (key: string) => { if (contexts.has(key)) ambiguousContexts.add(key); contexts.add(key); };
  const add = (ref: StoryObjectRef, source: ProposalChangeSource, values: Map<string, AuthoredField>) => {
    const canonical = canonicalProjectStoryRef(project, ref); const id = JSON.stringify([source.collection, source.scenarioId, source.stepId, source.patchId, storyRefKey(canonical)]);
    const identity = source.collection === "objects" ? id : JSON.stringify([source.collection, source.scenarioId, source.stepId, source.patchId]);
    const previous = identities.get(identity) ?? [];
    if (previous.length) for (const duplicate of [...previous, id]) ambiguous.add(duplicate);
    identities.set(identity, [...previous, id]);
    records.set(id, { ref: canonical, source, fields: values });
  };
  for (const object of project.story.objects) add(object.ref, { collection: "objects" }, fields(object.metadata));
  for (const scenario of project.story.scenarios) {
    addContext(JSON.stringify([scenario.id]));
    for (const patch of scenario.patches) add(patch.target, { collection: "scenarios", scenarioId: scenario.id, patchId: patch.id }, fields(patch.metadata, patch));
    for (const step of scenario.steps) {
      addContext(JSON.stringify([scenario.id, step.id]));
      for (const patch of step.patches) add(patch.target, { collection: "scenarios", scenarioId: scenario.id, stepId: step.id, patchId: patch.id }, fields(patch.metadata, patch));
    }
  }
  return { records, ambiguous, ambiguousContexts };
}

/** Lists authored changes only; no geometry walk or effective resolution of every object. */
export function proposalChangeCandidates(before: EditorProject, after: EditorProject) {
  const a = sources(before); const b = sources(after); const candidates: ProposalCandidate[] = [];
  const ambiguous = new Set([...a.ambiguous, ...b.ambiguous]);
  const ambiguousContexts = new Set([...a.ambiguousContexts, ...b.ambiguousContexts]);
  for (const id of new Set([...a.records.keys(), ...b.records.keys()])) {
    if (ambiguous.has(id)) continue;
    const old = a.records.get(id); const next = b.records.get(id); const record = next ?? old!;
    if (record.source.collection === "scenarios" && (ambiguousContexts.has(JSON.stringify([record.source.scenarioId])) || ambiguousContexts.has(JSON.stringify([record.source.scenarioId, record.source.stepId])))) continue;
    for (const path of new Set([...(old?.fields.keys() ?? []), ...(next?.fields.keys() ?? [])])) {
      const previous = old?.fields.get(path); const proposed = next?.fields.get(path);
      const left: ProposalValue = previous?.slot ?? { present: false }; const right: ProposalValue = proposed?.slot ?? { present: false };
      if (sameProposalValue(left, right)) continue;
      candidates.push({ id: JSON.stringify([id, path]), ref: record.ref, source: record.source, fieldKey: (proposed ?? previous)!.key, authoredPath: path, before: left, after: right });
    }
  }
  candidates.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const unsupportedChanges: string[] = ambiguous.size || ambiguousContexts.size ? ["ambiguous-story-records"] : [];
  for (const key of Object.keys(before.story) as Array<keyof EditorProject["story"]>) {
    if (key === "objects" || key === "scenarios") continue;
    if (!sameProposalValue(before.story[key], after.story[key])) unsupportedChanges.push(`story.${key}`);
  }
  const structure = (project: EditorProject) => project.story.scenarios.map(({ id, name, description, steps }) => ({ id, name, description, steps: steps.map(({ id, name, description }) => ({ id, name, description })) }));
  if (!sameProposalValue(structure(before), structure(after))) unsupportedChanges.push("scenario-structure");
  const other = (project: EditorProject) => Object.fromEntries(Object.entries(project).filter(([key]) => key !== "story" && key !== "updatedAt"));
  if (!sameProposalValue(other(before), other(after))) unsupportedChanges.push("non-story-project-data");
  return { candidates, unsupportedChanges };
}
