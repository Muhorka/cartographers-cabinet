import type { EditorProject } from "../model/project-model";

/** Patch text against the current transaction, never a stale render's geometry. */
export function updateNoteText(project: EditorProject, id: string, text: string): EditorProject {
  return { ...project, elements: project.elements.map((element) => element.id === id && !element.locked && element.geometry.kind === "note"
    ? { ...element, geometry: { ...element.geometry, text } } : element) };
}
