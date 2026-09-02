import { cloneImportedProject, parseProjectFile } from "./project-file";
import { isStoryRouteCurrent, rebaseStoryRouteRecord } from "../story/routes/revision";

const EXAMPLE_PROJECT_URL = "/examples/residence-of-the-silver-lindens.cartographer.json";

export async function loadExampleProject(projectId: string, fetchProject: typeof fetch = fetch) {
  const response = await fetchProject(EXAMPLE_PROJECT_URL);
  if (!response.ok) throw new Error(`Could not load the example project (${response.status}).`);
  const { project } = parseProjectFile(await response.text());
  const currentRouteIds = new Set(project.story.routes.filter((record) => isStoryRouteCurrent(project, record)).map(({ id }) => id));
  const cloned = cloneImportedProject(project, projectId);
  const routes = cloned.story.routes.map((record) => currentRouteIds.has(record.id) ? rebaseStoryRouteRecord(cloned, record) : record);
  return { ...cloned, story: { ...cloned.story, routes } };
}
