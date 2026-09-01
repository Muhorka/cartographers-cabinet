import type { EditorProject } from "../model/project-model";
import type { StoryViewContext } from "../story/types";
import { storyRefKey } from "../story/types";
import { allStoryObjectRefs } from "../story/project-adapter";
import { createProjectLensEvaluator } from "../story/evaluation";
import { visibleStoryLenses, type StoryLensView } from "../story/lens-view";
import { storyMapPath } from "./story-map-paths";

/** A separate ink overlay: never rewrites the authored fill or changes hit testing. */
export function StoryMapOverlay({ project, activePlaceId, context, zoom, lensView }: {
  project: EditorProject; activePlaceId: string; context: StoryViewContext; zoom: number; lensView?: StoryLensView;
}) {
  const lenses = visibleStoryLenses(project.story.lenses, lensView ?? { activeLensId: context.lensId });
  if (!lenses.length) return null;
  const evaluate = createProjectLensEvaluator(project, project.story, context);
  return <g pointerEvents="none" aria-hidden="true" data-story-overlay="true">{allStoryObjectRefs(project).map((ref) => {
    const matches = lenses.map((lens) => evaluate(lens, ref)).filter(({ match }) => match);
    if (!matches.length) return null;
    const geometry = storyMapPath(project, activePlaceId, ref, zoom); if (!geometry) return null;
    // Interleave colors around the same contour, never stack opaque fills or widen selection.
    return <g key={storyRefKey(ref)} data-lens-matches={matches.map(({ lensId }) => lensId).join(" ")}>{matches.map(({ lensId, color }, index) => <path key={`${lensId}:${index}`} d={geometry.path} transform={geometry.transform} fill={matches.length === 1 && geometry.closed ? color : "none"} fillOpacity={.13} stroke={color} strokeOpacity={.85} strokeWidth={2.5} strokeDasharray={matches.length > 1 ? `6 ${6 * (matches.length - 1)}` : undefined} strokeDashoffset={matches.length > 1 ? -6 * index : undefined} vectorEffect="non-scaling-stroke"/>)}</g>;
  })}</g>;
}
