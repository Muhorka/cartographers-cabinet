import { memo } from "react";
import type { EditorProject } from "../model/project-model";
import type { StoryRouteRecord } from "../story/routes/types";
import type { StoryViewContext } from "../story/types";
import { storyRouteRevision } from "../story/routes/planner";
import { matrixAttribute, pointsPath, relativePlaceMatrix } from "./map-sheet-geometry";

type StoryRouteOverlayProps = {
  project: EditorProject;
  activePlaceId: string;
  context: Pick<StoryViewContext, "scenarioId" | "stepId">;
  route?: StoryRouteRecord;
};

export const StoryRouteOverlay = memo(function StoryRouteOverlay({ project, activePlaceId, context, route }: StoryRouteOverlayProps) {
  if (!route || route.sourceRevision !== storyRouteRevision(project)) return null;
  if (route.query.scenarioId !== context.scenarioId || route.query.stepId !== context.stepId) return null;
  const active = project.places.find(({ id }) => id === activePlaceId); const levelId = active?.kind === "room" || active?.kind === "standalone-room" ? active.parentId : active?.id;
  const colors = ["#953d30", "#28717a", "#77508d"];
  return <g aria-hidden="true" pointerEvents="none" data-story-routes="true">{route.result.routes.flatMap((alternative, alternativeIndex) => alternative.segments.map((segment, index) => {
    const owner = project.places.find(({ id }) => id === segment.placeId); if (!owner) return null;
    if (segment.kind === "indoor" || segment.kind === "transition") { if (segment.levelId !== levelId && segment.placeId !== levelId) return null; }
    else if (active?.kind !== "world" && active?.kind !== "location" && segment.placeId !== activePlaceId) return null;
    return <path key={`${alternative.id}:${index}`} transform={matrixAttribute(relativePlaceMatrix(project, activePlaceId, segment.placeId))} d={pointsPath(segment.points, false)} fill="none" stroke={colors[alternativeIndex % colors.length]} strokeWidth={2.5} strokeDasharray="7 4" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>;
  }))}</g>;
}, (previous, next) => previous.project === next.project && previous.activePlaceId === next.activePlaceId && previous.route === next.route && previous.context.scenarioId === next.context.scenarioId && previous.context.stepId === next.context.stepId);
