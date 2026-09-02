import type { EditorProject } from "../model/project-model";
import { loadExampleProject } from "../persistence/example-project";
import { getPreference, scanProjectLibrary, saveProject } from "../persistence/project-library";
import { makeSession, viewportFor } from "./workbench-helpers";

/** One restoration path for startup, library selection and imports. Never replaces a failed save. */
export async function restoreWorkbenchProject(project: EditorProject, locale: "pl" | "en") {
  const keys = ["activePlaceId", "sketchVisible", "sketchOpacity", "eraserSize", "gapClosingEnabled", "gapClosingTolerance"];
  const [preferred, visible, opacity, eraser, closing, tolerance] = await Promise.all(keys.map((key) => getPreference(`${key}:${project.id}`)));
  const opened = project.places.find(({ id }) => id === preferred) ?? project.places.find(({ parentId }) => !parentId);
  const numeric = (value: string | undefined, fallback: number, minimum: number) => value !== undefined && Number.isFinite(Number(value)) && Number(value) >= minimum ? Number(value) : fallback;
  const session = makeSession(project, opened?.id, locale);
  return { project, session, snapshot: session.getViewState(), viewport: viewportFor(project, opened?.id),
    sketchVisible: visible !== "false", sketchOpacity: numeric(opacity, .75, 0), eraserSize: numeric(eraser, 10, 4),
    gapClosingEnabled: closing === "true", gapClosingTolerance: numeric(tolerance, 14, 4) };
}

export async function loadInitialWorkbenchProject() {
  const stored = await getPreference("locale") ?? localStorage.getItem("cartographer-locale");
  const locale: "pl" | "en" = stored === "pl" ? "pl" : "en";
  const scan = await scanProjectLibrary();
  let projects = scan.projects;
  if (!projects.length && !scan.recoveryRecords.length) projects = [await saveProject(await loadExampleProject(crypto.randomUUID()))];
  const activeId = await getPreference("activeProjectId");
  const activeProject = projects.find(({ id }) => id === activeId) ?? projects[0];
  return { locale, projects, recoveryRecords: scan.recoveryRecords, loaded: activeProject ? await restoreWorkbenchProject(activeProject, locale) : undefined };
}
