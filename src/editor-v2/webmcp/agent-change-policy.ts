import type { EditorProject } from "../model/project-model";
import { sameJsonValue, stableJsonStringify } from "../model/json-value";
import { allStoryObjectRefs, resolveStoryObject } from "../story/project-adapter";
import { projectStoryObjectTarget } from "../story/story-locks";
import { storyRefKey, type StoryObjectRef } from "../story/types";

/** Reject an attempted write even when a drawing operation would silently leave a lock unchanged. */
export function assertAgentEditableTarget(project: EditorProject, ref: StoryObjectRef) {
  const target = resolveStoryObject(project, project.story, ref);
  if (target?.editor.locked) throw new Error(`Object is locked for editing: ${storyRefKey(target.ref)}`);
}

function records(project: EditorProject) {
  return [
    ...project.places.map((value) => ({ key: `place:${value.id}`, value })),
    ...project.elements.map((value) => ({ key: `element:${value.id}`, value })),
    ...project.surfaces.map((value) => ({ key: `surface:${value.id}`, value })),
    ...project.constructions.flatMap((document) => (["walls", "rooms", "openings", "transitions"] as const)
      .flatMap((kind) => document[kind].map((value) => ({ key: `${kind}:${document.id}:${value.id}`, value })))),
  ];
}

function annotationValues(project: EditorProject) {
  const values = new Map<string, string[]>();
  for (const item of project.story.objects) {
    const resolved = resolveStoryObject(project, project.story, item.ref);
    const target = resolved ? { status: "resolved" as const, ref: resolved.ref } : projectStoryObjectTarget(project, item.ref);
    const refs = target.status === "resolved"
      ? [target.ref]
      : target.status === "ambiguous"
        ? allStoryObjectRefs(project).filter((candidate) => candidate.kind === target.ref.kind && candidate.id === target.ref.id)
        : [];
    for (const ref of refs) {
      const serialized = stableJsonStringify(item.metadata);
      if (serialized === undefined) continue;
      const key = storyRefKey(ref);
      values.set(key, [...(values.get(key) ?? []), serialized]);
    }
  }
  for (const [key, entries] of values) values.set(key, entries.toSorted());
  return values;
}

/** Shared guard for every agent entry point. Unlock alone is allowed; unlock-and-edit is not. */
export function assertAgentLocks(before: EditorProject, after: EditorProject) {
  const next = new Map(records(after).map(({ key, value }) => [key, value]));
  for (const { key, value } of records(before)) {
    if (!value.locked) continue;
    const candidate = next.get(key);
    if (!candidate || !sameJsonValue({ ...value, locked: undefined }, { ...candidate, locked: undefined })) {
      throw new Error(`Object is locked for editing: ${key}`);
    }
  }
  const previousAnnotations = annotationValues(before); const nextAnnotations = annotationValues(after);
  for (const ref of allStoryObjectRefs(before)) {
    if (!resolveStoryObject(before, before.story, ref)?.editor.locked) continue;
    const key = storyRefKey(ref);
    if (!sameJsonValue(previousAnnotations.get(key) ?? [], nextAnnotations.get(key) ?? [])) throw new Error(`Object is locked for editing: ${key}`);
  }
}

export function agentSafetyReasons(before: EditorProject, after: EditorProject, targetCount = 0): string[] {
  const reasons = new Set<string>();
  if (targetCount >= 5) reasons.add("many-targets");
  for (const old of before.places) {
    const next = after.places.find(({ id }) => id === old.id);
    if (!next && (before.places.some(({ parentId }) => parentId === old.id)
      || before.elements.some(({ belongsToId }) => belongsToId === old.id)
      || before.surfaces.some(({ belongsToId }) => belongsToId === old.id))) reasons.add("container-contents");
    if ((old.kind === "building" || old.kind === "level") && (!next || !sameJsonValue(old.boundary, next.boundary))) reasons.add("structural-outline");
  }
  for (const old of before.constructions) {
    const next = after.constructions.find(({ id }) => id === old.id);
    const topology = (rooms: typeof old.rooms) => rooms.map(({ id, faceId }) => ({ id, faceId }));
    if (!next || !sameJsonValue(topology(old.rooms), topology(next.rooms))) reasons.add("room-topology");
  }
  return [...reasons];
}
