import type { EditorProject } from "../../model/project-model";
import { projectRevision } from "../../state/project-revision";

/** Stable route input revision; persisted route records do not invalidate themselves. */
export function storyRouteRevision(project: EditorProject) {
  const story = Object.fromEntries(Object.entries(project.story).filter(([key]) => key !== "routes"));
  return projectRevision({ ...project, story } as EditorProject);
}
