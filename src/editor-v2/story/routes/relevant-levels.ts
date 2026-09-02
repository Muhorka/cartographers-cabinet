import type { EditorProject } from "../../model/project-model";
import type { StoryRouteRequest } from "./types";

/** Keep every level in an endpoint's vertical-transition component, and no unrelated building. */
export function relevantLevelIds(project: EditorProject, request: StoryRouteRequest) {
  const levels = project.places.filter(({ kind }) => kind === "level");
  const levelIds = new Set(levels.map(({ id }) => id));
  const endpointLevel = (endpoint: StoryRouteRequest["from"]) => {
    if (endpoint.levelId && levelIds.has(endpoint.levelId)) return endpoint.levelId;
    const place = project.places.find(({ id }) => id === endpoint.placeId);
    if (place?.kind === "level") return place.id;
    return place?.parentId && levelIds.has(place.parentId) ? place.parentId : undefined;
  };
  const seeds = [endpointLevel(request.from), endpointLevel(request.to)].filter((id): id is string => Boolean(id));
  if (!seeds.length) return levelIds;

  const adjacency = new Map(levels.map(({ id }) => [id, new Set<string>()]));
  const transitionOwners = new Map<string, Set<string>>();
  for (const level of levels) {
    const document = level.constructionId ? project.constructions.find(({ id }) => id === level.constructionId) : undefined;
    for (const transition of document?.transitions ?? []) {
      const connected = transitionOwners.get(transition.id) ?? new Set<string>();
      connected.add(level.id); transitionOwners.set(transition.id, connected);
      for (const id of [transition.sourceLevelId, transition.targetLevelId, ...(transition.connectedLevelIds ?? [])]) if (id && levelIds.has(id)) connected.add(id);
    }
  }
  for (const connected of transitionOwners.values()) for (const from of connected) for (const to of connected) if (from !== to) adjacency.get(from)?.add(to);
  const relevant = new Set(seeds); const queue = [...seeds];
  for (let index = 0; index < queue.length; index += 1) for (const next of adjacency.get(queue[index]!) ?? []) if (!relevant.has(next)) { relevant.add(next); queue.push(next); }
  return relevant;
}
