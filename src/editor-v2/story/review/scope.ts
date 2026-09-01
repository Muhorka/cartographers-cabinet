import { constructionNetwork } from "../../construction/construction-network";
import { roomFaceShape } from "../../geometry/room-face-shape";
import { pointInRegion } from "../../geometry/region-constraints";
import type { EditorProject, PlaceNode } from "../../model/project-model";
import { canonicalProjectStoryRef, resolveStoryObject } from "../project-adapter";
import { storyRefKey, type StoryObjectRef } from "../types";
import type { StoryRouteRequest } from "../routes/types";

export type StoryIntention = EditorProject["story"]["intentions"][number];
type IntentionEndpointReason = "endpoint-mismatch" | "endpoint-unresolved" | "target-required";
export type IntentionEndpointValidation = { valid: true } | { valid: false; reason: IntentionEndpointReason };

export function canonicalReviewRef(project: EditorProject, ref: StoryObjectRef) {
  const normalized = canonicalProjectStoryRef(project, ref);
  if (normalized.kind !== "room" || !normalized.scopeId) return normalized;
  // Some persisted room refs use the owning level as scope. Convert that
  // explicit alias to the construction scope only when the level resolves to
  // one construction; this keeps duplicate room ids on different levels apart.
  const level = project.places.find(({ id, kind, constructionId }) => id === normalized.scopeId && kind === "level" && Boolean(constructionId));
  return level?.constructionId ? { ...normalized, scopeId: level.constructionId } : normalized;
}

function uniqueRefs(project: EditorProject, refs: readonly StoryObjectRef[]) {
  return [...new Map(refs.map((ref) => {
    const resolved = canonicalReviewRef(project, ref);
    return [storyRefKey(resolved), resolved] as const;
  })).values()];
}

/** Returns the spatial objects that are relevant to one authored intention. */
export function intentionRefs(project: EditorProject, intention: StoryIntention): StoryObjectRef[] {
  const refs: StoryObjectRef[] = [intention.subject];
  if (intention.target) refs.push(intention.target);
  if (intention.through) refs.push(...intention.through);
  if (intention.avoidZoneId) {
    const zone = project.story.zones.find(({ id }) => id === intention.avoidZoneId);
    if (zone?.ownerPlaceId) refs.push({ kind: "place", id: zone.ownerPlaceId });
    if (zone) refs.push(...zone.members.map(({ ref }) => ref));
  }
  return uniqueRefs(project, refs);
}

/** Filters intentions by exact canonical references. An omitted scope means all intentions. */
export function intentionsForScope(project: EditorProject, refs?: readonly StoryObjectRef[]): StoryIntention[] {
  if (refs === undefined) return [...project.story.intentions];
  if (!refs.length) return [];
  const scope = new Set(uniqueRefs(project, refs).map(storyRefKey));
  return project.story.intentions.filter((intention) => intentionRefs(project, intention).some((ref) => scope.has(storyRefKey(ref))));
}

function constructionIdForRoomPlace(project: EditorProject, place: PlaceNode) {
  if (place.constructionId) return place.constructionId;
  return project.places.find(({ id }) => id === place.parentId)?.constructionId;
}

function isRoomPlace(place: PlaceNode): boolean {
  return place.kind === "room" || place.kind === "standalone-room";
}

function levelForRoomPlace(project: EditorProject, place: PlaceNode) {
  const parent = place.parentId ? project.places.find(({ id }) => id === place.parentId) : undefined;
  return parent?.kind === "level" ? parent : undefined;
}

function roomEndpoint(project: EditorProject, ref: StoryObjectRef, endpoint: StoryRouteRequest["from"]): IntentionEndpointReason | undefined {
  const roomPlaces = project.places.filter((place) => isRoomPlace(place) && place.id === ref.id && (
    ref.scopeId === place.id || ref.scopeId === `place:${place.id}` || ref.scopeId === constructionIdForRoomPlace(project, place)
  ));
  if (endpoint.placeId === ref.id) {
    // A room-place endpoint is already in the room's own local frame. This
    // path also covers standalone room places with no construction document.
    if (roomPlaces.length !== 1 || !roomPlaces[0]?.boundary) return "endpoint-unresolved";
    const level = levelForRoomPlace(project, roomPlaces[0]);
    if (endpoint.levelId && (!level || endpoint.levelId !== level.id)) return "endpoint-mismatch";
    return pointInRegion(endpoint.point, roomPlaces[0].boundary) ? undefined : "endpoint-mismatch";
  }

  const construction = ref.scopeId ? project.constructions.find(({ id }) => id === ref.scopeId) : undefined;
  const room = construction?.rooms.find(({ id }) => id === ref.id);
  const face = room && construction ? constructionNetwork(construction.walls, construction.enclosure).faces.find(({ id }) => id === room.faceId) : undefined;
  if (!construction || !room || !face) return "endpoint-unresolved";

  const levels = project.places.filter((place) => place.kind === "level" && place.constructionId === construction.id);
  // Coordinates are accepted as level-local only. No hierarchy transform is
  // inferred from a different endpoint place or from an absent levelId.
  const level = levels.find(({ id }) => id === endpoint.placeId);
  if (!level) return "endpoint-mismatch";
  if (endpoint.levelId && endpoint.levelId !== level.id) return "endpoint-mismatch";
  return pointInRegion(endpoint.point, roomFaceShape(face)) ? undefined : "endpoint-mismatch";
}

function placeEndpoint(project: EditorProject, ref: StoryObjectRef, endpoint: StoryRouteRequest["from"]): IntentionEndpointReason | undefined {
  const place = project.places.find(({ id }) => id === ref.id);
  if (!place || isRoomPlace(place)) return "endpoint-unresolved";
  if (endpoint.placeId !== ref.id) return "endpoint-mismatch";
  if (place.kind === "level" && endpoint.levelId && endpoint.levelId !== place.id) return "endpoint-mismatch";
  return undefined;
}

function endpointReason(project: EditorProject, ref: StoryObjectRef, endpoint: StoryRouteRequest["from"]): IntentionEndpointReason | undefined {
  const resolved = resolveStoryObject(project, project.story, canonicalReviewRef(project, ref));
  if (!resolved) return "endpoint-unresolved";
  const canonicalRef = resolved.ref;
  if (canonicalRef.kind === "room") return roomEndpoint(project, canonicalRef, endpoint);
  if (canonicalRef.kind === "place") return placeEndpoint(project, canonicalRef, endpoint);
  return "endpoint-unresolved";
}

/** Checks only authored endpoint correspondence; route collision checks stay in the planner. */
export function validateIntentionEndpoints(project: EditorProject, intention: StoryIntention, query: StoryRouteRequest): IntentionEndpointValidation {
  if (!["reachability", "must-pass", "avoid-zone"].includes(intention.kind)) return { valid: true };
  if (intention.kind === "reachability" && !intention.target) return { valid: false, reason: "target-required" };
  const subjectReason = endpointReason(project, intention.subject, query.from);
  if (subjectReason) return { valid: false, reason: subjectReason };
  if (intention.target) {
    const targetReason = endpointReason(project, intention.target, query.to);
    if (targetReason) return { valid: false, reason: targetReason };
  }
  return { valid: true };
}

function routeEndpointGeometryReason(project: EditorProject, endpoint: StoryRouteRequest["from"]): IntentionEndpointReason | undefined {
  const place = project.places.find(({ id }) => id === endpoint.placeId);
  if (!place) return "endpoint-unresolved";
  if (place.kind === "world" || place.kind === "location") {
    if (!place.boundary) return "endpoint-unresolved";
    return pointInRegion(endpoint.point, place.boundary) ? undefined : "endpoint-mismatch";
  }
  if (place.kind === "level") {
    if (endpoint.levelId && endpoint.levelId !== place.id) return "endpoint-mismatch";
    const construction = place.constructionId && project.constructions.find(({ id }) => id === place.constructionId);
    if (!construction) return "endpoint-unresolved";
    try {
      const faces = constructionNetwork(construction.walls, construction.enclosure).faces;
      if (!faces.length) return "endpoint-unresolved";
      return faces.some((face) => pointInRegion(endpoint.point, roomFaceShape(face))) ? undefined : "endpoint-mismatch";
    } catch {
      return "endpoint-unresolved";
    }
  }
  // The route planner consumes level-local indoor points and outdoor points;
  // it has no unambiguous frame for room, building, or other place-local data.
  return "endpoint-unresolved";
}

/** Verifies that both explicit query points have authored geometry the planner can prove. */
export function validateRouteEvidenceGeometry(project: EditorProject, query: StoryRouteRequest): IntentionEndpointValidation {
  const fromReason = routeEndpointGeometryReason(project, query.from);
  if (fromReason) return { valid: false, reason: fromReason };
  const toReason = routeEndpointGeometryReason(project, query.to);
  if (toReason) return { valid: false, reason: toReason };
  return { valid: true };
}
