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
// A room keeps its identity only when both faces share a meaningful part of
// their area. This prevents a tiny accidental sliver from inheriting a
// neighbouring room's name and metadata.
const MIN_RELATIVE_COVERAGE = 0.2;

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

type RoomRelation = {
  room: RoomRecord;
  face: RoomFace;
  area: number;
};

function maximumWeightAssignment(weights: number[][]) {
  const rowCount = weights.length;
  if (!rowCount) return [];
  const columnCount = weights[0]?.length ?? 0;
  if (columnCount < rowCount) throw new Error("Room assignment requires at least as many columns as rows");

  // Hungarian assignment, expressed as a minimum-cost algorithm over the
  // negated weights. The matrix is small in practice (usually a few dozen
  // rooms), while this gives a global optimum instead of greedy local wins.
  const u = new Array<number>(rowCount + 1).fill(0);
  const v = new Array<number>(columnCount + 1).fill(0);
  const matching = new Array<number>(columnCount + 1).fill(0);
  const way = new Array<number>(columnCount + 1).fill(0);
  for (let row = 1; row <= rowCount; row += 1) {
    matching[0] = row;
    let column = 0;
    const minCost = new Array<number>(columnCount + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(columnCount + 1).fill(false);
    do {
      used[column] = true;
      const matchedRow = matching[column];
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) continue;
        const cost = -weights[matchedRow - 1][candidate - 1] - u[matchedRow] - v[candidate];
        if (cost < minCost[candidate]) {
          minCost[candidate] = cost;
          way[candidate] = column;
        }
        if (minCost[candidate] < delta) {
          delta = minCost[candidate];
          nextColumn = candidate;
        }
      }
      for (let candidate = 0; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) {
          u[matching[candidate]] += delta;
          v[candidate] -= delta;
        } else {
          minCost[candidate] -= delta;
        }
      }
      column = nextColumn;
    } while (matching[column] !== 0);
    do {
      const previousColumn = way[column];
      matching[column] = matching[previousColumn];
      column = previousColumn;
    } while (column !== 0);
  }

  const assignment = new Array<number>(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (matching[column]) assignment[matching[column] - 1] = column - 1;
  }
  return assignment;
}

export function reconcileRooms(previousFaces: RoomFace[], nextFaces: RoomFace[], previousRooms: RoomRecord[], createId: () => string, createName: (index: number) => string): RoomReconciliation {
  const previousFaceById = new Map(previousFaces.map((face) => [face.id, face]));
  const relations: RoomRelation[] = previousRooms.flatMap((room) => {
    const oldFace = previousFaceById.get(room.faceId);
    if (!oldFace || oldFace.area <= MIN_OVERLAP) return [];
    return nextFaces.flatMap((face) => {
      if (face.area <= MIN_OVERLAP) return [];
      const area = overlap(oldFace, face);
      const coverageOfPrevious = area / oldFace.area;
      const coverageOfNext = area / face.area;
      return area > MIN_OVERLAP && coverageOfPrevious >= MIN_RELATIVE_COVERAGE && coverageOfNext >= MIN_RELATIVE_COVERAGE
        ? [{ room, face, area }]
        : [];
    });
  });
  const relationKey = (roomId: string, faceId: string) => JSON.stringify([roomId, faceId]);
  const relationByKey = new Map(relations.map((relation) => [relationKey(relation.room.id, relation.face.id), relation]));
  const maximumArea = relations.reduce((maximum, relation) => Math.max(maximum, relation.area), 0);
  const weights = previousRooms.map((room, roomIndex) => [
    ...nextFaces.map((face, faceIndex) => {
      const relation = relationByKey.get(relationKey(room.id, face.id));
      if (!relation || !maximumArea) return 0;
      // Absolute overlap is the primary criterion: on a split or merge the
      // largest piece keeps the old record. The tiny deterministic suffix
      // makes equal-area outcomes stable without changing that policy.
      return relation.area / maximumArea
        + (previousRooms.length - roomIndex) * 1e-10
        + (nextFaces.length - faceIndex) * 1e-12;
    }),
    ...previousRooms.map(() => 0),
  ]);
  const assignment = maximumWeightAssignment(weights);
  const usedRooms = new Set<string>(); const matchedByFace = new Map<string, RoomRecord>();
  previousRooms.forEach((room, roomIndex) => {
    const faceIndex = assignment[roomIndex];
    const face = faceIndex >= 0 && faceIndex < nextFaces.length ? nextFaces[faceIndex] : undefined;
    const relation = face && relationByKey.get(relationKey(room.id, face.id));
    if (!relation) return;
    usedRooms.add(room.id); matchedByFace.set(face.id, { ...room, faceId: face.id });
  });
  const relationsByRoom = new Map<string, RoomRelation[]>();
  const relationsByFace = new Map<string, RoomRelation[]>();
  for (const relation of relations) {
    relationsByRoom.set(relation.room.id, [...(relationsByRoom.get(relation.room.id) ?? []), relation]);
    relationsByFace.set(relation.face.id, [...(relationsByFace.get(relation.face.id) ?? []), relation]);
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
  // Split policy: the child with the largest overlap keeps the old record;
  // every other child is created as a new room. Merge policy: the same global
  // one-to-one assignment chooses the dominant overlap as the survivor and
  // reports the merged face for callers that need to combine content.
  const splitRoomIds = previousRooms.filter((room) => new Set((relationsByRoom.get(room.id) ?? []).map(({ face }) => face.id)).size > 1).map(({ id }) => id);
  const mergedFaceIds = nextFaces.filter((face) => new Set((relationsByFace.get(face.id) ?? []).map(({ room }) => room.id)).size > 1).map(({ id }) => id);
  return { rooms, createdRoomIds, removedRoomIds, splitRoomIds, mergedFaceIds };
}

export function roomsForFaces(faces: RoomFace[], createId: () => string, createName: (index: number) => string) {
  return faces.map((face, index): RoomRecord => ({ id: createId(), faceId: face.id, name: createName(index + 1), tags: [], access: [], properties: {} }));
}
