import { cloneImportedProject, parseProjectFile } from "./project-file";
import { storyRouteRevision } from "../story/routes/revision";

const EXAMPLE_PROJECT_URL = "/examples/residence-of-the-silver-lindens.cartographer.json";

export async function loadExampleProject(projectId: string, fetchProject: typeof fetch = fetch) {
  const response = await fetchProject(EXAMPLE_PROJECT_URL);
  if (!response.ok) throw new Error(`Could not load the example project (${response.status}).`);
  const { project } = parseProjectFile(await response.text());
  const templateRevision = storyRouteRevision(project);
  const cloned = cloneImportedProject(project, projectId);
  const cloneRevision = storyRouteRevision(cloned);
  const routes = cloned.story.routes.map((record) => {
    if (record.sourceRevision !== templateRevision || record.result.sourceRevision !== templateRevision) return record;
    const resultRoutes = record.result.routes.map((route) => ({ ...route, sourceRevision: cloneRevision }));
    const resultRoute = record.result.route ? { ...record.result.route, sourceRevision: cloneRevision } : undefined;
    return { ...record, sourceRevision: cloneRevision, result: { ...record.result, sourceRevision: cloneRevision, routes: resultRoutes, ...(resultRoute ? { route: resultRoute } : {}) } };
  });
  return { ...cloned, story: { ...cloned.story, routes } };
}
