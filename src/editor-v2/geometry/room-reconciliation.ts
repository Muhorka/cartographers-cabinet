import Coordinate from "jsts/org/locationtech/jts/geom/Coordinate.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import SnapIfNeededOverlayOp from "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js";
import type { KernelPoint, RoomFace } from "./geometry-types";

export type RoomRecord = {
  id: string;
  faceId: string;
  name: string;
  description?: string;
  tags: string[];
  access: string[];
  properties: Record<string, string | number | boolean | null>;
  visible?: boolean;
  locked?: boolean;
};

export type RoomReconciliation = {
  rooms: RoomRecord[];
  createdRoomIds: string[];
  removedRoomIds: string[];
  splitRoomIds: string[];
  mergedFaceIds: string[];
};

type JstsGeometry = { getArea(): number };
const factory = new GeometryFactory();
const MIN_OVERLAP = 1e-7;

function ring(points: KernelPoint[]) {
  const closed = [...points, points[0]].map(({ x, y }) => new Coordinate(x, y));
  return factory.createLinearRing(closed);
}

function polygon(face: RoomFace) {
  return factory.createPolygon(ring(face.outer), face.holes.map(ring));
}

function overlap(first: RoomFace, second: RoomFace) {
  return (SnapIfNeededOverlayOp.intersection(polygon(first), polygon(second)) as JstsGeometry).getArea();
}

export function reconcileRooms(previousFaces: RoomFace[], nextFaces: RoomFace[], previousRooms: RoomRecord[], createId: () => string, createName: (index: number) => string): RoomReconciliation {
  const previousFaceById = new Map(previousFaces.map((face) => [face.id, face]));
  const relations = previousRooms.flatMap((room) => {
    const oldFace = previousFaceById.get(room.faceId);
    return oldFace ? nextFaces.map((face) => ({ room, face, area: overlap(oldFace, face) })).filter(({ area }) => area > MIN_OVERLAP) : [];
  });
  const ordered = relations.toSorted((first, second) => second.area - first.area || first.room.id.localeCompare(second.room.id) || first.face.id.localeCompare(second.face.id));
  const usedRooms = new Set<string>(); const usedFaces = new Set<string>(); const matchedByFace = new Map<string, RoomRecord>();
  for (const relation of ordered) {
    if (usedRooms.has(relation.room.id) || usedFaces.has(relation.face.id)) continue;
    usedRooms.add(relation.room.id); usedFaces.add(relation.face.id); matchedByFace.set(relation.face.id, { ...relation.room, faceId: relation.face.id });
  }
  const createdRoomIds: string[] = [];
  const usedNames = new Set(previousRooms.map(({ name }) => name)); let nameIndex = 1;
  const nextName = () => { let candidate = createName(nameIndex++); while (usedNames.has(candidate)) candidate = createName(nameIndex++); usedNames.add(candidate); return candidate; };
  const rooms = nextFaces.map((face) => {
    const matched = matchedByFace.get(face.id);
    if (matched) return matched;
    const id = createId(); createdRoomIds.push(id);
    return { id, faceId: face.id, name: nextName(), tags: [], access: [], properties: {} };
  });
  const removedRoomIds = previousRooms.filter(({ id }) => !usedRooms.has(id)).map(({ id }) => id);
  const splitRoomIds = previousRooms.filter((room) => new Set(relations.filter((relation) => relation.room.id === room.id).map(({ face }) => face.id)).size > 1).map(({ id }) => id);
  const mergedFaceIds = nextFaces.filter((face) => new Set(relations.filter((relation) => relation.face.id === face.id).map(({ room }) => room.id)).size > 1).map(({ id }) => id);
  return { rooms, createdRoomIds, removedRoomIds, splitRoomIds, mergedFaceIds };
}

export function roomsForFaces(faces: RoomFace[], createId: () => string, createName: (index: number) => string) {
  return faces.map((face, index): RoomRecord => ({ id: createId(), faceId: face.id, name: createName(index + 1), tags: [], access: [], properties: {} }));
}
