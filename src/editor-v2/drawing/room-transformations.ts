import { roomFaceShape } from "../geometry/room-face-shape";
import { constructionNetwork } from "../construction/construction-network";
import { commitConstructionTransaction, previewWallAddition, previewWallReplacement } from "../construction/construction-document";
import { applyAffinePoint, transformDrawingGeometry, type AffineMatrix } from "../geometry/affine-transform";

import { pointInRegion } from "../geometry/region-constraints";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import type { EditorProject } from "../model/project-model";

type Identity = { createId(): string; createRoomName(index: number): string };
type Transformation = { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" };
export type RoomTransformationResult = { state: "applied"; project: EditorProject; selectedIds: string[] } | { state: "blocked"; project: EditorProject; reason: "not-found" | "locked-outline" | "outside-outline" | "collision" };

function constructionFor(project: EditorProject, activePlaceId: string) {
  const active = project.places.find(({ id }) => id === activePlaceId); const owner = active?.kind === "room" ? project.places.find(({ id }) => id === active.parentId) : active;
  const document = project.constructions.find(({ id }) => id === owner?.constructionId); return { owner, document };
}

function matrixFor(points: { x: number; y: number }[], transformation: Transformation): AffineMatrix {
  const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y); const cx = (Math.min(...xs) + Math.max(...xs)) / 2; const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  if (transformation.kind === "mirror") return transformation.axis === "horizontal" ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
  const angle = transformation.degrees * Math.PI / 180; const cosine = Math.cos(angle); const sine = Math.sin(angle);
  return [cosine, sine, -sine, cosine, cx - cosine * cx + sine * cy, cy - sine * cx - cosine * cy];
}

function replaceDocument(project: EditorProject, id: string, document: EditorProject["constructions"][number]) {
  return syncConstructionRooms({ ...project, constructions: project.constructions.map((candidate) => candidate.id === id ? document : candidate) }, document);
}

function selectedRoomData(project: EditorProject, activePlaceId: string, ids: readonly string[]) {
  const { owner, document } = constructionFor(project, activePlaceId); const network = document ? constructionNetwork(document.walls, document.enclosure) : undefined;
  const rooms = ids.flatMap((id) => document?.rooms.find((room) => room.id === id) ?? []); const faces = rooms.flatMap((room) => network?.faces.find((face) => face.id === room.faceId) ?? []);
  return { owner, document, network, rooms, faces };
}

export function transformSelectedRooms(project: EditorProject, activePlaceId: string, ids: readonly string[], transformation: Transformation, boundaryEditing: boolean, identity: Identity): RoomTransformationResult {
  const data = selectedRoomData(project, activePlaceId, ids);
  if (!data.document || data.rooms.length !== new Set(ids).size || data.faces.length !== data.rooms.length) return { state: "blocked", project, reason: "not-found" };
  const wallIds = new Set(data.faces.flatMap(({ wallIds }) => wallIds)); const selectedWalls = data.document.walls.filter(({ id }) => wallIds.has(id));
  if (!boundaryEditing && selectedWalls.some(({ role }) => role === "boundary")) return { state: "blocked", project, reason: "locked-outline" };
  const vertices = data.faces.flatMap((face) => [...face.outer, ...face.holes.flat()]); const matrix = matrixFor(vertices, transformation);
  const sameVertex = (point: { x: number; y: number }) => vertices.some((vertex) => Math.hypot(vertex.x - point.x, vertex.y - point.y) < 1e-6);
  const walls = data.document.walls.map((wall) => ({ ...wall, start: wallIds.has(wall.id) || sameVertex(wall.start) ? applyAffinePoint(matrix, wall.start) : wall.start, end: wallIds.has(wall.id) || sameVertex(wall.end) ? applyAffinePoint(matrix, wall.end) : wall.end }));
  const committed = commitConstructionTransaction(data.document, previewWallReplacement(data.document, walls, { createId: identity.createId, createName: identity.createRoomName }));
  if (committed.state !== "committed") return { state: "blocked", project, reason: "collision" };
  let next = replaceDocument(project, data.document.id, committed.document);
  next = { ...next, elements: next.elements.map((element) => ids.includes(element.belongsToId) ? { ...element, geometry: transformDrawingGeometry(matrix, element.geometry) } : element) };
  const selectedIds = ids.filter((id) => next.places.some((place) => place.id === id));
  return { state: "applied", project: next, selectedIds };
}

function translatedMatrix(delta: { x: number; y: number }): AffineMatrix { return [1, 0, 0, 1, delta.x, delta.y]; }

export function duplicateSelectedRooms(project: EditorProject, activePlaceId: string, ids: readonly string[], identity: Identity): RoomTransformationResult {
  const data = selectedRoomData(project, activePlaceId, ids);
  if (!data.owner?.boundary || !data.document || data.rooms.length !== new Set(ids).size || data.faces.length !== data.rooms.length) return { state: "blocked", project, reason: "not-found" };
  const wallIds = new Set(data.faces.flatMap(({ wallIds }) => wallIds)); const walls = data.document.walls.filter(({ id }) => wallIds.has(id));
  const points = data.faces.flatMap(({ outer }) => outer); const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y); const width = Math.max(...xs) - Math.min(...xs); const height = Math.max(...ys) - Math.min(...ys);
  const offsets = [{ x: width + 2, y: 0 }, { x: -width - 2, y: 0 }, { x: 0, y: height + 2 }, { x: 0, y: -height - 2 }];
  for (const delta of offsets) {
    const matrix = translatedMatrix(delta); const copies = walls.map((wall) => ({ ...wall, id: identity.createId(), role: "partition" as const, start: applyAffinePoint(matrix, wall.start), end: applyAffinePoint(matrix, wall.end) }));
    if (copies.some((wall) => !pointInRegion(wall.start, data.owner!.boundary!) || !pointInRegion(wall.end, data.owner!.boundary!))) continue;
    const committed = commitConstructionTransaction(data.document, previewWallAddition(data.document, copies, { createId: identity.createId, createName: identity.createRoomName })); if (committed.state !== "committed") continue;
    const beforeIds = new Set(data.document.rooms.map(({ id }) => id)); const createdRooms = committed.document.rooms.filter(({ id }) => !beforeIds.has(id)); if (!createdRooms.length) continue;
    let next = replaceDocument(project, data.document.id, committed.document); const network = constructionNetwork(committed.document.walls, committed.document.enclosure);
    const elements = project.elements.flatMap((element) => {
      const room = data.rooms.find(({ id }) => id === element.belongsToId); const face = room ? data.faces.find(({ id }) => id === room.faceId) : undefined; if (!face) return [];
      const center = face.outer.reduce((sum, point) => ({ x: sum.x + point.x / face.outer.length, y: sum.y + point.y / face.outer.length }), { x: 0, y: 0 }); const target = applyAffinePoint(matrix, center);
      const created = createdRooms.find((candidate) => { const candidateFace = network.faces.find(({ id }) => id === candidate.faceId); return candidateFace && pointInRegion(target, roomFaceShape(candidateFace)); });
      return created ? [{ ...structuredClone(element), id: identity.createId(), belongsToId: created.id, geometry: transformDrawingGeometry(matrix, element.geometry) }] : [];
    });
    next = { ...next, elements: [...next.elements, ...elements] }; return { state: "applied", project: next, selectedIds: createdRooms.map(({ id }) => id) };
  }
  return { state: "blocked", project, reason: "outside-outline" };
}
