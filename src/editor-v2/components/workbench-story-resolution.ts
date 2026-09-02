import type { EditorProject } from "../model/project-model";
import { workbenchCopy } from "../i18n/workbench-copy";
import { allStoryObjectRefs } from "../story/project-adapter";
import { createProjectStoryObjectResolver } from "../story/project-effective";
import { storyObjectDisplayName } from "../story/object-display-name";
import type { StoryObjectRef, StoryViewContext } from "../story/types";

type Locale = keyof typeof workbenchCopy;
type ProjectStoryResolver = ReturnType<typeof createProjectStoryObjectResolver>;
type ResolvedProjectStoryObject = NonNullable<ReturnType<ProjectStoryResolver>> & { name: string };

function sameContext(first: StoryViewContext, second: StoryViewContext) {
  return first.scenarioId === second.scenarioId && first.stepId === second.stepId && first.lensId === second.lensId;
}

/**
 * Creates one read batch for a project snapshot, but does not hydrate the whole
 * object catalog until a consumer actually needs it. Drawing can therefore
 * resolve only the selected object while Story mode and zone editors retain the
 * complete catalog.
 */
export function createWorkbenchStoryResolution(
  project: EditorProject,
  context: StoryViewContext,
  inspectorContext: StoryViewContext,
  locale: Locale,
) {
  const refs = allStoryObjectRefs(project);
  const primaryResolver = createProjectStoryObjectResolver(project, context);
  const sharedContext = sameContext(context, inspectorContext);
  const inspectorResolver = sharedContext ? primaryResolver : createProjectStoryObjectResolver(project, inspectorContext);
  const decorate = (value: NonNullable<ReturnType<ProjectStoryResolver>>): ResolvedProjectStoryObject => ({
    ...value,
    name: storyObjectDisplayName(project, value, workbenchCopy[locale].objectList),
  });
  const resolveOne = (resolver: ProjectStoryResolver, ref: StoryObjectRef) => {
    const value = resolver(ref);
    return value ? decorate(value) : undefined;
  };
  let resolvedObjects: ResolvedProjectStoryObject[] | undefined;
  let resolvedInspectorObjects: ResolvedProjectStoryObject[] | undefined;
  const resolveObjects = () => {
    resolvedObjects ??= refs.flatMap((ref) => {
      const value = resolveOne(primaryResolver, ref);
      return value ? [value] : [];
    });
    return resolvedObjects;
  };
  const resolveInspectorObjects = () => {
    if (sharedContext) return resolveObjects();
    resolvedInspectorObjects ??= refs.flatMap((ref) => {
      const value = resolveOne(inspectorResolver, ref);
      return value ? [value] : [];
    });
    return resolvedInspectorObjects;
  };
  return {
    resolve: (ref: StoryObjectRef) => resolveOne(inspectorResolver, ref),
    resolveObjects,
    resolveInspectorObjects,
  };
}
