import type { EditorProject } from "../model/project-model";
import { saveProject } from "./project-library";

export type AutosaveOutcome = { state: "saved"; project: EditorProject } | { state: "failed" };

/** A failed write must not become an unhandled rejection or a false saved badge. */
export async function autosaveProject(project: EditorProject): Promise<AutosaveOutcome> {
  try { return { state: "saved", project: await saveProject(project) }; }
  catch { return { state: "failed" }; }
}
