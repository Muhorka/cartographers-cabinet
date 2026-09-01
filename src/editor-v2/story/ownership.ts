import type { EditorProject } from "../model/project-model";
import { canonicalProjectStoryRef, resolveStoryObject, zoneMatchesProject } from "./project-adapter";
import { migrateStoryData } from "./migration";
import { sameStoryRef, type StoryData, type StoryObjectRef, type StoryViewContext } from "./types";

type StoryOwnershipMode = "inherited" | "custom" | "no-owner";
type StoryOwnershipSourceKind = "local" | "scenario" | "step" | "zone" | "inherited";
type StoryOwnershipSource = {
  kind: StoryOwnershipSourceKind;
  ref?: StoryObjectRef;
  name?: string;
  /** When a parent place inherits from a zone, retain the concrete source. */
  via?: StoryOwnershipSource;
  /** All contributing inherited sources when both a parent and a zone apply. */
  sources?: StoryOwnershipSource[];
  zoneId?: string;
};
export type StoryOwnershipResolution = {
  mode: StoryOwnershipMode;
  effectiveOwners: string[];
  directOwners: string[];
  inheritedOwners: string[];
  directPresent: boolean;
  inheritedPresent: boolean;
  source?: StoryOwnershipSource;
  directSource?: StoryOwnershipSource;
  inheritedSource?: StoryOwnershipSource;
};
export type StoryOwnershipReset = {
  ref: StoryObjectRef;
  target?: "base" | "scenario";
  context?: StoryViewContext;
};

type OwnershipLayer = { owners: string[]; source: StoryOwnershipSource };

function hasOwners(value: { owners?: string[] } | undefined): value is { owners: string[] } {
  return Boolean(value && value.owners !== undefined);
}

function worldName(project: EditorProject, id: string | undefined) {
  return id ? project.places.find(({ id: candidate }) => candidate === id)?.name : undefined;
}

function patchLayer(story: StoryData, ref: StoryObjectRef, context: StoryViewContext): OwnershipLayer | undefined {
  const scenario = context.scenarioId ? story.scenarios.find(({ id }) => id === context.scenarioId) : undefined;
  const step = scenario && context.stepId ? scenario.steps.find(({ id }) => id === context.stepId) : undefined;
  const stepPatch = step?.patches.findLast(({ target, metadata }) => sameStoryRef(target, ref) && hasOwners(metadata));
  if (step && stepPatch && hasOwners(stepPatch.metadata)) return { owners: [...stepPatch.metadata.owners], source: { kind: "step", ref: stepPatch.target, name: step.name } };
  const scenarioPatch = scenario?.patches.findLast(({ target, metadata }) => sameStoryRef(target, ref) && hasOwners(metadata));
  if (scenario && scenarioPatch && hasOwners(scenarioPatch.metadata)) return { owners: [...scenarioPatch.metadata.owners], source: { kind: "scenario", ref: scenarioPatch.target, name: scenario.name } };
  return undefined;
}

function localLayer(project: EditorProject, story: StoryData, ref: StoryObjectRef, context: StoryViewContext): OwnershipLayer | undefined {
  const patch = patchLayer(story, ref, context);
  if (patch) return patch;
  const object = story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, ref));
  if (hasOwners(object?.metadata)) return { owners: [...object.metadata.owners], source: { kind: "local", ref, name: resolveStoryObject(project, story, ref)?.name ?? worldName(project, ref.id) } };
  return undefined;
}

function zoneLayer(project: EditorProject, story: StoryData, ref: StoryObjectRef): OwnershipLayer | undefined {
  const canonical = canonicalProjectStoryRef(project, ref);
  const zones = story.zones.filter(({ id, metadata }) => metadata?.owners !== undefined && zoneMatchesProject(project, story, id, canonical).matches);
  if (!zones.length) return undefined;
  return {
    owners: [...new Set<string>(zones.flatMap(({ metadata }) => metadata?.owners ?? []))],
    source: { kind: "zone", zoneId: zones.map(({ id }) => id).join(","), name: zones.map(({ name }) => name).join(", ") },
  };
}

function constructionOwner(project: EditorProject, ref: StoryObjectRef) {
  if (!ref.scopeId || !["wall", "opening", "transition"].includes(ref.kind)) return undefined;
  const construction = project.constructions.find(({ id }) => id === ref.scopeId);
  const owners = construction ? project.places.filter(({ constructionId }) => constructionId === construction.id) : [];
  return owners.length === 1 ? owners[0] : undefined;
}

function parentPlaceId(project: EditorProject, story: StoryData, ref: StoryObjectRef) {
  const resolved = resolveStoryObject(project, story, ref);
  return resolved?.ownerPlaceId ?? constructionOwner(project, ref)?.id;
}

function placeOwnershipLayer(project: EditorProject, story: StoryData, ref: StoryObjectRef, context: StoryViewContext) {
  return localLayer(project, story, ref, context) ?? zoneLayer(project, story, ref);
}

function inheritedLayer(project: EditorProject, story: StoryData, ref: StoryObjectRef, context: StoryViewContext, seen = new Set<string>()): OwnershipLayer | undefined {
  let placeId = parentPlaceId(project, story, ref);
  const directZone = zoneLayer(project, story, ref);
  while (placeId && !seen.has(placeId)) {
    seen.add(placeId);
    const placeRef: StoryObjectRef = { kind: "place", id: placeId };
    const local = placeOwnershipLayer(project, story, placeRef, context);
    if (local) {
      const sources = [local.source, ...(directZone ? [directZone.source] : [])];
      return {
        owners: [...new Set([...local.owners, ...(directZone?.owners ?? [])])],
        source: { kind: "inherited", ref: placeRef, name: worldName(project, placeId), via: local.source, ...(sources.length > 1 ? { sources } : {}) },
      };
    }
    const place = project.places.find(({ id }) => id === placeId);
    placeId = place?.parentId;
  }
  return directZone;
}

/** Resolves ownership without changing access, tags, properties, or geometry inheritance. */
export function resolveStoryOwnership(project: EditorProject, input: StoryData, ref: StoryObjectRef, context: StoryViewContext = {}): StoryOwnershipResolution {
  const story = migrateStoryData(input);
  const canonical = canonicalProjectStoryRef(project, ref);
  if (!resolveStoryObject(project, story, canonical)) return { mode: "no-owner", effectiveOwners: [], directOwners: [], inheritedOwners: [], directPresent: false, inheritedPresent: false };
  const direct = localLayer(project, story, canonical, context);
  const inherited = inheritedLayer(project, story, canonical, context);
  const directOwners = direct?.owners ?? [];
  const inheritedOwners = inherited?.owners ?? [];
  const effectiveOwners = direct ? directOwners : inheritedOwners;
  const mode: StoryOwnershipMode = direct ? directOwners.length ? "custom" : "no-owner" : effectiveOwners.length ? "inherited" : "no-owner";
  return {
    mode, effectiveOwners, directOwners, inheritedOwners,
    directPresent: Boolean(direct), inheritedPresent: Boolean(inherited),
    source: direct?.source ?? inherited?.source,
    directSource: direct?.source,
    inheritedSource: inherited?.source,
  };
}

function patchIsEmpty(patch: StoryData["scenarios"][number]["patches"][number]) { return !Object.prototype.hasOwnProperty.call(patch, "title") && !Object.prototype.hasOwnProperty.call(patch, "description") && !patch.properties && !patch.metadata; }

function removeOwnersFromPatch(patch: StoryData["scenarios"][number]["patches"][number]) {
  if (!patch.metadata || !Object.prototype.hasOwnProperty.call(patch.metadata, "owners")) return patch;
  const metadata = { ...patch.metadata }; delete metadata.owners;
  if (Object.keys(metadata).length) return { ...patch, metadata };
  const next = { ...patch }; delete next.metadata;
  return patchIsEmpty(next) ? undefined : next;
}

/** Removes only the selected ownership override; all other authored metadata is preserved. */
export function resetStoryOwnership(project: EditorProject, command: StoryOwnershipReset): EditorProject {
  const target = command.target ?? (command.context?.scenarioId ? "scenario" : "base");
  const story = migrateStoryData(project.story);
  const ref = canonicalProjectStoryRef(project, command.ref);
  if (target === "base") {
    const objects = story.objects.map((object) => {
      if (!sameStoryRef(canonicalProjectStoryRef(project, object.ref), ref) || !Object.prototype.hasOwnProperty.call(object.metadata, "owners")) return object;
      const metadata = { ...object.metadata }; delete metadata.owners;
      return { ...object, metadata };
    });
    return { ...project, story: { ...story, objects } };
  }
  if (!command.context?.scenarioId) throw new Error("Scenario ownership reset requires a scenario context.");
  const scenario = story.scenarios.find(({ id }) => id === command.context!.scenarioId);
  if (!scenario) throw new Error(`Scenario ${command.context.scenarioId} does not exist.`);
  const step = command.context.stepId ? scenario.steps.find(({ id }) => id === command.context!.stepId) : undefined;
  if (command.context.stepId && !step) throw new Error(`Step ${command.context.stepId} does not belong to scenario ${scenario.id}.`);
  const patchMatches = (patch: StoryData["scenarios"][number]["patches"][number]) => sameStoryRef(canonicalProjectStoryRef(project, patch.target), ref);
  if (step) {
    const steps = scenario.steps.map((candidate) => candidate.id !== step.id ? candidate : { ...candidate, patches: candidate.patches.flatMap((patch) => patchMatches(patch) ? (() => { const next = removeOwnersFromPatch(patch); return next ? [next] : []; })() : [patch]) });
    return { ...project, story: { ...story, scenarios: story.scenarios.map((candidate) => candidate.id === scenario.id ? { ...candidate, steps } : candidate) } };
  }
  const patches = scenario.patches.flatMap((patch) => patchMatches(patch) ? (() => { const next = removeOwnersFromPatch(patch); return next ? [next] : []; })() : [patch]);
  return { ...project, story: { ...story, scenarios: story.scenarios.map((candidate) => candidate.id === scenario.id ? { ...candidate, patches } : candidate) } };
}
