import type { StoryRouteAlternative, StoryRouteRequest, StoryRouteSegment } from "./types";

type RouteGraphNode = { id: string; levelId: string; faceId: string; point: { x: number; y: number } };
type RouteGraphEdge = { from: string; to: string; openingId?: string; transitionId?: string; conditions?: string[]; path?: { x: number; y: number }[] };
type RouteGraphPath = { edges: RouteGraphEdge[]; nodes: RouteGraphNode[]; distance: number };
type Candidate = { alternative: StoryRouteAlternative; blocked: Set<string>; blockedKey: string };

export function alternativeFromGraph(graph: RouteGraphPath, request: StoryRouteRequest) {
  const segments: StoryRouteSegment[] = []; const points: { x: number; y: number }[] = [request.from.point]; const usedOpeningIds: string[] = []; const usedTransitionIds: string[] = []; const conditions = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.conditions) edge.conditions.forEach((condition) => conditions.add(condition));
    if (edge.openingId) {
      usedOpeningIds.push(edge.openingId);
      const from = graph.nodes.find(({ id }) => id === edge.from);
      const openingPoints = edge.path ?? []; if (from && openingPoints.length >= 2) { segments.push({ placeId: from.levelId, levelId: from.levelId, kind: "indoor", points: openingPoints, faceId: from.faceId, sourceId: edge.openingId, conditions: edge.conditions?.length ? edge.conditions : undefined }); points.push(...openingPoints.slice(1)); }
      continue;
    }
    if (edge.transitionId) {
      usedTransitionIds.push(edge.transitionId); const from = graph.nodes.find(({ id }) => id === edge.from); const to = graph.nodes.find(({ id }) => id === edge.to);
      if (from) { segments.push({ placeId: from.levelId, levelId: from.levelId, kind: "transition", points: [from.point], sourceId: edge.transitionId, conditions: edge.conditions?.length ? edge.conditions : undefined }); points.push(from.point); }
      if (to) { segments.push({ placeId: to.levelId, levelId: to.levelId, kind: "transition", points: [to.point], sourceId: edge.transitionId, conditions: edge.conditions?.length ? edge.conditions : undefined }); points.push(to.point); }
      continue;
    }
    const path = edge.path ?? []; if (path.length < 2) continue; const fromNode = graph.nodes.find(({ id }) => id === edge.from); if (!fromNode) continue; const segment = { placeId: fromNode.levelId, levelId: fromNode.levelId, kind: "indoor" as const, points: path, faceId: fromNode.faceId }; segments.push(segment); points.push(...path.slice(1));
  }
  points.push(request.to.point);
  return { id: `route-${usedOpeningIds.join("-") || "direct"}-${usedTransitionIds.join("-") || "level"}`, segments, points, distance: graph.distance, conditions: [...conditions], reasons: [], usedOpeningIds: [...new Set(usedOpeningIds)], usedTransitionIds: [...new Set(usedTransitionIds)] } satisfies StoryRouteAlternative;
}

/** Enumerate only the requested number of shortest portal-distinct routes. */
export function collectRouteAlternatives(evaluate: (blocked: Set<string>, captureDiagnostics: boolean) => StoryRouteAlternative | undefined, limit = 1) {
  const boundedLimit = Math.max(1, Math.min(3, Math.floor(limit)));
  const routes: StoryRouteAlternative[] = []; const frontier: Candidate[] = []; const seenBlocked = new Set<string>();
  const enqueue = (blocked: Set<string>, captureDiagnostics: boolean) => {
    const alternative = evaluate(blocked, captureDiagnostics); if (!alternative) return;
    frontier.push({ alternative, blocked, blockedKey: [...blocked].toSorted().join("\u0000") });
  };
  const enqueueChildren = ({ alternative, blocked }: Candidate) => {
    for (const resourceId of [...alternative.usedOpeningIds, ...alternative.usedTransitionIds]) {
      const child = new Set(blocked); child.add(resourceId); const key = [...child].toSorted().join("\u0000");
      if (seenBlocked.has(key)) continue;
      seenBlocked.add(key); enqueue(child, false);
    }
  };

  seenBlocked.add(""); enqueue(new Set(), true);
  while (frontier.length && routes.length < boundedLimit) {
    frontier.sort((left, right) => left.alternative.distance - right.alternative.distance || left.alternative.id.localeCompare(right.alternative.id) || left.blockedKey.localeCompare(right.blockedKey));
    const candidate = frontier.shift()!;
    if (!routes.some(({ id }) => id === candidate.alternative.id)) routes.push(candidate.alternative);
    if (routes.length >= boundedLimit) break;
    enqueueChildren(candidate);
  }
  return routes;
}
