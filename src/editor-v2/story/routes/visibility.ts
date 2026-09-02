import type { EditorProject } from "../../model/project-model";
import type { StoryRouteAlternative, StoryRouteRequest } from "./types";

/** Matches the map overlay's definition of a route segment visible on a sheet. */
export function storyRouteSegmentVisibleOnPlace(project: EditorProject, activePlaceId: string, segment: StoryRouteAlternative["segments"][number]) {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = project.places.find(({ id }) => id === segment.placeId);
  if (!active || !owner) return false;
  const levelId = active.kind === "room" || active.kind === "standalone-room" ? active.parentId : active.id;
  if (segment.kind === "indoor" || segment.kind === "transition") return segment.levelId === levelId || segment.placeId === levelId;
  return active.kind === "world" || active.kind === "location" || segment.placeId === activePlaceId;
}

/** An endpoint is visible when its owning outdoor place or construction level has a visible segment. */
export function storyRouteEndpointVisibleOnPlace(project: EditorProject, activePlaceId: string, alternative: StoryRouteAlternative, endpoint: StoryRouteRequest["from"]) {
  const endpointLevelId = endpointLevel(project, endpoint);
  return alternative.segments.some((segment) => storyRouteSegmentVisibleOnPlace(project, activePlaceId, segment)
    && (segment.kind === "indoor" || segment.kind === "transition" ? segment.levelId === endpointLevelId || segment.placeId === endpointLevelId : segment.placeId === endpoint.placeId));
}

function endpointLevel(project: EditorProject, endpoint: StoryRouteRequest["from"]) {
  const explicit = endpoint.levelId && project.places.some(({ id, kind }) => id === endpoint.levelId && kind === "level") ? endpoint.levelId : undefined;
  if (explicit) return explicit;
  const visited = new Set<string>(); let current = project.places.find(({ id }) => id === endpoint.placeId);
  while (current && !visited.has(current.id)) {
    if (current.kind === "level") return current.id;
    visited.add(current.id); current = current.parentId ? project.places.find(({ id }) => id === current!.parentId) : undefined;
  }
  return undefined;
}
