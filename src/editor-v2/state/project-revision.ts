import type { EditorProject } from "../model/project-model";
import { normalizeStoryZones } from "../story/migration";

/** Autosave timestamps and legacy group-to-zone normalization are not authored changes. */
export function projectRevision(project: EditorProject): string {
  const story = normalizeStoryZones(project.story);
  return `${project.id}:${valueRevision({ ...project, story, updatedAt: undefined })}`;
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
