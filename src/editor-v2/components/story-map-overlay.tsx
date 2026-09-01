import type { EditorProject } from "../model/project-model";
import type { StoryViewContext } from "../story/types";
import { storyRefKey } from "../story/types";
import { allStoryObjectRefs } from "../story/project-adapter";
import { evaluateProjectLens } from "../story/evaluation";
import { storyMapPath } from "./story-map-paths";

/** A separate ink overlay: never rewrites the authored fill or changes hit testing. */
export function StoryMapOverlay({ project, activePlaceId, context, zoom }: {
  project: EditorProject; activePlaceId: string; context: StoryViewContext; zoom: number;
}) {
  if (!context.lensId) return null;
  return <g pointerEvents="none" aria-hidden="true" data-story-overlay="true">{allStoryObjectRefs(project).map((ref) => {
    const result = context.lensId ? evaluateProjectLens(project, project.story, context.lensId, ref, context) : undefined;
    if (!result?.match) return null;
    const geometry = storyMapPath(project, activePlaceId, ref, zoom); if (!geometry) return null;
    const color = result.color;
    return <path key={storyRefKey(ref)} d={geometry.path} transform={geometry.transform} fill={geometry.closed ? color : "none"} fillOpacity={.13} stroke={color} strokeOpacity={.85} strokeWidth={2.5} vectorEffect="non-scaling-stroke"/>;
  })}</g>;
}
