import { memo } from "react";
import type { EditorProject } from "../model/project-model";
import type { StoryRouteRecord } from "../story/routes/types";
import type { StoryViewContext } from "../story/types";
import { isStoryRouteCurrent } from "../story/routes/revision";
import { matrixAttribute, pointsPath, relativePlaceMatrix } from "./map-sheet-geometry";
import { storyRouteSegmentVisibleOnPlace } from "../story/routes/visibility";

type StoryRouteOverlayProps = {
  project: EditorProject;
  activePlaceId: string;
  context: Pick<StoryViewContext, "scenarioId" | "stepId">;
  route?: StoryRouteRecord;
};

export const StoryRouteOverlay = memo(function StoryRouteOverlay({ project, activePlaceId, context, route }: StoryRouteOverlayProps) {
  if (!route || !isStoryRouteCurrent(project, route)) return null;
  if (route.query.scenarioId !== context.scenarioId || route.query.stepId !== context.stepId) return null;
  const colors = ["#953d30", "#28717a", "#77508d"];
  return <g aria-hidden="true" pointerEvents="none" data-story-routes="true">{route.result.routes.flatMap((alternative, alternativeIndex) => alternative.segments.map((segment, index) => {
    if (!storyRouteSegmentVisibleOnPlace(project, activePlaceId, segment)) return null;
    return <path key={`${alternative.id}:${index}`} transform={matrixAttribute(relativePlaceMatrix(project, activePlaceId, segment.placeId))} d={pointsPath(segment.points, false)} fill="none" stroke={colors[alternativeIndex % colors.length]} strokeWidth={2.5} strokeDasharray="7 4" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>;
  }))}</g>;
}, (previous, next) => previous.project === next.project && previous.activePlaceId === next.activePlaceId && previous.route === next.route && previous.context.scenarioId === next.context.scenarioId && previous.context.stepId === next.context.stepId);
