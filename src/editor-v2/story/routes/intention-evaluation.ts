import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import SnapIfNeededOverlayOp from "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js";
import { roomFaceShape } from "../../geometry/room-face-shape";
import { pointInRegion, regionGeoJson } from "../../geometry/region-constraints";
import { sampleBezier } from "../../geometry/bezier-geometry";
import { relativePlaceMatrix, transformDrawingGeometry, transformRegion } from "../../geometry/affine-transform";
import type { RegionShape, EditorProject, DrawingElement } from "../../model/project-model";
import { constructionNetwork } from "../../construction/construction-network";
import type { StoryObjectRef, StoryZone } from "../types";
import type { StoryRouteAlternative, StoryRouteResult } from "./types";

type Point = { x: number; y: number };
const reader = new GeoJSONReader(new GeometryFactory());
type ProofGeometry = { kind: "area"; shape: RegionShape } | { kind: "line"; points: Point[] };

function elementGeometry(element: DrawingElement, project: EditorProject, placeId: string): ProofGeometry | undefined {
  const place = project.places.find(({ id }) => id === placeId); const owner = project.places.some(({ id }) => id === element.belongsToId) ? element.belongsToId : place?.id;
  if (!place || !owner || !isDescendant(project, place.id, owner)) return undefined;
  const geometry = transformDrawingGeometry(relativePlaceMatrix(project, place.id, owner), element.geometry);
  if (geometry.kind === "region") return { kind: "area", shape: geometry.shape };
  if (geometry.kind === "path") return geometry.points.length > 1 ? { kind: "line", points: geometry.points } : undefined;
  if (geometry.kind === "bezier") { const points = sampleBezier(geometry.nodes, false); return points.length > 1 ? { kind: "line", points } : undefined; }
  return undefined;
}

function pointsIntersectGeometry(points: Point[], geometry: ProofGeometry) {
  if (geometry.kind === "area" && points.some((point) => pointInRegion(point, geometry.shape))) return true;
  const target = reader.read(geometry.kind === "area" ? regionGeoJson(geometry.shape) : { type: "LineString", coordinates: geometry.points.map(({ x, y }) => [x, y]) });
  for (let index = 0; index + 1 < points.length; index += 1) {
    const line = reader.read({ type: "LineString", coordinates: [[points[index]!.x, points[index]!.y], [points[index + 1]!.x, points[index + 1]!.y]] });
    if (!SnapIfNeededOverlayOp.intersection(line, target).isEmpty()) return true;
  }
  return false;
}

function isDescendant(project: EditorProject, placeId: string, ownerId: string) {
  const byId = new Map(project.places.map((place) => [place.id, place])); const seen = new Set<string>(); let current = byId.get(placeId);
  while (current && !seen.has(current.id)) { if (current.id === ownerId) return true; seen.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined; }
  return false;
}

function refMatchesSource(project: EditorProject, ref: StoryObjectRef, segment: StoryRouteAlternative["segments"][number]) {
  if (!(ref.kind === "opening" || ref.kind === "transition" || ref.kind === "element") || segment.sourceId !== ref.id) return false;
  if (!ref.scopeId) return true;
  const place = project.places.find(({ id }) => id === segment.placeId);
  return ref.kind === "element" ? place?.id === ref.scopeId || place?.parentId === ref.scopeId : place?.constructionId === ref.scopeId;
}

function geometryForRef(project: EditorProject, ref: StoryObjectRef, placeId: string): ProofGeometry | undefined {
  if (ref.kind === "place") { const source = project.places.find(({ id }) => id === ref.id); return source?.boundary && source.id && isDescendant(project, placeId, source.id) ? { kind: "area", shape: transformRegion(relativePlaceMatrix(project, placeId, source.id), source.boundary) } : undefined; }
  if (ref.kind === "room") {
    const level = project.places.find(({ kind, constructionId, id }) => kind === "level" && (!ref.scopeId || constructionId === ref.scopeId) && id === placeId);
    const document = level?.constructionId ? project.constructions.find(({ id }) => id === level.constructionId) : undefined;
    const room = document?.rooms.find(({ id }) => id === ref.id); const face = room && constructionNetwork(document!.walls, document!.enclosure).faces.find(({ id }) => id === room.faceId);
    return face ? { kind: "area", shape: roomFaceShape(face) } : undefined;
  }
  if (ref.kind === "element") { const element = project.elements.find(({ id }) => id === ref.id); return element ? elementGeometry(element, project, placeId) : undefined; }
  return undefined;
}

function zoneShape(project: EditorProject, zone: StoryZone, placeId: string) {
  if (!zone.shape || !zone.ownerPlaceId || !project.places.some(({ id }) => id === zone.ownerPlaceId) || !isDescendant(project, placeId, zone.ownerPlaceId)) return undefined;
  return transformRegion(relativePlaceMatrix(project, placeId, zone.ownerPlaceId), zone.shape);
}

function routePassesRef(project: EditorProject, route: StoryRouteAlternative, ref: StoryObjectRef) {
  return route.segments.some((segment) => {
    if (refMatchesSource(project, ref, segment)) return true;
    const geometry = geometryForRef(project, ref, segment.placeId);
    return Boolean(geometry && pointsIntersectGeometry(segment.points, geometry));
  });
}

function routeTouchesZone(project: EditorProject, route: StoryRouteAlternative, zone: StoryZone) {
  return route.segments.some((segment) => { const shape = zoneShape(project, zone, segment.placeId); return Boolean(shape && pointsIntersectGeometry(segment.points, { kind: "area", shape })); });
}

type StoryIntention = { subject: StoryObjectRef; kind: "reachability" | "must-pass" | "avoid-zone" | "access-rule" | "custom"; through?: StoryObjectRef[]; avoidZoneId?: string };
export type StoryIntentionCheck = { status: "satisfied" | "conditional" | "blocked" | "unknown" | "needs-author-review"; reason: string; evidence?: { routeId?: string; refs?: StoryObjectRef[]; zoneId?: string }; conditions?: string[] };

export function evaluateStoryIntention(project: EditorProject, intention: StoryIntention, result: StoryRouteResult | undefined): StoryIntentionCheck {
  if (!result) return { status: "needs-author-review", reason: "An explicit route query is required." };
  if (result.status !== "ready" || !result.route) return { status: result.status === "unknown" ? "unknown" : "blocked", reason: result.status === "unknown" ? "The route contains unresolved access facts." : "No route satisfies the requested endpoints." };
  const route = result.route;
  if (intention.kind === "must-pass") {
    const refs = intention.through ?? []; if (!refs.length) return { status: "needs-author-review", reason: "must-pass requires at least one explicit object reference." };
    const missing = refs.filter((ref) => !route.segments.some((segment) => refMatchesSource(project, ref, segment) || Boolean(geometryForRef(project, ref, segment.placeId))));
    if (missing.length) return { status: "needs-author-review", reason: "The referenced pass-through geometry is not resolvable in the route coordinate system.", evidence: { routeId: route.id, refs: missing } };
    const failed = refs.filter((ref) => !routePassesRef(project, route, ref)); if (failed.length) return { status: "blocked", reason: "The calculated route does not pass through every required object.", evidence: { routeId: route.id, refs: failed }, conditions: route.conditions };
    return { status: route.conditions.length ? "conditional" : "satisfied", reason: "The calculated route crosses every required object.", evidence: { routeId: route.id, refs }, conditions: route.conditions };
  }
  if (intention.kind === "avoid-zone") {
    const zone = intention.avoidZoneId && project.story.zones.find(({ id }) => id === intention.avoidZoneId); if (!zone || !zone.shape) return { status: "needs-author-review", reason: "The avoid-zone needs an authored shape and owner place." };
    if (!route.segments.some((segment) => zoneShape(project, zone, segment.placeId))) return { status: "needs-author-review", reason: "The avoid-zone is not in the route's authored place hierarchy." };
    if (routeTouchesZone(project, route, zone)) return { status: "blocked", reason: "The calculated route intersects the avoid-zone.", evidence: { routeId: route.id, zoneId: zone.id }, conditions: route.conditions };
    return { status: route.conditions.length ? "conditional" : "satisfied", reason: "The calculated route avoids the authored zone.", evidence: { routeId: route.id, zoneId: zone.id }, conditions: route.conditions };
  }
  return { status: "needs-author-review", reason: "This intention type has no geometry proof in the supplied route result." };
}
