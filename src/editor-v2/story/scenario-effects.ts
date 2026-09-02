import type { EditorProject } from "../model/project-model";
import { canonicalProjectStoryRef, resolveStoryObject } from "./project-adapter";
import { effectiveProjectStoryObject, projectStoryData } from "./project-effective";
import { projectStoryObjectLocked } from "./story-locks";
import { storyRefKey, type StoryObjectRef, type StoryTextPatch, type StoryViewContext } from "./types";

export type ScenarioEffectField = { key: string; before: unknown; after: unknown; authored: unknown; changed: boolean };
export type ScenarioEffect = { patchId: string; target: StoryObjectRef; objectName: string; missing: boolean; locked: boolean; fields: ScenarioEffectField[] };

const accessKeys = ["allow", "deny", "permission", "physicalState", "lock", "keyIds", "guardIds", "secretKnowledge", "hidden", "knownBy"] as const;
const has = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const copy = <T>(value: T): T => structuredClone(value);
const equal = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);

function fail(message: string): never { throw new Error(`Scenario operation rejected: ${message}`); }
function scenarioContainer(project: EditorProject, scenarioId: string, stepId?: string) {
  const story = projectStoryData(project); const scenario = story.scenarios.find(({ id }) => id === scenarioId);
  if (!scenario) fail(`scenario ${scenarioId} does not exist`);
  if (!stepId) return { story, scenario, patches: scenario.patches, context: { scenarioId } as StoryViewContext };
  const step = scenario.steps.find(({ id }) => id === stepId); if (!step) fail(`step ${stepId} does not belong to scenario ${scenario.id}`);
  return { story, scenario, step, patches: step.patches, context: { scenarioId, stepId } as StoryViewContext };
}

function authoredFields(patch: StoryTextPatch): Array<{ key: string; value: unknown }> {
  const fields: Array<{ key: string; value: unknown }> = [];
  if (has(patch, "title")) fields.push({ key: "narrativeLabel", value: patch.title });
  if (has(patch, "description")) fields.push({ key: "narrativeDescription", value: patch.description });
  const metadata = patch.metadata;
  if (metadata) {
    for (const key of ["owners", "tags"] as const) if (has(metadata, key)) fields.push({ key, value: metadata[key] });
    if (metadata.access) for (const key of accessKeys) if (has(metadata.access, key)) fields.push({ key: `access.${key}`, value: metadata.access[key] });
    if (has(metadata, "narrativeLabel")) fields.push({ key: "narrativeLabel", value: metadata.narrativeLabel });
    if (has(metadata, "narrativeDescription")) fields.push({ key: "narrativeDescription", value: metadata.narrativeDescription });
  }
  for (const [key, value] of Object.entries(patch.properties ?? {})) fields.push({ key: `property:${key}`, value });
  return fields;
}

function fieldValue(object: ReturnType<typeof effectiveProjectStoryObject> | undefined, key: string): unknown {
  if (!object) return undefined;
  if (key === "narrativeLabel") return object.name;
  if (key === "narrativeDescription") return object.description;
  if (key === "owners" || key === "tags") return object.metadata[key];
  if (key.startsWith("access.")) return object.metadata.access?.[key.slice("access.".length) as keyof NonNullable<typeof object.metadata.access>];
  if (key.startsWith("property:")) return object.metadata.properties?.[key.slice("property:".length)];
  return undefined;
}

/** Read scenario or step patches against base/scenario effective values. Missing targets stay visible. */
export function readScenarioEffects(project: EditorProject, scenarioId: string, stepId?: string): ScenarioEffect[] {
  const container = scenarioContainer(project, scenarioId, stepId); const beforeContext = stepId ? { scenarioId } : {};
  return container.patches.map((patch) => {
    const resolved = resolveStoryObject(project, container.story, patch.target); const target = resolved?.ref ?? canonicalProjectStoryRef(project, patch.target);
    const before = effectiveProjectStoryObject(project, target, beforeContext); const after = effectiveProjectStoryObject(project, target, container.context);
    const fields = authoredFields(patch).map(({ key, value }) => { const beforeValue = fieldValue(before, key); const afterValue = fieldValue(after, key); return { key, before: copy(beforeValue), after: copy(afterValue), authored: copy(value), changed: !equal(beforeValue, afterValue) }; });
    return { patchId: patch.id, target, objectName: after?.name ?? before?.name ?? storyRefKey(target), missing: !resolved, locked: resolved ? projectStoryObjectLocked(project, target, resolved) : false, fields };
  });
}
