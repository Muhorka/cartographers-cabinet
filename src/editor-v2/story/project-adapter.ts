import type { EditorProject, RegionShape } from "../model/project-model";
import { constructionNetwork } from "../construction/construction-network";
import { roomFaceShape } from "../geometry/room-face-shape";
import { sampleBezier } from "../geometry/bezier-geometry";
import { isRibbonElement, ribbonShape } from "../geometry/ribbon-geometry";
import { assessRegionConstraint } from "../geometry/region-constraints";
import { relativePlaceMatrix, transformRegion } from "../geometry/affine-transform";
import { canonicalStoryRef, defaultStoryAccessPolicy, sameStoryRef, storyRefKey, type StoryData, type StoryObjectMetadata, type StoryObjectRef, type StoryZoneRelation } from "./types";
import { migrateStoryData } from "./migration";
import { immutableSnapshot, isImmutableSnapshot } from "../state/immutable-snapshot";

const immutableProjectRefs = new WeakMap<EditorProject, StoryObjectRef[]>();

export type ResolvedStoryObject = {
  ref: StoryObjectRef;
  name: string;
  description?: string;
  editor: { visible: boolean; locked: boolean };
  ownerPlaceId?: string;
  metadata: StoryObjectMetadata;
  legacyMetadata: StoryObjectMetadata;
};
function metadata(access: readonly string[], properties: Record<string, string | number | boolean | null>, tags: readonly string[], narrative?: StoryObjectMetadata): StoryObjectMetadata {
  if (narrative) return narrative;
  const policy = defaultStoryAccessPolicy();
  if (access.length) { policy.permission = "restricted"; policy.allow = [...access]; }
  return { owners: [], access: policy, tags: [...tags], properties: { ...properties } };
}
function sourcePlace(project: EditorProject, ref: StoryObjectRef) {
  return project.places.find((place) => {
    if (place.id !== ref.id) return false;
    if (place.kind !== "room" && place.kind !== "standalone-room") return ref.kind === "place";
    if (ref.kind !== "room") return false;
    return roomScopeMatches(project, place, ref.scopeId);
  });
}
function constructionIdForRoomPlace(project: EditorProject, place: EditorProject["places"][number]) {
  if (place.constructionId) return place.constructionId;
  return project.places.find(({ id }) => id === place.parentId)?.constructionId;
}
function constructionOwnerPlace(project: EditorProject, constructionId: string) {
  const owners = project.places.filter(({ constructionId: candidate }) => candidate === constructionId);
  return owners.length === 1 ? owners[0].id : undefined;
}
export function roomScopeMatches(project: EditorProject, place: EditorProject["places"][number], scopeId: string | undefined) {
  if (!scopeId) return true;
  const constructionId = constructionIdForRoomPlace(project, place);
  return scopeId === constructionId || scopeId === place.parentId || scopeId === place.id || scopeId === `place:${place.id}`;
}
function constructionForScope(project: EditorProject, scopeId: string | undefined) {
  if (!scopeId) return undefined;
  const direct = project.constructions.find(({ id }) => id === scopeId);
  if (direct) return direct;
  const owner = project.places.find(({ id, constructionId }) => id === scopeId && constructionId);
  return owner ? project.constructions.find(({ id }) => id === owner.constructionId) : undefined;
}
function canonicalProjectRef(project: EditorProject, ref: StoryObjectRef): StoryObjectRef {
  if (ref.kind === "place") {
    const place = project.places.find(({ id, kind }) => id === ref.id && (kind === "room" || kind === "standalone-room"));
    if (place) return canonicalProjectRef(project, { kind: "room", id: place.id, ...(ref.scopeId ? { scopeId: ref.scopeId } : {}) });
  }
  if (ref.kind === "room") {
    const candidates = allStoryObjectRefs(project).filter((candidate) => candidate.kind === "room" && candidate.id === ref.id &&
      (!ref.scopeId || candidate.scopeId === ref.scopeId || project.places.some((place) => place.id === ref.id &&
        (place.kind === "room" || place.kind === "standalone-room") && roomScopeMatches(project, place, ref.scopeId) && candidate.scopeId === constructionIdForRoomPlace(project, place))));
    return candidates.length === 1 ? candidates[0]! : ref;
  }
  if (["wall", "opening", "transition"].includes(ref.kind)) {
    const construction = constructionForScope(project, ref.scopeId);
    return construction && construction.id !== ref.scopeId ? { ...ref, scopeId: construction.id } : ref;
  }
  return ref;
}
export function canonicalProjectStoryRef(project: EditorProject, ref: StoryObjectRef) {
  return canonicalProjectRef(project, ref);
}
function sourceObject(project: EditorProject, ref: StoryObjectRef) {
  const place = ref.kind === "place" || ref.kind === "room" ? sourcePlace(project, ref) : undefined;
  if (place) {
    const constructionId = ref.kind === "room" ? constructionIdForRoomPlace(project, place) : undefined;
    const constructionRoomLocked = constructionId ? project.constructions.find(({ id }) => id === constructionId)?.rooms.some(({ id, locked }) => id === place.id && locked) : false;
    return {
    name: place.name,
    description: place.description,
    visible: place.visible ?? true,
    locked: Boolean(place.locked || constructionRoomLocked),
    ownerPlaceId: place.parentId,
    access: place.access,
    tags: place.tags,
    properties: place.properties,
    };
  }
  const element = ref.kind === "element" ? project.elements.find(({ id }) => id === ref.id) : undefined;
  if (element) return {
    name: element.name,
    description: element.description,
    visible: element.visible,
    locked: element.locked,
    ownerPlaceId: element.belongsToId,
    access: element.access,
    tags: element.tags,
    properties: element.properties,
  };
  const surface = ref.kind === "surface" ? project.surfaces.find(({ id }) => id === ref.id) : undefined;
  if (surface) return {
    name: surface.name,
    description: surface.description,
    visible: surface.visible,
    locked: surface.locked,
    ownerPlaceId: surface.belongsToId,
    access: surface.access,
    tags: surface.tags,
    properties: surface.properties,
  };
  const construction = constructionForScope(project, ref.scopeId);
  const constructionOwner = construction ? constructionOwnerPlace(project, construction.id) : undefined;
  if (construction && ref.kind === "room") {
    const room = construction.rooms.find(({ id }) => id === ref.id);
    if (room) return {
      name: room.name,
      description: room.description,
      visible: room.visible ?? true,
      locked: room.locked ?? false,
      ownerPlaceId: constructionOwner,
      access: room.access,
      tags: room.tags,
      properties: room.properties,
    };
  }
  if (construction && ref.kind === "wall") {
    const wall = construction.walls.find(({ id }) => id === ref.id);
    if (wall) return { name: `Wall ${wall.id}`, visible: wall.visible ?? true, locked: wall.locked ?? false, access: [], tags: [], properties: {} };
  }
  if (construction && ref.kind === "opening") {
    const opening = construction.openings.find(({ id }) => id === ref.id);
    if (opening) return { name: `${opening.kind} ${opening.id}`, visible: opening.visible ?? true, locked: opening.locked ?? false, access: [], tags: [], properties: {} };
  }
  if (construction && ref.kind === "transition") {
    const transition = construction.transitions.find(({ id }) => id === ref.id);
    if (transition) return { name: `${transition.kind} ${transition.id}`, visible: transition.visible ?? true, locked: transition.locked ?? false, access: [], tags: [], properties: {} };
  }
  return undefined;
}

function collectAllStoryObjectRefs(project: EditorProject): StoryObjectRef[] {
  const refs: StoryObjectRef[] = project.places.map((place) => place.kind === "room" || place.kind === "standalone-room"
    ? canonicalStoryRef({ kind: "room", id: place.id }, constructionIdForRoomPlace(project, place) ?? `place:${place.id}`)
    : { kind: "place", id: place.id });
  refs.push(...project.elements.map(({ id }) => ({ kind: "element" as const, id })), ...project.surfaces.map(({ id }) => ({ kind: "surface" as const, id })));
  for (const construction of project.constructions) {
    const mirroredRoom = (id: string) => project.places.some((place) =>
      (place.kind === "room" || place.kind === "standalone-room") &&
      place.id === id && constructionIdForRoomPlace(project, place) === construction.id);
    refs.push(
      ...construction.rooms.filter(({ id }) => !mirroredRoom(id)).map(({ id }) => ({ kind: "room" as const, id, scopeId: construction.id })),
      ...construction.walls.map(({ id }) => ({ kind: "wall" as const, id, scopeId: construction.id })),
      ...construction.openings.map(({ id }) => ({ kind: "opening" as const, id, scopeId: construction.id })),
      ...construction.transitions.map(({ id }) => ({ kind: "transition" as const, id, scopeId: construction.id })),
    );
  }
  return [...new Map(refs.map((ref) => [storyRefKey(ref), ref])).values()];
}
export function allStoryObjectRefs(project: EditorProject): StoryObjectRef[] {
  if (!isImmutableSnapshot(project)) return collectAllStoryObjectRefs(project);
  const cached = immutableProjectRefs.get(project);
  if (cached) return cached;
  const refs = immutableSnapshot(collectAllStoryObjectRefs(project));
  immutableProjectRefs.set(project, refs);
  return refs;
}
export function resolveStoryObject(project: EditorProject, input: StoryData | unknown, ref: StoryObjectRef): ResolvedStoryObject | undefined {
  const story = migrateStoryData(input);
  const normalizedRef = canonicalProjectRef(project, ref);
  const roomPlace = normalizedRef.kind === "room" ? project.places.find(({ id, kind }) => id === normalizedRef.id && (kind === "room" || kind === "standalone-room")) : undefined;
  const roomConstruction = roomPlace ? constructionIdForRoomPlace(project, roomPlace) : undefined;
  const canonicalRoomScope = roomPlace ? roomConstruction ?? `place:${roomPlace.id}` : undefined;
  const roomAliasAccepted = roomPlace ? roomScopeMatches(project, roomPlace, normalizedRef.scopeId) : !normalizedRef.scopeId;
  const candidates = normalizedRef.kind === "room"
    ? allStoryObjectRefs(project).filter((candidate) => candidate.kind === "room" && candidate.id === normalizedRef.id &&
      (!normalizedRef.scopeId || candidate.scopeId === normalizedRef.scopeId || Boolean(roomPlace && roomAliasAccepted && candidate.scopeId === canonicalRoomScope)))
    : [];
  if (normalizedRef.kind === "room" && candidates.length !== 1) return undefined;
  const canonical = normalizedRef.kind === "room" ? candidates[0]! : normalizedRef;
  const source = sourceObject(project, canonical);
  if (!source) return undefined;
  const narrative = story.objects.find(({ ref: candidate }) => sameStoryRef(candidate, canonical));
  const narrativeMetadata = narrative?.metadata;
  const canAnnotate = ["wall", "opening", "transition"].includes(canonical.kind);
  const legacyMetadata = metadata(source.access, source.properties, source.tags);
  return {
    ref: canonical,
    name: canAnnotate ? narrativeMetadata?.narrativeLabel ?? source.name : source.name,
    description: canAnnotate ? narrativeMetadata?.narrativeDescription ?? source.description : source.description,
    editor: { visible: source.visible, locked: source.locked },
    ownerPlaceId: source.ownerPlaceId,
    metadata: narrativeMetadata ?? legacyMetadata,
    legacyMetadata,
  };
}
export function storyObjectRefs(project: EditorProject, input: StoryData | unknown) {
  const story = migrateStoryData(input);
  return allStoryObjectRefs(project)
    .map((ref) => resolveStoryObject(project, story, ref))
    .filter((value): value is ResolvedStoryObject => Boolean(value));
}

function sourceShape(project: EditorProject, ref: StoryObjectRef): RegionShape | undefined {
  if (ref.kind === "place" || ref.kind === "room") {
    const placeShape = project.places.find(({ id, kind }) => id === ref.id &&
      (ref.kind === "place" ? kind !== "room" && kind !== "standalone-room" : (kind === "room" || kind === "standalone-room")))?.boundary;
    if (placeShape) return placeShape;
    if (ref.kind === "room" && ref.scopeId) {
      const construction = project.constructions.find(({ id }) => id === ref.scopeId);
      if (!construction) return undefined;
      const room = construction.rooms.find(({ id }) => id === ref.id);
      const face = room && constructionNetwork(construction.walls, construction.enclosure).faces.find(({ id }) => id === room.faceId);
      return face ? roomFaceShape(face) : undefined;
    }
    return undefined;
  }
  if (ref.kind === "surface") return project.surfaces.find(({ id }) => id === ref.id)?.shape;
  const element = ref.kind === "element" ? project.elements.find(({ id }) => id === ref.id) : undefined;
  if (!element) return undefined;
  if (element.geometry.kind === "region") return element.geometry.shape;
  if (isRibbonElement(element)) return ribbonShape(element);
  if (element.geometry.kind === "path" && element.geometry.closed && element.geometry.points.length >= 3) {
    return { kind: "polygon", points: element.geometry.points };
  }
  return element.geometry.kind === "bezier" && element.geometry.closed && element.geometry.nodes.length >= 3
    ? { kind: "polygon", points: sampleBezier(element.geometry.nodes, true) }
    : undefined;
}
export function zoneMatchesProject(project: EditorProject, input: StoryData | unknown, zoneId: string, ref: StoryObjectRef): { matches: boolean; relation?: StoryZoneRelation; partial?: boolean; reason: string } {
  const story = migrateStoryData(input); const zone = story.zones.find(({ id }) => id === zoneId); if (!zone) return { matches: false, reason: "zone-not-found" };
  if (zone.ownerPlaceId && !project.places.some(({ id }) => id === zone.ownerPlaceId)) return { matches: false, reason: "zone-owner-not-found" };
  const canonicalRef = canonicalProjectRef(project, ref);
  const manual = zone.members.find((member) => sameStoryRef(canonicalProjectRef(project, member.ref), canonicalRef)); if (manual) return { matches: true, relation: manual.relation, partial: manual.partial, reason: "authored-membership" };
  const resolved = resolveStoryObject(project, story, canonicalRef);
  const placeBackedRef = resolved && (resolved.ref.kind === "place" || resolved.ref.kind === "room")
    ? project.places.some(({ id, kind }) => id === resolved.ref.id && (resolved.ref.kind === "place" ? kind !== "room" && kind !== "standalone-room" : (kind === "room" || kind === "standalone-room")))
    : false;
  const sourceOwner = placeBackedRef ? resolved?.ref.id : resolved?.ownerPlaceId;
  if (zone.ownerPlaceId && (!sourceOwner || !isWithinPlace(project, sourceOwner, zone.ownerPlaceId))) return { matches: false, reason: "outside-owner-place" };
  const shape = sourceShape(project, resolved?.ref ?? ref); if (!zone.shape || !shape) return { matches: false, reason: "insufficient-local-geometry" };
  const sourceFrame = placeBackedRef ? resolved?.ref.id : resolved?.ownerPlaceId;
  const transformed = zone.ownerPlaceId && sourceFrame && zone.ownerPlaceId !== sourceFrame
    ? transformRegion(relativePlaceMatrix(project, zone.ownerPlaceId, sourceFrame), shape)
    : shape;
  const result = assessRegionConstraint(transformed, zone.shape);
  if (result.state === "inside") return { matches: true, relation: "inside", partial: false, reason: "exact-local-geometry" };
  if (result.state === "clip-available") return { matches: true, relation: "overlaps", partial: true, reason: "exact-local-intersection" };
  return { matches: false, reason: "exact-local-disjoint" };
}

function isWithinPlace(project: EditorProject, candidateId: string, ownerId: string) {
  const seen = new Set<string>(); let current = project.places.find(({ id }) => id === candidateId);
  while (current && !seen.has(current.id)) {
    if (current.id === ownerId) return true;
    seen.add(current.id);
    const parentId = current.parentId;
    current = parentId ? project.places.find(({ id }) => id === parentId) : undefined;
  }
  return false;
}
