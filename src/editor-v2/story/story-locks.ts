import type { EditorProject } from "../model/project-model";
import { allStoryObjectRefs, canonicalProjectStoryRef, resolveStoryObject, type ResolvedStoryObject } from "./project-adapter";
import { projectStoryData } from "./project-effective";
import { sameStoryRef, storyRefKey, type StoryObjectRef } from "./types";

export type StoryObjectTarget =
  | { status: "resolved"; ref: StoryObjectRef; object: ResolvedStoryObject; locked: boolean }
  | { status: "missing"; ref: StoryObjectRef }
  | { status: "ambiguous"; ref: StoryObjectRef };

function roomTargetMatches(ref: StoryObjectRef, candidate: StoryObjectRef) {
  if (candidate.kind !== "room" || ref.kind !== "room" || candidate.id !== ref.id) return false;
  return !ref.scopeId || candidate.scopeId === ref.scopeId;
}

/** Resolve an editor object while preserving the distinction between missing and ambiguous targets. */
export function projectStoryObjectTarget(project: EditorProject, input: StoryObjectRef): StoryObjectTarget {
  const ref = canonicalProjectStoryRef(project, input);
  const story = projectStoryData(project);
  const resolved = resolveStoryObject(project, story, ref);
  if (resolved) return { status: "resolved", ref: resolved.ref, object: resolved, locked: projectStoryObjectLocked(project, resolved.ref, resolved) };

  const candidates = allStoryObjectRefs(project).filter((candidate) => candidate.kind === ref.kind && candidate.id === ref.id &&
    (candidate.kind === "room" ? roomTargetMatches(ref, candidate) : sameStoryRef(candidate, ref)));
  return candidates.length > 1 ? { status: "ambiguous", ref } : { status: "missing", ref };
}

/** Return the native editor lock, including the construction-owned lock for rooms. */
export function projectStoryObjectLocked(project: EditorProject, ref: StoryObjectRef, resolved?: ResolvedStoryObject) {
  const object = resolved ?? resolveStoryObject(project, projectStoryData(project), ref);
  return Boolean(object?.editor.locked);
}

/** Shared strict edit check used by narrative commands. */
export function assertProjectStoryObjectEditable(project: EditorProject, ref: StoryObjectRef, resolved?: ResolvedStoryObject): ResolvedStoryObject {
  const target = projectStoryObjectTarget(project, ref);
  if (target.status === "missing") throw new Error(`object ${storyRefKey(ref)} is missing`);
  if (target.status === "ambiguous") throw new Error(`object ${storyRefKey(ref)} is ambiguous`);
  if (projectStoryObjectLocked(project, target.ref, resolved ?? target.object)) throw new Error(`object ${storyRefKey(target.ref)} is editor-locked`);
  return target.object;
}
