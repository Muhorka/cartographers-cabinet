import { memo, useDeferredValue } from "react";
import type { EditorProject } from "../model/project-model";
import type { StoryViewContext } from "../story/types";
import { storyRefKey } from "../story/types";
import { allStoryObjectRefs } from "../story/project-adapter";
import { createProjectLensEvaluator } from "../story/evaluation";
import { visibleStoryLenses, type StoryLensView } from "../story/lens-view";
import { storyMapPath } from "./story-map-paths";

/** A separate ink overlay: never rewrites the authored fill or changes hit testing. */
type StoryMapOverlayProps = {
  project: EditorProject; activePlaceId: string; context: StoryViewContext; zoom: number; lensView?: StoryLensView;
};

export function StoryMapOverlay(props: StoryMapOverlayProps) {
  const layoutZoom = useDeferredValue(props.zoom);
  return <DeferredStoryMapOverlay {...props} zoom={layoutZoom}/>;
}

const DeferredStoryMapOverlay = memo(function DeferredStoryMapOverlay({ project, activePlaceId, context, zoom, lensView }: StoryMapOverlayProps) {
  const lenses = visibleStoryLenses(project.story.lenses, lensView ?? { activeLensId: context.lensId });
  if (!lenses.length) return null;
  const evaluate = createProjectLensEvaluator(project, project.story, context);
  return <g pointerEvents="none" aria-hidden="true" data-story-overlay="true">{allStoryObjectRefs(project).map((ref) => {
    // Resolve visibility/geometry first: most of a large project is outside
    // the active sheet and does not need expensive effective-metadata work.
    const geometry = storyMapPath(project, activePlaceId, ref, zoom); if (!geometry) return null;
    const matches = lenses.map((lens) => evaluate(lens, ref)).filter(({ match }) => match);
    if (!matches.length) return null;
    // Interleave colors around the same contour, never stack opaque fills or widen selection.
    return <g key={storyRefKey(ref)} data-lens-matches={matches.map(({ lensId }) => lensId).join(" ")}>{matches.map(({ lensId, color }, index) => <path key={`${lensId}:${index}`} d={geometry.path} transform={geometry.transform} fill={matches.length === 1 && geometry.closed ? color : "none"} fillOpacity={.13} stroke={color} strokeOpacity={.85} strokeWidth={2.5} strokeDasharray={matches.length > 1 ? `6 ${6 * (matches.length - 1)}` : undefined} strokeDashoffset={matches.length > 1 ? -6 * index : undefined} vectorEffect="non-scaling-stroke"/>)}</g>;
  })}</g>;
}, sameStoryMapOverlay);

function sameStoryMapOverlay(previous: StoryMapOverlayProps, next: StoryMapOverlayProps) {
  return previous.project === next.project && previous.activePlaceId === next.activePlaceId && previous.zoom === next.zoom
    && previous.context.scenarioId === next.context.scenarioId && previous.context.stepId === next.context.stepId && previous.context.lensId === next.context.lensId
    && previous.lensView?.activeLensId === next.lensView?.activeLensId && previous.lensView?.previewLens === next.lensView?.previewLens
    && sameIds(previous.lensView?.activeLensIds, next.lensView?.activeLensIds);
}

function sameIds(previous: readonly string[] | undefined, next: readonly string[] | undefined) {
  if (previous === next) return true;
  if (!previous || !next || previous.length !== next.length) return false;
  return previous.every((id, index) => id === next[index]);
}
