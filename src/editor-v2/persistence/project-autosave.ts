import type { EditorProject } from "../model/project-model";
import { ProjectConflictError, persistedProjectRevision, saveProject } from "./project-library";
import { safePersistenceError, type SafePersistenceError } from "./persistence-errors";

export type AutosaveOutcome = { state: "saved"; project: EditorProject; revision?: number } | { state: "conflict"; revision?: number } | { state: "failed"; error: SafePersistenceError };

/** A failed write must not become an unhandled rejection or a false saved badge. */
export async function autosaveProject(project: EditorProject, expectedRevision?: number): Promise<AutosaveOutcome> {
  try {
    const saved = await saveProject(project, expectedRevision);
    const revision = persistedProjectRevision(saved);
    return revision === undefined ? { state: "saved", project: saved } : { state: "saved", project: saved, revision };
  }
  catch (error) {
    if (error instanceof ProjectConflictError) return { state: "conflict", revision: error.actualRevision };
    return { state: "failed", error: safePersistenceError(error) };
  }
}
