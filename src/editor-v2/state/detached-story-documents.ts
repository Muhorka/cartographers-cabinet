import type { EditorProject } from "../model/project-model";
import { storyCollectionSchemas } from "../story/schema";
import { immutableSnapshot } from "./immutable-snapshot";

function installDocuments(project: EditorProject, documents: EditorProject["story"]["documents"]) {
  const nextDocuments = immutableSnapshot(documents, project.story.documents);
  if (nextDocuments === project.story.documents) return project;
  const story = immutableSnapshot({ ...project.story, documents: nextDocuments }, project.story);
  return immutableSnapshot({ ...project, story }, project);
}

/** Validate only the detached notebook branch instead of rebuilding the whole map. */
export function replaceDetachedStoryDocuments(project: EditorProject, documents: EditorProject["story"]["documents"]) {
  const parsed = storyCollectionSchemas.documents.safeParse(documents);
  return parsed.success
    ? { project: installDocuments(project, parsed.data) }
    : { project, reason: parsed.error.issues.map(({ message }) => message).join("; ") };
}

/** Global project history changes keep the notebook currently visible to the writer. */
export function carryDetachedStoryDocuments(project: EditorProject, documents: EditorProject["story"]["documents"]) {
  return installDocuments(project, documents);
}
