import { constructionNetwork } from "../construction/construction-network";
import { repairConstructionDocument } from "../construction/construction-document";
import type { RoomFace } from "../geometry/geometry-types";

import { shapePoints, shapePolygons } from "../geometry/region-constraints";
import { syncConstructionRooms } from "./hierarchy-operations";
import type { EditorProject } from "./project-model";

type RepairIdentity = {
  createId(): string;
  createName(index: number): string;
};

function rememberedRoomFaces(project: EditorProject, construction: EditorProject["constructions"][number]) {
  const currentFaces = new Map(constructionNetwork(construction.walls, construction.enclosure).faces.map((face) => [face.id, face]));
  return construction.rooms.flatMap((room): RoomFace[] => {
    const rememberedPlace = project.places.find(({ id }) => id === room.id);
    const current = currentFaces.get(room.faceId);
    if (rememberedPlace?.boundary) {
      const polygons = shapePolygons(rememberedPlace.boundary);
      if (polygons.length) {
        const polygon = polygons[0];
        return [{ id: room.faceId, outer: polygon.outer, holes: polygon.holes, area: 0, wallIds: current?.wallIds ?? [] }];
      }
      const points = shapePoints(rememberedPlace.boundary);
      if (points.length >= 3) return [{ id: room.faceId, outer: points, holes: [], area: 0, wallIds: current?.wallIds ?? [] }];
    }
    return current ? [current] : [];
  });
}

/** Repairs construction topology and the matching navigable room places. */
export function repairProjectConstructions(project: EditorProject, identity: RepairIdentity, previous?: EditorProject) {
  let repaired = project;
  const previousConstructions = new Map(previous?.constructions.map((construction) => [construction.id, construction]));
  const previousPlaces = new Map(previous?.places.map((place) => [place.id, place]));
  const currentPlaces = new Map(project.places.map((place) => [place.id, place]));
  for (const original of project.constructions) {
    const sameConstruction = previousConstructions.get(original.id) === original;
    const sameRememberedRooms = original.rooms.every(({ id }) => previousPlaces.get(id) === currentPlaces.get(id));
    if (previous && sameConstruction && sameRememberedRooms) continue;
    const rememberedRooms = original.rooms.map((room) => {
      const rememberedPlace = currentPlaces.get(room.id);
      return rememberedPlace ? {
        ...room,
        name: rememberedPlace.name,
        description: rememberedPlace.description,
        tags: rememberedPlace.tags,
        access: rememberedPlace.access,
        properties: rememberedPlace.properties,
        visible: rememberedPlace.visible,
        locked: rememberedPlace.locked,
      } : room;
    });
    const construction = repairConstructionDocument({ ...original, rooms: rememberedRooms }, identity, rememberedRoomFaces(project, original));
    repaired = {
      ...repaired,
      constructions: repaired.constructions.map((candidate) => candidate.id === construction.id ? construction : candidate),
    };
    repaired = syncConstructionRooms(repaired, construction);
  }
  return repaired;
}
