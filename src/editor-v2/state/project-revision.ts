import type { EditorProject } from "../model/project-model";
import { normalizeStoryZones } from "../story/migration";
import { isImmutableSnapshot } from "./immutable-snapshot";

const immutableProjectRevisions = new WeakMap<EditorProject, string>();

/** Autosave timestamps and legacy group-to-zone normalization are not authored changes. */
export function projectRevision(project: EditorProject): string {
  const retained = isImmutableSnapshot(project) ? immutableProjectRevisions.get(project) : undefined;
  if (retained) return retained;
  const story = normalizeStoryZones(project.story);
  const revision = `${project.id}:${valueRevision({ ...project, story, updatedAt: undefined })}`;
  if (isImmutableSnapshot(project)) immutableProjectRevisions.set(project, revision);
  return revision;
}

export function valueRevision(value: unknown): string {
  const source = JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([first], [second]) => first.localeCompare(second))) : item);
  let first = 2166136261; let second = 5381;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}:${source.length}`;
}
