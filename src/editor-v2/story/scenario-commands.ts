import type { EditorProject } from "../model/project-model";
import { canonicalProjectStoryRef } from "./project-adapter";
import { projectStoryData } from "./project-effective";
import { projectStoryObjectTarget } from "./story-locks";
import { storyDataSchema } from "./schema";
import { storyRefKey, type StoryScenario, type StoryTextPatch } from "./types";

type ScenarioStep = StoryScenario["steps"][number];
type StepChanges = Partial<Pick<ScenarioStep, "name" | "description" | "patches">>;
export type ScenarioStepCommand =
  | { kind: "add"; step: ScenarioStep; position?: number }
  | { kind: "update"; stepId: string; changes: StepChanges }
  | { kind: "remove"; stepId: string }
  | { kind: "move"; stepId: string; position: number };

function fail(message: string): never { throw new Error(`Scenario operation rejected: ${message}`); }
function copy<T>(value: T): T { return structuredClone(value); }
function patchEqual(first: StoryTextPatch, second: StoryTextPatch) { return JSON.stringify(first) === JSON.stringify(second); }

function existingScenarios(project: EditorProject) {
  const story = projectStoryData(project);
  return { story, scenarios: story.scenarios };
}

function scenario(project: EditorProject, scenarioId: string) {
  const result = existingScenarios(project); const value = result.scenarios.find(({ id }) => id === scenarioId);
  if (!value) fail(`scenario ${scenarioId} does not exist`);
  return { story: result.story, value };
}

function canonicalScenario(project: EditorProject, value: StoryScenario): StoryScenario {
  return {
    ...copy(value),
    patches: value.patches.map((patch) => ({ ...copy(patch), target: canonicalProjectStoryRef(project, patch.target) })),
    steps: value.steps.map((step) => ({ ...copy(step), patches: step.patches.map((patch) => ({ ...copy(patch), target: canonicalProjectStoryRef(project, patch.target) })) })),
  };
}

function targetTouched(project: EditorProject, patch: StoryTextPatch, operation: "add" | "change" | "remove") {
  const target = projectStoryObjectTarget(project, patch.target);
  if (target.status === "ambiguous") fail(`object ${storyRefKey(patch.target)} is missing or its scope is ambiguous`);
  if (target.status === "missing" && operation !== "remove") fail(`object ${storyRefKey(patch.target)} does not exist`);
  if (target.status === "resolved" && target.locked) fail(`object ${storyRefKey(target.ref)} is editor-locked`);
}

export function validateScenarioShape(value: StoryScenario) {
  const steps = new Set<string>();
  const validatePatchIds = (patches: readonly StoryTextPatch[], container: string) => {
    const ids = new Set<string>();
    for (const patch of patches) { if (ids.has(patch.id)) fail(`duplicate patch ${patch.id} in ${container}`); ids.add(patch.id); }
  };
  for (const step of value.steps) {
    if (steps.has(step.id)) fail(`duplicate step ${step.id} in scenario ${value.id}`);
    steps.add(step.id); validatePatchIds(step.patches, `step ${step.id}`);
  }
  validatePatchIds(value.patches, `scenario ${value.id}`);
}

function patchBuckets(patches: readonly StoryTextPatch[]) {
  const buckets = new Map<string, StoryTextPatch[]>();
  for (const patch of patches) buckets.set(patch.id, [...(buckets.get(patch.id) ?? []), patch]);
  return buckets;
}

/** Validate only effects which were added, removed, or changed in one exact container. */
function validatePatchDelta(project: EditorProject, before: readonly StoryTextPatch[], after: readonly StoryTextPatch[]) {
  const oldBuckets = patchBuckets(before); const nextBuckets = patchBuckets(after);
  const ids = new Set([...oldBuckets.keys(), ...nextBuckets.keys()]);
  for (const id of ids) {
    const oldPatches = oldBuckets.get(id) ?? []; const nextPatches = nextBuckets.get(id) ?? [];
    const count = Math.max(oldPatches.length, nextPatches.length);
    for (let index = 0; index < count; index++) {
      const oldPatch = oldPatches[index]; const nextPatch = nextPatches[index];
      if (oldPatch && nextPatch && patchEqual(oldPatch, nextPatch)) continue;
      if (oldPatch) targetTouched(project, oldPatch, nextPatch ? "change" : "remove");
      if (nextPatch) targetTouched(project, nextPatch, oldPatch ? "change" : "add");
    }
  }
}

function validateScenarioDelta(project: EditorProject, before: readonly StoryScenario[], after: readonly StoryScenario[]) {
  const oldById = new Map(before.map((entry) => [entry.id, entry])); const nextById = new Map(after.map((entry) => [entry.id, entry]));
  const ids = new Set([...oldById.keys(), ...nextById.keys()]);
  for (const id of ids) {
    const oldScenario = oldById.get(id); const nextScenario = nextById.get(id);
    if (!oldScenario) {
      validatePatchDelta(project, [], nextScenario!.patches);
      for (const step of nextScenario!.steps) validatePatchDelta(project, [], step.patches);
      continue;
    }
    if (!nextScenario) {
      validatePatchDelta(project, oldScenario.patches, []);
      for (const step of oldScenario.steps) validatePatchDelta(project, step.patches, []);
      continue;
    }
    validatePatchDelta(project, oldScenario.patches, nextScenario.patches);
    const oldSteps = new Map(oldScenario.steps.map((step) => [step.id, step])); const nextSteps = new Map(nextScenario.steps.map((step) => [step.id, step]));
    const stepIds = new Set([...oldSteps.keys(), ...nextSteps.keys()]);
    for (const stepId of stepIds) validatePatchDelta(project, oldSteps.get(stepId)?.patches ?? [], nextSteps.get(stepId)?.patches ?? []);
  }
}

function replaceStoryScenarios(project: EditorProject, scenarios: readonly StoryScenario[]): EditorProject {
  const current = existingScenarios(project);
  const baseline = storyDataSchema.safeParse(current.story);
  if (!baseline.success) fail(baseline.error.issues[0]?.message ?? "existing story is invalid");
  const candidate = scenarios.map((entry) => canonicalScenario(project, entry));
  candidate.forEach(validateScenarioShape);
  const parsed = storyDataSchema.safeParse({ ...baseline.data, scenarios: candidate });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "invalid scenarios");
  validateScenarioDelta(project, baseline.data.scenarios, parsed.data.scenarios);
  return { ...project, story: parsed.data };
}

/** Replace the complete scenario collection while preserving geometry and validating effect deltas. */
export function replaceProjectScenarios(project: EditorProject, scenarios: readonly StoryScenario[]): EditorProject {
  return replaceStoryScenarios(project, scenarios);
}

/** Replace one exact scenario container. Metadata and step ordering are freely editable. */
export function replaceScenario(project: EditorProject, next: StoryScenario): EditorProject {
  const current = scenario(project, next.id);
  const scenarios = current.story.scenarios.map((entry) => entry.id === next.id ? next : entry);
  return replaceStoryScenarios(project, scenarios);
}

/** Remove exactly one patch from exactly the requested scenario container. */
export function removeScenarioEffect(project: EditorProject, scenarioId: string, patchId: string, stepId?: string): EditorProject {
  const result = scenario(project, scenarioId); const steps = result.value.steps; const matchingSteps = stepId ? steps.filter(({ id }) => id === stepId) : [];
  if (stepId && matchingSteps.length > 1) fail(`step ${stepId} is ambiguous in scenario ${scenarioId}`);
  const step = matchingSteps[0];
  if (stepId && !step) fail(`step ${stepId} does not belong to scenario ${scenarioId}`);
  const patches = step ? step.patches : result.value.patches; const matchingPatches = patches.filter(({ id }) => id === patchId);
  if (matchingPatches.length > 1) fail(`patch ${patchId} is ambiguous in the requested scenario container`);
  const index = patches.findIndex(({ id }) => id === patchId);
  if (index < 0) fail(`patch ${patchId} does not belong to the requested scenario container`);
  const nextScenario = copy(result.value);
  if (step) { const nextStep = nextScenario.steps.find(({ id }) => id === step.id)!; nextStep.patches.splice(index, 1); }
  else nextScenario.patches.splice(index, 1);
  return replaceScenario(project, nextScenario);
}

/** Update scenario steps without touching geometry; callers wrap this in EditorSession transactions. */
export function updateScenarioStep(project: EditorProject, scenarioId: string, command: ScenarioStepCommand): EditorProject {
  const result = scenario(project, scenarioId); const next = copy(result.value);
  if (command.kind === "add") {
    if (next.steps.some(({ id }) => id === command.step.id)) fail(`step ${command.step.id} already exists`);
    const at = command.position === undefined ? next.steps.length : command.position;
    if (!Number.isInteger(at) || at < 0 || at > next.steps.length) fail(`step position ${at} is out of range`);
    next.steps.splice(at, 0, copy(command.step));
  } else if (command.kind === "remove") {
    const index = next.steps.findIndex(({ id }) => id === command.stepId); if (index < 0) fail(`step ${command.stepId} does not belong to scenario ${scenarioId}`); next.steps.splice(index, 1);
  } else if (command.kind === "move") {
    const index = next.steps.findIndex(({ id }) => id === command.stepId); if (index < 0) fail(`step ${command.stepId} does not belong to scenario ${scenarioId}`);
    if (!Number.isInteger(command.position) || command.position < 0 || command.position >= next.steps.length) fail(`step position ${command.position} is out of range`);
    const [moved] = next.steps.splice(index, 1); next.steps.splice(command.position, 0, moved!);
  } else {
    const current = next.steps.find(({ id }) => id === command.stepId); if (!current) fail(`step ${command.stepId} does not belong to scenario ${scenarioId}`);
    Object.assign(current, copy(command.changes));
  }
  return replaceScenario(project, next);
}

export function reorderScenarioStep(project: EditorProject, scenarioId: string, stepId: string, direction: -1 | 1): EditorProject {
  const result = scenario(project, scenarioId); const index = result.value.steps.findIndex(({ id }) => id === stepId); if (index < 0) fail(`step ${stepId} does not belong to scenario ${scenarioId}`);
  const at = index + direction; if (at < 0 || at >= result.value.steps.length) return project;
  return updateScenarioStep(project, scenarioId, { kind: "move", stepId, position: at });
}
