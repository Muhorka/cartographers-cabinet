import type { CanonicalWall, KernelPoint, RoomFace, WallNetworkResult } from "../geometry/geometry-types";
import { reconcileRooms, roomsForFaces, type RoomRecord } from "../geometry/room-reconciliation";
import { moveJunction, offsetWall } from "../geometry/wall-edit-operations";
import { pointsEqual, translate } from "../geometry/line-geometry";
import { materializeWallSegments } from "../geometry/wall-network-kernel";
import { validateVerticalTransitions, wallFeatureIssues, type VerticalTransition, type WallOpening } from "./wall-features";
import type { RegionShape } from "../model/project-model";
import { constructionNetwork } from "./construction-network";
export { constructionNetwork } from "./construction-network";

export type ConstructionDocument = {
  id: string;
  revision: number;
  walls: CanonicalWall[];
  rooms: RoomRecord[];
  openings: WallOpening[];
  transitions: VerticalTransition[];
  enclosure?: RegionShape;
};

type ConstructionEffect = {
  kind: "rooms-created" | "rooms-removed" | "room-split" | "rooms-merged" | "openings-removed" | "geometry-conflict";
  ids: string[];
};

export type ConstructionTransaction = {
  id: string;
  before: ConstructionDocument;
  after: ConstructionDocument;
  beforeNetwork: WallNetworkResult;
  afterNetwork: WallNetworkResult;
  effects: ConstructionEffect[];
  status: "pending";
};

type CreateRoomIdentity = { createId(): string; createName(index: number): string };

function effectsFor(reconciliation: ReturnType<typeof reconcileRooms>, afterNetwork: WallNetworkResult, issueKinds: string[]) {
  const effects: ConstructionEffect[] = [];
  if (reconciliation.createdRoomIds.length) effects.push({ kind: "rooms-created", ids: reconciliation.createdRoomIds });
  if (reconciliation.removedRoomIds.length) effects.push({ kind: "rooms-removed", ids: reconciliation.removedRoomIds });
  if (reconciliation.splitRoomIds.length) effects.push({ kind: "room-split", ids: reconciliation.splitRoomIds });
  if (reconciliation.mergedFaceIds.length) effects.push({ kind: "rooms-merged", ids: reconciliation.mergedFaceIds });
  const conflicts = [...issueKinds, ...afterNetwork.diagnostics.filter(({ kind }) => kind === "invalid-ring").map(({ kind }) => kind)];
  if (conflicts.length) effects.push({ kind: "geometry-conflict", ids: conflicts });
  return effects;
}

function pointOnWall(wall: CanonicalWall, position: number) {
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * position,
    y: wall.start.y + (wall.end.y - wall.start.y) * position,
  };
}

function pointSegmentDistance(point: KernelPoint, wall: CanonicalWall) {
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const length = dx * dx + dy * dy;
  const position = length ? Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / length)) : 0;
  return { position, distance: Math.hypot(point.x - wall.start.x - dx * position, point.y - wall.start.y - dy * position) };
}

function belongsToSource(wall: CanonicalWall, sourceId: string) {
  return wall.id === sourceId || wall.sourceWallId === sourceId;
}

function remapOpenings(before: ConstructionDocument, rawWalls: CanonicalWall[], walls: CanonicalWall[]) {
  return before.openings.flatMap((opening) => {
    const original = before.walls.find(({ id }) => id === opening.wallId); const source = rawWalls.find(({ id }) => id === opening.wallId);
    const replacementPieces = rawWalls.filter((wall) => wall.id !== opening.wallId && belongsToSource(wall, opening.wallId));
    if (!source && !replacementPieces.length) return [];
    const at = replacementPieces.length && original ? pointOnWall(original, opening.position) : source ? pointOnWall(source, opening.position) : pointOnWall(original!, opening.position);
    const candidateSourceIds = new Set([opening.wallId, ...replacementPieces.map(({ id }) => id)]);
    const candidates = walls.filter((wall) => candidateSourceIds.has(wall.id) || !!wall.sourceWallId && candidateSourceIds.has(wall.sourceWallId))
      .map((wall) => ({ wall, ...pointSegmentDistance(at, wall) })).toSorted((first, second) => first.distance - second.distance);
    const match = candidates[0];
    return match && match.distance < 1e-5 ? [{ ...opening, wallId: match.wall.id, position: match.position }] : [];
  });
}

function transaction(before: ConstructionDocument, walls: CanonicalWall[], identity: CreateRoomIdentity, issueKinds: string[], enclosure = before.enclosure): ConstructionTransaction {
  const normalizedWalls = materializeWallSegments(walls);
  const beforeNetwork = constructionNetwork(before.walls, before.enclosure); const afterNetwork = constructionNetwork(normalizedWalls, enclosure);
  const reconciliation = reconcileRooms(beforeNetwork.faces, afterNetwork.faces, before.rooms, identity.createId, identity.createName);
  const openings = remapOpenings(before, walls, normalizedWalls);
  const after = { ...before, revision: before.revision + 1, walls: normalizedWalls, rooms: reconciliation.rooms, openings, enclosure };
  const effects = effectsFor(reconciliation, afterNetwork, [...issueKinds, ...wallFeatureIssues(after)]);
  const removedOpeningIds = before.openings.filter(({ id }) => !openings.some((opening) => opening.id === id)).map(({ id }) => id);
  if (removedOpeningIds.length) effects.push({ kind: "openings-removed", ids: removedOpeningIds });
  return { id: `construction:${before.id}:${after.revision}`, before, after, beforeNetwork, afterNetwork, effects, status: "pending" };
}

export function createConstructionDocument(id: string, walls: CanonicalWall[], identity: CreateRoomIdentity, enclosure?: RegionShape): ConstructionDocument {
  const normalizedWalls = materializeWallSegments(walls); const network = constructionNetwork(normalizedWalls, enclosure);
  return { id, revision: 0, walls: normalizedWalls, rooms: roomsForFaces(network.faces, identity.createId, identity.createName), openings: [], transitions: [], enclosure };
}

/**
 * Repairs legacy geometry without treating the repair as a user edit.  Older
 * project snapshots can contain visually touching endpoints and a room list
 * calculated before those endpoints were normalised.  Loading such a snapshot
 * must repair both halves together: the persistent wall network and the room
 * records that drive hierarchy navigation.
 */
export function repairConstructionDocument(document: ConstructionDocument, identity: CreateRoomIdentity, previousFaces?: RoomFace[]) {
  const normalizedWalls = materializeWallSegments(document.walls);
  const beforeFaces = previousFaces?.length ? previousFaces : constructionNetwork(document.walls, document.enclosure).faces;
  const afterFaces = constructionNetwork(normalizedWalls, document.enclosure).faces;
  const reconciliation = reconcileRooms(beforeFaces, afterFaces, document.rooms, identity.createId, identity.createName);
  const openings = remapOpenings(document, document.walls, normalizedWalls);
  const unchanged = JSON.stringify({ walls: normalizedWalls, rooms: reconciliation.rooms, openings })
    === JSON.stringify({ walls: document.walls, rooms: document.rooms, openings: document.openings });
  return unchanged ? document : {
    ...document,
    revision: document.revision + 1,
    walls: normalizedWalls,
    rooms: reconciliation.rooms,
    openings,
  };
}

export function previewWallOffset(document: ConstructionDocument, wallId: string, distance: number, identity: CreateRoomIdentity) {
  const edit = offsetWall(document.walls, wallId, distance);
  return transaction(document, edit.walls, identity, edit.issues.map(({ kind }) => kind));
}

export function previewJunctionMove(document: ConstructionDocument, at: KernelPoint, next: KernelPoint, identity: CreateRoomIdentity) {
  const edit = moveJunction(document.walls, at, next);
  return transaction(document, edit.walls, identity, edit.issues.map(({ kind }) => kind));
}

export function previewRoomTranslation(document: ConstructionDocument, roomId: string, delta: KernelPoint, identity: CreateRoomIdentity) {
  const room = document.rooms.find(({ id }) => id === roomId); const network = constructionNetwork(document.walls, document.enclosure); const face = network.faces.find(({ id }) => id === room?.faceId);
  if (!room || !face) return { state: "not-found" as const };
  const selectedIds = new Set(face.wallIds); const vertices = [...face.outer, ...face.holes.flat()];
  const touchesVertex = (point: KernelPoint) => vertices.some((vertex) => pointsEqual(vertex, point));
  const walls: CanonicalWall[] = document.walls.map((wall) => selectedIds.has(wall.id)
    ? { ...wall, start: translate(wall.start, delta), end: translate(wall.end, delta) }
    : { ...wall, start: touchesVertex(wall.start) ? translate(wall.start, delta) : wall.start, end: touchesVertex(wall.end) ? translate(wall.end, delta) : wall.end });
  return { state: "ready" as const, transaction: transaction(document, walls, identity, []), face, includesBoundary: document.walls.some(({ id, role }) => selectedIds.has(id) && role === "boundary") };
}

export function previewWallAddition(document: ConstructionDocument, walls: CanonicalWall[], identity: CreateRoomIdentity) {
  const duplicateIds = walls.filter((wall) => document.walls.some(({ id }) => id === wall.id)).map(({ id }) => id);
  return transaction(document, duplicateIds.length ? document.walls : [...document.walls, ...walls], identity, duplicateIds.map((id) => `duplicate-wall:${id}`));
}

export function previewWallRemoval(document: ConstructionDocument, wallIds: readonly string[], identity: CreateRoomIdentity) {
  const removed = new Set(wallIds); const walls = document.walls.filter(({ id, role }) => role === "boundary" || !removed.has(id));
  return transaction(document, walls, identity, []);
}

export function previewWallReplacement(document: ConstructionDocument, walls: CanonicalWall[], identity: CreateRoomIdentity) {
  return transaction(document, walls, identity, []);
}

export function previewEnclosureReplacement(document: ConstructionDocument, walls: CanonicalWall[], enclosure: RegionShape, identity: CreateRoomIdentity) {
  return transaction(document, walls, identity, [], enclosure);
}

export function previewWallGroupTranslation(document: ConstructionDocument, wallIds: readonly string[], delta: KernelPoint, identity: CreateRoomIdentity) {
  const selectedIds = new Set(wallIds);
  const walls = document.walls.map((wall) => selectedIds.has(wall.id)
    ? { ...wall, start: translate(wall.start, delta), end: translate(wall.end, delta) }
    : wall);
  const missing = wallIds.filter((id) => !document.walls.some((wall) => wall.id === id));
  return transaction(document, walls, identity, missing.map((id) => `wall-not-found:${id}`));
}

export function previewRoomRemoval(document: ConstructionDocument, roomId: string, identity: CreateRoomIdentity) {
  const room = document.rooms.find(({ id }) => id === roomId);
  const network = constructionNetwork(document.walls, document.enclosure);
  const face = network.faces.find(({ id }) => id === room?.faceId);
  if (!room || !face) return { state: "not-found" as const };
  const usage = new Map<string, number>();
  for (const candidate of network.faces) for (const wallId of candidate.wallIds) usage.set(wallId, (usage.get(wallId) ?? 0) + 1);
  const removableIds = face.wallIds.filter((wallId) => {
    const wall = document.walls.find(({ id }) => id === wallId);
    return wall?.role !== "boundary" && (usage.get(wallId) ?? 0) > 1;
  });
  if (!removableIds.length) return { state: "protected-outline" as const };
  return { state: "ready" as const, wallIds: removableIds, transaction: previewWallRemoval(document, removableIds, identity) };
}

export function commitConstructionTransaction(document: ConstructionDocument, candidate: ConstructionTransaction) {
  if (candidate.before.id !== document.id || candidate.before.revision !== document.revision) return { state: "stale" as const, document };
  if (candidate.effects.some(({ kind }) => kind === "geometry-conflict")) return { state: "blocked" as const, document };
  // Wall/enclosure rebuilds retain transitions. Validate the retained records
  // against the rebuilt room faces before the candidate becomes canonical.
  if (validateVerticalTransitions(candidate.after).length) return { state: "blocked" as const, document };
  return { state: "committed" as const, document: candidate.after };
}
