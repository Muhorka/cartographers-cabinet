import type { ConstructionDocument } from "../../construction/construction-document";
import type { VerticalTransition, WallOpening } from "../../construction/wall-features";
import { constructionNetwork } from "../../construction/construction-network";
import { roomFaceShape } from "../../geometry/room-face-shape";
import { pointInRegion, shapePolygons } from "../../geometry/region-constraints";
import type { EditorProject, PlaceNode } from "../../model/project-model";
import { distance, polylineDistance } from "./geometry";
import { createRoutePathFinder } from "./shortest-path-cache";
import { storyAccessDecision } from "./access";
import { projectRevision } from "../../state/project-revision";
import { findOutdoorRoute } from "./outdoor";
import { applyAffinePoint, relativePlaceMatrix } from "../../geometry/affine-transform";
import type { StoryAccessContext, StoryRouteAlternative, StoryRouteOptions, StoryRouteRequest, StoryRouteResult, StoryRouteSegment } from "./types";
import { routeWidth } from "./width";
import { faceAnchor } from "./portal-geometry";

type Face = ReturnType<typeof constructionNetwork>["faces"][number];
type LevelSpace = { place: PlaceNode; document: ConstructionDocument; faces: Face[] };
type Node = { id: string; levelId: string; faceId: string; point: { x: number; y: number }; openingId?: string; transitionId?: string; portalPoint?: { x: number; y: number }; conditions?: string[] };
type Edge = { from: string; to: string; distance: number; openingId?: string; transitionId?: string; conditions?: string[]; path?: { x: number; y: number }[] };
type RoutePathFinder = ReturnType<typeof createRoutePathFinder>;

/** Stable route input revision; persisted route records do not invalidate themselves. */
export function storyRouteRevision(project: EditorProject) {
  const story = Object.fromEntries(Object.entries(project.story).filter(([key]) => key !== "routes"));
  return projectRevision({ ...project, story } as EditorProject);
}

function context(request: StoryRouteRequest): StoryAccessContext { return { actorId: request.actorId, scenarioId: request.scenarioId, stepId: request.stepId }; }

function decision(project: EditorProject, options: StoryRouteOptions, entity: Parameters<NonNullable<StoryRouteOptions["access"]>>[0], request: StoryRouteRequest) {
  return options.access?.(entity, context(request)) ?? storyAccessDecision(project, entity, context(request));
}

function accessResult(access: ReturnType<typeof decision>, missing: Set<string>, reasons: Set<string>, fallback: string) {
  if (access === true || typeof access === "boolean" && access) return { allowed: true, conditions: [] as string[] };
  if (typeof access === "boolean") { reasons.add(fallback); return { allowed: false, conditions: [] as string[] }; }
  if (!access.allowed) { if (access.unknown) missing.add(access.reason ?? fallback); else reasons.add(access.reason ?? fallback); return { allowed: false, conditions: [] as string[] }; }
  return { allowed: true, conditions: access.conditions ?? [] };
}

function faceAccess(project: EditorProject, space: LevelSpace, face: Face, request: StoryRouteRequest, options: StoryRouteOptions, missing: Set<string>, reasons: Set<string>) {
  const room = space.document.rooms.find(({ faceId }) => faceId === face.id);
  if (!room) return { allowed: true, conditions: [] as string[] };
  return accessResult(decision(project, options, { kind: "room", id: room.id, scopeId: space.document.id, locked: false }, request), missing, reasons, `Room ${room.id} is not available.`);
}

function openingCentre(document: ConstructionDocument, opening: WallOpening) {
  const wall = document.walls.find(({ id }) => id === opening.wallId); if (!wall) return;
  return { x: wall.start.x + (wall.end.x - wall.start.x) * opening.position, y: wall.start.y + (wall.end.y - wall.start.y) * opening.position };
}

function faceForPoint(space: LevelSpace, point: { x: number; y: number }) {
  return space.faces.filter((face) => pointInRegion(point, roomFaceShape(face))).toSorted((a, b) => a.id.localeCompare(b.id))[0];
}

function openingFaces(space: LevelSpace, opening: WallOpening, point: { x: number; y: number }) {
  const wall = space.document.walls.find(({ id }) => id === opening.wallId); if (!wall) return [] as Face[];
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const length = Math.hypot(dx, dy) || 1;
  const offset = Math.max(.05, wall.thickness * .75); const sides = [{ x: point.x - dy / length * offset, y: point.y + dx / length * offset }, { x: point.x + dy / length * offset, y: point.y - dx / length * offset }];
  const found = sides.map((candidate) => faceForPoint(space, candidate)).filter((face): face is Face => Boolean(face));
  return [...new Map(found.map((face) => [face.id, face])).values()];
}

function addEdge(adjacency: Map<string, Edge[]>, edge: Edge) {
  adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
}

function buildLevelGraph(project: EditorProject, space: LevelSpace, request: StoryRouteRequest, options: StoryRouteOptions, blocked: Set<string>, missing: Set<string>, reasons: Set<string>, findPath: RoutePathFinder) {
  const adjacency = new Map<string, Edge[]>(); const nodes: Node[] = [];
  const width = routeWidth(request);
  for (const face of space.faces) {
    const shape = roomFaceShape(face); const candidates: Node[] = [];
    const roomAccess = faceAccess(project, space, face, request, options, missing, reasons);
    if (!roomAccess.allowed) continue;
    const put = (point: { x: number; y: number }, suffix: string, extra: Partial<Node> = {}) => { const node = { id: `${space.place.id}:${face.id}:${suffix}`, levelId: space.place.id, faceId: face.id, point, ...extra }; nodes.push(node); candidates.push(node); return node; };
    for (const opening of space.document.openings) {
      if (opening.kind === "window" && !request.preferences?.allowWindows) continue;
      const centre = openingCentre(space.document, opening); if (!centre || blocked.has(opening.id)) continue;
      if (opening.width < width) { reasons.add(`Opening ${opening.id} is narrower than the requested ${width} m route.`); continue; }
      const adjacent = openingFaces(space, opening, centre); if (!adjacent.some(({ id }) => id === face.id) || adjacent.length !== 2) continue;
      const access = accessResult(decision(project, options, { kind: "opening", id: opening.id, scopeId: space.document.id, locked: false }, request), missing, reasons, `Opening ${opening.id} is not available.`);
      if (!access.allowed) continue;
      const wall = space.document.walls.find(({ id }) => id === opening.wallId);
      const anchor = wall && faceAnchor(face, centre, wall, width / 2);
      if (!anchor) { reasons.add(`Opening ${opening.id} has no ${width} m clear portal in face ${face.id}.`); continue; }
      put(anchor, `opening:${opening.id}`, { openingId: opening.id, portalPoint: centre, conditions: access.conditions });
    }
    for (const from of candidates) for (const to of candidates) {
      if (from.id >= to.id) continue;
      const route = findPath(shape, from.point, to.point, width / 2);
      if (!route) continue;
      addEdge(adjacency, { from: from.id, to: to.id, distance: route.distance, path: route.points });
      addEdge(adjacency, { from: to.id, to: from.id, distance: route.distance, path: [...route.points].reverse() });
    }
  }
  for (const opening of space.document.openings) {
    const centre = openingCentre(space.document, opening); if (!centre || blocked.has(opening.id) || opening.kind === "window" && !request.preferences?.allowWindows) continue;
    const adjacent = openingFaces(space, opening, centre); if (adjacent.length !== 2) continue;
    const [first, second] = adjacent; const from = `${space.place.id}:${first!.id}:opening:${opening.id}`; const to = `${space.place.id}:${second!.id}:opening:${opening.id}`;
    if (!nodes.some(({ id }) => id === from) || !nodes.some(({ id }) => id === to)) continue;
    const firstNode = nodes.find(({ id }) => id === from); const secondNode = nodes.find(({ id }) => id === to); if (!firstNode || !secondNode) continue;
    const conditions = [...new Set([...(firstNode.conditions ?? []), ...(secondNode.conditions ?? [])])]; const path = [firstNode.point, firstNode.portalPoint ?? centre, secondNode.point];
    addEdge(adjacency, { from, to, distance: polylineDistance(path), openingId: opening.id, conditions, path }); addEdge(adjacency, { from: to, to: from, distance: polylineDistance(path), openingId: opening.id, conditions, path: [...path].reverse() });
  }
  return { adjacency, nodes };
}

function transitionPoint(document: ConstructionDocument, transition: VerticalTransition) {
  const shape = transition.footprint; if (shape.kind === "rectangle") return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  if (shape.kind === "circle") return { x: shape.cx, y: shape.cy }; if (shape.kind === "ellipse") return { x: shape.cx, y: shape.cy };
  if (shape.kind === "polygon") { const sum = shape.points.reduce((result, point) => ({ x: result.x + point.x, y: result.y + point.y }), { x: 0, y: 0 }); return { x: sum.x / shape.points.length, y: sum.y / shape.points.length }; }
  const points = shape.kind === "compound" ? shape.polygons[0]?.outer : shape.kind === "bezier" ? shape.nodes.map(({ anchor }) => anchor) : [];
  if (!points?.length) return undefined; const sum = points.reduce((result, point) => ({ x: result.x + point.x, y: result.y + point.y }), { x: 0, y: 0 }); return { x: sum.x / points.length, y: sum.y / points.length };
}

function routeGraph(project: EditorProject, spaces: LevelSpace[], request: StoryRouteRequest, options: StoryRouteOptions, blocked: Set<string>, missing: Set<string>, reasons: Set<string>, findPath: RoutePathFinder) {
  const graphs = spaces.map((space) => ({ space, ...buildLevelGraph(project, space, request, options, blocked, missing, reasons, findPath) })); const byLevel = new Map(graphs.map((graph) => [graph.space.place.id, graph]));
  const fromSpace = byLevel.get(request.from.levelId ?? request.from.placeId); const toSpace = byLevel.get(request.to.levelId ?? request.to.placeId);
  if (!fromSpace || !toSpace) return undefined;
  const fromFace = faceForPoint(fromSpace.space, request.from.point); const toFace = faceForPoint(toSpace.space, request.to.point); if (!fromFace || !toFace) return undefined;
  if (!faceAccess(project, fromSpace.space, fromFace, request, options, missing, reasons).allowed || !faceAccess(project, toSpace.space, toFace, request, options, missing, reasons).allowed) return undefined;
  const start = { id: `start:${fromSpace.space.place.id}`, levelId: fromSpace.space.place.id, faceId: fromFace.id, point: request.from.point } satisfies Node;
  const goal = { id: `goal:${toSpace.space.place.id}`, levelId: toSpace.space.place.id, faceId: toFace.id, point: request.to.point } satisfies Node;
  const allNodes = graphs.flatMap(({ nodes }) => nodes); allNodes.push(start, goal); const allEdges = new Map<string, Edge[]>();
  for (const graph of graphs) graph.adjacency.forEach((edges, id) => allEdges.set(id, [...(allEdges.get(id) ?? []), ...edges]));
  const connectEndpoint = (node: Node, graph: typeof graphs[number]) => {
    const face = graph.space.faces.find(({ id }) => id === node.faceId); if (!face) return;
    if (!faceAccess(project, graph.space, face, request, options, missing, reasons).allowed) return;
    for (const candidate of graph.nodes.filter(({ faceId }) => faceId === node.faceId)) {
      const local = findPath(roomFaceShape(face), node.point, candidate.point, routeWidth(request) / 2); if (!local) continue;
      addEdge(allEdges, { from: node.id, to: candidate.id, distance: local.distance, path: local.points });
    }
  };
  connectEndpoint(start, fromSpace); connectEndpoint(goal, toSpace);
  if (start.levelId === goal.levelId && start.faceId === goal.faceId) {
    const local = findPath(roomFaceShape(fromFace), start.point, goal.point, routeWidth(request) / 2);
    if (local) addEdge(allEdges, { from: start.id, to: goal.id, distance: local.distance, path: local.points });
  }
  for (const graph of graphs) for (const transition of graph.space.document.transitions) {
    if (transition.sameLevelRise || blocked.has(transition.id)) continue;
    if (request.profile === "vehicle") { reasons.add(`Vehicle profile cannot use transition ${transition.id}.`); continue; }
    if (transition.sourceLevelId && transition.sourceLevelId !== graph.space.place.id) continue;
    const targets = [...new Set(transition.connectedLevelIds ?? [transition.sourceLevelId, transition.targetLevelId].filter((value): value is string => Boolean(value)))].filter((id) => id !== graph.space.place.id);
    const point = transitionPoint(graph.space.document, transition); if (!point) continue;
    const face = faceForPoint(graph.space, point); if (!face) { reasons.add(`Transition ${transition.id} has no valid landing on ${graph.space.place.id}.`); continue; }
    if (!faceAccess(project, graph.space, face, request, options, missing, reasons).allowed) continue;
    const fromNode = graph.nodes.find(({ faceId, transitionId }) => faceId === face.id && transitionId === transition.id) ?? { id: `${graph.space.place.id}:${face.id}:transition:${transition.id}`, levelId: graph.space.place.id, faceId: face.id, point, transitionId: transition.id };
    if (!graph.nodes.some(({ id }) => id === fromNode.id)) graph.nodes.push(fromNode);
    for (const targetId of targets) {
      const targetGraph = byLevel.get(targetId); if (!targetGraph) { reasons.add(`Transition ${transition.id} does not have a connected landing on ${targetId}.`); continue; }
      const targetTransition = targetGraph.space.document.transitions.find(({ id }) => id === transition.id); const targetPoint = targetTransition ? transitionPoint(targetGraph.space.document, targetTransition) : applyAffinePoint(relativePlaceMatrix(project, targetId, graph.space.place.id), point); const targetFace = targetPoint && faceForPoint(targetGraph.space, targetPoint);
      if (!targetGraph || !targetPoint || !targetFace) { reasons.add(`Transition ${transition.id} does not have a connected landing on ${targetId}.`); continue; }
      if (!faceAccess(project, targetGraph.space, targetFace, request, options, missing, reasons).allowed) continue;
      const targetNode = targetGraph.nodes.find(({ faceId, transitionId }) => faceId === targetFace.id && transitionId === transition.id) ?? { id: `${targetId}:${targetFace.id}:transition:${transition.id}`, levelId: targetId, faceId: targetFace.id, point: targetPoint, transitionId: transition.id };
      if (!targetGraph.nodes.some(({ id }) => id === targetNode.id)) targetGraph.nodes.push(targetNode);
      const access = accessResult(decision(project, options, { kind: "transition", id: transition.id, scopeId: graph.space.document.id, locked: false }, request), missing, reasons, `Transition ${transition.id} is not available.`);
      if (!access.allowed) continue;
      addEdge(allEdges, { from: fromNode.id, to: targetNode.id, distance: 0, transitionId: transition.id, conditions: access.conditions });
      addEdge(allEdges, { from: targetNode.id, to: fromNode.id, distance: 0, transitionId: transition.id, conditions: access.conditions });
    }
  }
  // A landing is a real point in a face; connect it to that face's free-space graph.
  for (const graph of graphs) for (const node of graph.nodes.filter(({ transitionId }) => Boolean(transitionId))) {
    const face = graph.space.faces.find(({ id }) => id === node.faceId); if (!face) continue;
    if (!faceAccess(project, graph.space, face, request, options, missing, reasons).allowed) continue;
    for (const candidate of graph.nodes.filter(({ faceId, id }) => faceId === node.faceId && id !== node.id)) {
      const local = findPath(roomFaceShape(face), node.point, candidate.point, routeWidth(request) / 2);
      if (local) { addEdge(allEdges, { from: node.id, to: candidate.id, distance: local.distance, path: local.points }); addEdge(allEdges, { from: candidate.id, to: node.id, distance: local.distance, path: [...local.points].reverse() }); }
    }
  }
  const connectStartGoal = (node: Node) => { const graph = byLevel.get(node.levelId)!; const face = graph.space.faces.find(({ id }) => id === node.faceId)!; if (!faceAccess(project, graph.space, face, request, options, missing, reasons).allowed) return; for (const candidate of graph.nodes.filter(({ faceId }) => faceId === face.id)) { const local = findPath(roomFaceShape(face), node.point, candidate.point, routeWidth(request) / 2); if (!local) continue; addEdge(allEdges, { from: node.id, to: candidate.id, distance: local.distance, path: local.points }); addEdge(allEdges, { from: candidate.id, to: node.id, distance: local.distance, path: [...local.points].reverse() }); } };
  connectStartGoal(start); connectStartGoal(goal);
  const distances = new Map<string, number>([[start.id, 0]]); const previous = new Map<string, Edge>(); const visited = new Set<string>();
  while (true) { const current = [...distances.keys()].filter((id) => !visited.has(id)).toSorted((a, b) => (distances.get(a)! - distances.get(b)!) || a.localeCompare(b))[0]; if (!current) break; visited.add(current); if (current === goal.id) break; for (const edge of allEdges.get(current) ?? []) { if (edge.openingId && blocked.has(edge.openingId) || edge.transitionId && blocked.has(edge.transitionId)) continue; const next = (distances.get(edge.to) ?? Infinity); const candidate = distances.get(current)! + edge.distance; if (candidate < next - 1e-7) { distances.set(edge.to, candidate); previous.set(edge.to, edge); } } }
  if (!distances.has(goal.id)) {
    if (!blocked.size) reasons.add(`No path with ${routeWidth(request)} m clearance was found between the requested endpoints.`);
    return undefined;
  }
  const edges: Edge[] = []; for (let current = goal.id; current !== start.id;) { const edge = previous.get(current); if (!edge) return undefined; edges.unshift(edge); current = edge.from; }
  return { edges, nodes: [...graphs.flatMap(({ nodes }) => nodes), start, goal], distance: distances.get(goal.id)! };
}

function alternativeFromGraph(graph: NonNullable<ReturnType<typeof routeGraph>>, request: StoryRouteRequest) {
  const segments: StoryRouteSegment[] = []; const points: { x: number; y: number }[] = [request.from.point]; const usedOpeningIds: string[] = []; const usedTransitionIds: string[] = []; const conditions = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.conditions) edge.conditions.forEach((condition) => conditions.add(condition));
    if (edge.openingId) {
      usedOpeningIds.push(edge.openingId);
      const from = graph.nodes.find(({ id }) => id === edge.from) as Node | undefined;
      const openingPoints = edge.path ?? []; if (from && openingPoints.length >= 2) { segments.push({ placeId: from.levelId, levelId: from.levelId, kind: "indoor", points: openingPoints, faceId: from.faceId, sourceId: edge.openingId, conditions: edge.conditions?.length ? edge.conditions : undefined }); points.push(...openingPoints.slice(1)); }
      continue;
    }
    if (edge.transitionId) {
      usedTransitionIds.push(edge.transitionId); const from = graph.nodes.find(({ id }) => id === edge.from) as Node | undefined; const to = graph.nodes.find(({ id }) => id === edge.to) as Node | undefined;
      if (from) { segments.push({ placeId: from.levelId, levelId: from.levelId, kind: "transition", points: [from.point], sourceId: edge.transitionId, conditions: edge.conditions?.length ? edge.conditions : undefined }); points.push(from.point); }
      if (to) { segments.push({ placeId: to.levelId, levelId: to.levelId, kind: "transition", points: [to.point], sourceId: edge.transitionId, conditions: edge.conditions?.length ? edge.conditions : undefined }); points.push(to.point); }
      continue;
    }
    const path = edge.path ?? []; if (path.length < 2) continue; const fromNode = graph.nodes.find(({ id }) => id === edge.from); if (!fromNode) continue; const segment = { placeId: fromNode.levelId, levelId: fromNode.levelId, kind: "indoor" as const, points: path, faceId: fromNode.faceId }; segments.push(segment); points.push(...path.slice(1));
  }
  points.push(request.to.point);
  return { id: `route-${usedOpeningIds.join("-") || "direct"}-${usedTransitionIds.join("-") || "level"}`, segments, points, distance: graph.distance, conditions: [...conditions], reasons: [], usedOpeningIds: [...new Set(usedOpeningIds)], usedTransitionIds: [...new Set(usedTransitionIds)] } satisfies StoryRouteAlternative;
}

function buildingEntryRoute(project: EditorProject, spaces: LevelSpace[], request: StoryRouteRequest, options: StoryRouteOptions, missing: Set<string>, reasons: Set<string>, findPath: RoutePathFinder) {
  const endpoint = [request.from, request.to].find(({ placeId }) => spaces.some(({ place }) => place.id === placeId)); const outside = endpoint === request.from ? request.to : endpoint === request.to ? request.from : undefined;
  if (!endpoint || !outside) return undefined;
  const space = spaces.find(({ place }) => place.id === endpoint.placeId); const parentId = space?.place.parentId; const parent = parentId ? project.places.find(({ id }) => id === parentId) : undefined; const outsideOwner = project.places.find(({ id }) => id === outside.placeId); if (!space || !parent || !outsideOwner || !["world", "location"].includes(outsideOwner.kind)) return undefined;
    const levelPoint = endpoint.point; const face = faceForPoint(space, levelPoint); if (!face) return undefined; const roomAccess = faceAccess(project, space, face, request, options, missing, reasons); if (!roomAccess.allowed) return undefined; const width = routeWidth(request); const matrix = relativePlaceMatrix(project, parent.id, space.place.id);
    for (const opening of space.document.openings) {
      if (opening.kind === "window" && !request.preferences?.allowWindows || opening.width < width) continue; const centre = openingCentre(space.document, opening); if (!centre || openingFaces(space, opening, centre).length !== 1) continue;
      const access = accessResult(decision(project, options, { kind: "opening", id: opening.id, scopeId: space.document.id, locked: false }, request), missing, reasons, `Opening ${opening.id} is not available.`); if (!access.allowed) continue;
      const wall = space.document.walls.find(({ id }) => id === opening.wallId); const indoorPoint = wall && faceAnchor(face, centre, wall, width / 2); if (!indoorPoint) { reasons.add(`Opening ${opening.id} has no ${width} m clear portal in face ${face.id}.`); continue; } const indoor = findPath(roomFaceShape(face), levelPoint, indoorPoint, width / 2); if (!indoor) continue;
      const parentCentre = applyAffinePoint(matrix, centre); const parentPoints = parent.boundary ? shapePolygons(parent.boundary).flatMap(({ outer }) => outer) : []; const parentAverage = parentPoints.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 }); const direction = { x: parentCentre.x - (parentAverage.x / (parentPoints.length || 1)), y: parentCentre.y - (parentAverage.y / (parentPoints.length || 1)) }; const length = Math.hypot(direction.x, direction.y) || 1; const exitParent = parentPoints.length ? { x: parentCentre.x + direction.x / length * Math.max(width, .2), y: parentCentre.y + direction.y / length * Math.max(width, .2) } : parentCentre; const outsideMatrix = relativePlaceMatrix(project, outsideOwner.id, parent.id); const outsidePoint = applyAffinePoint(outsideMatrix, exitParent); const outsideCentre = applyAffinePoint(outsideMatrix, parentCentre); const outdoor = findOutdoorRoute(project, { ...request, from: { placeId: outsideOwner.id, point: outside.point }, to: { placeId: outsideOwner.id, point: outsidePoint } }, options); if (!outdoor) continue;
      const indoorPoints = endpoint === request.to ? [...indoor.points].reverse() : indoor.points; const portalPoints = endpoint === request.to ? [centre, ...indoorPoints] : [...indoorPoints, centre]; const indoorSegment: StoryRouteSegment = { placeId: space.place.id, levelId: space.place.id, kind: "indoor", points: portalPoints, faceId: face.id, sourceId: opening.id, conditions: access.conditions.length ? access.conditions : undefined }; const approachPoints = endpoint === request.to ? [outsidePoint, outsideCentre] : [outsideCentre, outsidePoint]; const outdoorApproach: StoryRouteSegment = { placeId: outsideOwner.id, kind: "outdoor", points: approachPoints, sourceId: opening.id }; const outdoorSegments = endpoint === request.to ? outdoor.segments : [...outdoor.segments].reverse().map((segment) => ({ ...segment, points: [...segment.points].reverse() })); const segments = endpoint === request.to ? [...outdoor.segments, outdoorApproach, indoorSegment] : [indoorSegment, outdoorApproach, ...outdoorSegments]; const points = endpoint === request.to ? [...outdoor.points, outsideCentre, ...portalPoints] : [...portalPoints, outsideCentre, ...[...outdoor.points].reverse()];
    return { id: `entry-${opening.id}`, segments, points, distance: outdoor.distance + indoor.distance + distance(outsidePoint, outsideCentre) + distance(indoorPoint, centre), conditions: access.conditions, reasons: [], usedOpeningIds: [opening.id], usedTransitionIds: [] } satisfies StoryRouteAlternative;
  }
  return undefined;
}

function checkEndpointAccess(project: EditorProject, endpoint: StoryRouteRequest["from"], request: StoryRouteRequest, options: StoryRouteOptions, missing: Set<string>, reasons: Set<string>) {
  const chain: PlaceNode[] = []; const seen = new Set<string>(); let current = project.places.find(({ id }) => id === endpoint.placeId);
  while (current && !seen.has(current.id)) { seen.add(current.id); chain.push(current); current = current.parentId ? project.places.find(({ id }) => id === current!.parentId) : undefined; }
  for (const place of chain) {
    const access = decision(project, options, { kind: "place", id: place.id, scopeId: place.parentId ?? place.id, access: place.access, locked: false }, request);
    if (access === true || typeof access === "boolean" && access) continue;
    const reason = typeof access === "boolean" ? `Place ${place.id} is not available.` : access.reason ?? `Place ${place.id} is not available.`;
    if (typeof access !== "boolean" && access.unknown) missing.add(reason); else reasons.add(reason);
    return false;
  }
  return true;
}

export function findStoryRoutes(project: EditorProject, request: StoryRouteRequest, options: StoryRouteOptions = {}): StoryRouteResult {
  const findPath = createRoutePathFinder();
  const revision = Math.max(0, ...project.constructions.map(({ revision }) => revision)); const missing = new Set<string>(); const reasons = new Set<string>(); const routes: StoryRouteAlternative[] = []; const blocked = new Set<string>();
  if (!checkEndpointAccess(project, request.from, request, options, missing, reasons) || !checkEndpointAccess(project, request.to, request, options, missing, reasons)) return { status: missing.size ? "unknown" : "unreachable", revision, sourceRevision: storyRouteRevision(project), routes, missingFacts: [...missing].toSorted(), reasons: [...reasons].toSorted() };
  const sourceRevision = storyRouteRevision(project); const fromPlace = project.places.find(({ id }) => id === request.from.placeId);
  if (fromPlace && request.from.placeId === request.to.placeId && ["world", "location"].includes(fromPlace.kind)) { const outdoor = findOutdoorRoute(project, request, options); if (outdoor) { const route = { ...outdoor, sourceRevision }; return { status: "ready", revision, sourceRevision, routes: [route], route, missingFacts: [...missing].toSorted(), reasons: [...reasons].toSorted() }; } }
  const spaces: LevelSpace[] = project.places.filter(({ kind }) => kind === "level").flatMap((place) => { const document = place.constructionId && project.constructions.find(({ id }) => id === place.constructionId); if (!document) return []; const network = constructionNetwork(document.walls, document.enclosure); return [{ place, document, faces: network.faces }]; });
  for (let index = 0; index < 3; index += 1) { const graph = routeGraph(project, spaces, request, options, blocked, missing, reasons, findPath); if (!graph) break; const alternative = { ...alternativeFromGraph(graph, request), sourceRevision }; if (routes.some(({ id }) => id === alternative.id)) break; routes.push(alternative); const next = alternative.usedOpeningIds.find((id) => !blocked.has(id)) ?? alternative.usedTransitionIds.find((id) => !blocked.has(id)); if (!next) break; blocked.add(next); }
  if (!routes.length && project.places.find(({ id }) => id === request.from.placeId)?.kind && ["world", "location"].includes(project.places.find(({ id }) => id === request.from.placeId)!.kind) && request.from.placeId === request.to.placeId) { const outdoor = findOutdoorRoute(project, request, options); if (outdoor) routes.push({ ...outdoor, sourceRevision }); }
  if (!routes.length) { const entry = buildingEntryRoute(project, spaces, request, options, missing, reasons, findPath); if (entry) routes.push({ ...entry, sourceRevision }); }
  const status = routes.length ? "ready" : missing.size ? "unknown" : "unreachable";
  return { status, revision, sourceRevision, routes, route: routes[0], missingFacts: [...missing].toSorted(), reasons: [...reasons].toSorted() };
}
