import { constructionNetwork } from "../construction/construction-network";
import { commitConstructionTransaction, previewWallRemoval } from "../construction/construction-document";

import { syncConstructionRooms } from "../model/hierarchy-operations";
import type { EditorProject } from "../model/project-model";
import type { SelectionOperationResult } from "./selection-operations";

type Identity = { createId(): string; createRoomName(index: number): string };

export function mergeSelectedRooms(project: EditorProject, activePlaceId: string, roomIds: string[], identity: Identity): SelectionOperationResult {
  const active = project.places.find(({ id }) => id === activePlaceId);
  const owner = active?.kind === "room" && active.parentId ? project.places.find(({ id }) => id === active.parentId) : active;
  const document = project.constructions.find(({ id }) => id === owner?.constructionId);
  const selectedIds = new Set(roomIds);
  const selectedRooms = document?.rooms.filter(({ id }) => selectedIds.has(id)) ?? [];
  if (!document || selectedRooms.length < 2 || selectedRooms.length !== selectedIds.size) return { state: "blocked", project, reason: "not-found" };

  const faceById = new Map(constructionNetwork(document.walls, document.enclosure).faces.map((face) => [face.id, face]));
  const usage = new Map<string, number>();
  for (const room of selectedRooms) for (const wallId of faceById.get(room.faceId)?.wallIds ?? []) usage.set(wallId, (usage.get(wallId) ?? 0) + 1);
  const sharedWallIds = [...usage]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .filter((id) => document.walls.find((wall) => wall.id === id)?.role !== "boundary");
  if (!sharedWallIds.length) return { state: "blocked", project, reason: "collision" };

  const candidate = previewWallRemoval(document, sharedWallIds, { createId: identity.createId, createName: identity.createRoomName });
  const mergedFaceIds = candidate.effects.find(({ kind }) => kind === "rooms-merged")?.ids ?? [];
  const survivor = candidate.after.rooms.find(({ faceId }) => mergedFaceIds.includes(faceId));
  if (!survivor) return { state: "blocked", project, reason: "collision" };

  const primary = selectedRooms[0];
  const combined = {
    ...survivor,
    name: primary.name,
    description: primary.description,
    tags: [...new Set(selectedRooms.flatMap(({ tags }) => tags))],
    access: [...new Set(selectedRooms.flatMap(({ access }) => access))],
    properties: Object.assign({}, ...selectedRooms.map(({ properties }) => properties), primary.properties),
  };
  const prepared = { ...candidate, after: { ...candidate.after, rooms: candidate.after.rooms.map((room) => room.id === survivor.id ? combined : room) } };
  const committed = commitConstructionTransaction(document, prepared);
  if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };

  const primaryPlace = project.places.find(({ id }) => id === primary.id);
  let next = syncConstructionRooms({ ...project, constructions: project.constructions.map((item) => item.id === document.id ? committed.document : item) }, committed.document);
  next = {
    ...next,
    places: next.places.map((place) => place.id === survivor.id ? { ...place, name: combined.name, description: combined.description, tags: combined.tags, access: combined.access, properties: combined.properties, appearance: primaryPlace?.appearance ?? place.appearance } : place),
    elements: next.elements.map((element) => selectedIds.has(element.belongsToId) ? { ...element, belongsToId: survivor.id } : element),
  };
  return { state: "applied", project: next };
}
