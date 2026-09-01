import { roomFaceShape } from "../geometry/room-face-shape";
import { constructionNetwork } from "../construction/construction-network";
import { createConstructionDocument } from "../construction/construction-document";
import { applyAffinePoint, relativePlaceMatrix, transformDrawingGeometry, transformRegion, type AffineMatrix } from "../geometry/affine-transform";
import type { CanonicalWall, KernelPoint, RoomFace } from "../geometry/geometry-types";
import { pointInRegion, regionArea, shapePolygons, unionRegionShapes } from "../geometry/region-constraints";
import { regionBoundsCenter } from "../geometry/region-transform";
import { reconcileRooms, type RoomRecord } from "../geometry/room-reconciliation";
import { materializeWallSegments } from "../geometry/wall-network-kernel";
import { syncConstructionRooms } from "../model/hierarchy-operations";
import type { DrawingElement, EditorProject, PlaceNode, RegionShape } from "../model/project-model";

export type BuildingMergeMode = "outer-only" | "keep-partitions";
type Identity = { createId(): string; createRoomName(index: number): string };

function positiveOverlap(first: RegionShape, second: RegionShape) {
  const union = unionRegionShapes([first, second]);
  if (!union) return false;
  return regionArea(first) + regionArea(second) - regionArea(union) > 1e-6;
}

export function buildingOverlapGroups(project: EditorProject, containingPlaceId: string) {
  const buildings = project.places.filter(({ parentId, kind, boundary }) => parentId === containingPlaceId && kind === "building" && boundary);
  const shapes = new Map(buildings.map((building) => [building.id, transformRegion(relativePlaceMatrix(project, containingPlaceId, building.id), building.boundary!)]));
  const pending = new Set(buildings.map(({ id }) => id)); const groups: PlaceNode[][] = [];
  while (pending.size) {
    const seed = pending.values().next().value as string; pending.delete(seed); const component = new Set([seed]); const frontier = [seed];
    while (frontier.length) {
      const current = frontier.pop()!;
      for (const candidate of [...pending]) if (positiveOverlap(shapes.get(current)!, shapes.get(candidate)!)) { pending.delete(candidate); component.add(candidate); frontier.push(candidate); }
    }
    if (component.size > 1) groups.push(buildings.filter(({ id }) => component.has(id)));
  }
  return groups;
}

function boundaryWalls(shape: RegionShape, identity: Identity): CanonicalWall[] {
  const rings = shapePolygons(shape).flatMap(({ outer, holes }) => [outer, ...holes]);
  return rings.flatMap((points) => points.map((start, index) => ({ id: identity.createId(), start, end: points[(index + 1) % points.length], thickness: .3, role: "boundary" as const })));
}

function transformWall(matrix: AffineMatrix, wall: CanonicalWall): CanonicalWall {
  return { ...wall, start: applyAffinePoint(matrix, wall.start), end: applyAffinePoint(matrix, wall.end) };
}

function pointSegmentDistance(point: KernelPoint, wall: CanonicalWall) {
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const squared = dx * dx + dy * dy;
  const position = squared ? Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / squared)) : 0;
  return { position, distance: Math.hypot(point.x - wall.start.x - dx * position, point.y - wall.start.y - dy * position) };
}

function withoutOuterDuplicates(walls: CanonicalWall[]) {
  const noded = materializeWallSegments(walls); const boundary = noded.filter(({ role }) => role === "boundary");
  return noded.filter((wall) => wall.role === "boundary" || !boundary.some((edge) => pointSegmentDistance({ x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }, edge).distance < 1e-5));
}

function transformedFaces(project: EditorProject, targetLevelId: string, sourceLevel: PlaceNode, document: EditorProject["constructions"][number]) {
  const matrix = relativePlaceMatrix(project, targetLevelId, sourceLevel.id);
  return constructionNetwork(document.walls, document.enclosure).faces.map((face): RoomFace => ({
    ...face,
    id: `${sourceLevel.id}:${face.id}`,
    outer: face.outer.map((point) => applyAffinePoint(matrix, point)),
    holes: face.holes.map((hole) => hole.map((point) => applyAffinePoint(matrix, point))),
  }));
}

function transformedRooms(sourceLevel: PlaceNode, document: EditorProject["constructions"][number]) {
  return document.rooms.map((room): RoomRecord => ({ ...room, faceId: `${sourceLevel.id}:${room.faceId}` }));
}

function remapOpenings(project: EditorProject, targetLevelId: string, sources: { level: PlaceNode; document: EditorProject["constructions"][number] }[], walls: CanonicalWall[]) {
  return sources.flatMap(({ level, document }) => {
    const matrix = relativePlaceMatrix(project, targetLevelId, level.id);
    return document.openings.flatMap((opening) => {
      const source = document.walls.find(({ id }) => id === opening.wallId); if (!source) return [];
      const at = applyAffinePoint(matrix, { x: source.start.x + (source.end.x - source.start.x) * opening.position, y: source.start.y + (source.end.y - source.start.y) * opening.position });
      const nearest = walls.map((wall) => ({ wall, ...pointSegmentDistance(at, wall) })).toSorted((a, b) => a.distance - b.distance)[0];
      return nearest && nearest.distance < .06 ? [{ ...opening, wallId: nearest.wall.id, position: nearest.position }] : [];
    });
  });
}

function matrixPose(matrix: AffineMatrix) {
  return { x: matrix[4], y: matrix[5], rotation: Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI };
}

function geometryAnchor(element: DrawingElement) {
  if (element.geometry.kind === "region") return regionBoundsCenter(element.geometry.shape);
  if (element.geometry.kind === "path") return element.geometry.points[0];
  if (element.geometry.kind === "bezier") return element.geometry.nodes[0]?.anchor;
  return element.geometry.at;
}

export function mergeBuildingOverlapGroup(project: EditorProject, buildingIds: string[], mode: BuildingMergeMode, identity: Identity) {
  const selected = buildingIds.flatMap((id) => project.places.find((place) => place.id === id && place.kind === "building") ?? []); const primary = selected[0];
  if (!primary?.parentId || selected.length < 2 || selected.some(({ parentId, boundary }) => parentId !== primary.parentId || !boundary)) return { state: "blocked" as const, project };
  const buildingUnion = unionRegionShapes(selected.map((building) => transformRegion(relativePlaceMatrix(project, primary.parentId!, building.id), building.boundary!)));
  if (!buildingUnion) return { state: "blocked" as const, project };
  const primaryBoundary = transformRegion(relativePlaceMatrix(project, primary.id, primary.parentId), buildingUnion);
  const levelSets = selected.map((building) => project.places.filter(({ parentId, kind }) => parentId === building.id && kind === "level"));
  const levelCount = Math.max(...levelSets.map(({ length }) => length));
  const targetLevelIds = new Set<string>(); const sourceLevelIds = new Set<string>(); const sourceConstructionIds = new Set<string>();
  const levelTarget = new Map<string, { id: string; matrix: AffineMatrix }>(); const mergedDocuments: EditorProject["constructions"] = []; const updatedLevels = new Map<string, PlaceNode>();

  for (let index = 0; index < levelCount; index += 1) {
    const levels = levelSets.flatMap((set) => set[index] ? [set[index]] : []); const target = levelSets[0][index] ?? levels[0]; if (!target) continue;
    const sources = levels.flatMap((level) => { const document = project.constructions.find(({ id }) => id === level.constructionId); return document ? [{ level, document }] : []; });
    if (!sources.length) continue;
    targetLevelIds.add(target.id); levels.forEach(({ id, constructionId }) => { sourceLevelIds.add(id); if (constructionId) sourceConstructionIds.add(constructionId); levelTarget.set(id, { id: target.id, matrix: relativePlaceMatrix(project, target.id, id) }); });
    const union = unionRegionShapes(levels.flatMap((level) => level.boundary ? [transformRegion(relativePlaceMatrix(project, target.id, level.id), level.boundary)] : []));
    if (!union) return { state: "blocked" as const, project };
    const outline = boundaryWalls(union, identity);
    const oldWalls = sources.flatMap(({ level, document }) => { const matrix = relativePlaceMatrix(project, target.id, level.id); return document.walls.map((wall) => ({ ...transformWall(matrix, wall), role: mode === "keep-partitions" && wall.role === "boundary" ? "partition" as const : wall.role })); });
    const interior = mode === "keep-partitions" ? oldWalls : oldWalls.filter(({ role }) => role !== "boundary");
    const walls = withoutOuterDuplicates([...outline, ...interior]);
    const fresh = createConstructionDocument(target.constructionId ?? identity.createId(), walls, { createId: identity.createId, createName: identity.createRoomName }, union);
    const previousFaces = sources.flatMap(({ level, document }) => transformedFaces(project, target.id, level, document));
    const previousRooms = sources.flatMap(({ level, document }) => transformedRooms(level, document));
    const reconciliation = reconcileRooms(previousFaces, constructionNetwork(fresh.walls, fresh.enclosure).faces, previousRooms, identity.createId, identity.createRoomName);
    const openings = remapOpenings(project, target.id, sources, fresh.walls);
    const transitions = sources.flatMap(({ level, document }) => { const matrix = relativePlaceMatrix(project, target.id, level.id); return document.transitions.map((transition) => ({ ...transition, footprint: transformRegion(matrix, transition.footprint) })); });
    mergedDocuments.push({ ...fresh, revision: Math.max(...sources.map(({ document }) => document.revision)) + 1, rooms: reconciliation.rooms, openings, transitions });
    const targetTransform = target.parentId === primary.id ? target.transform : matrixPose(relativePlaceMatrix(project, primary.id, target.id));
    updatedLevels.set(target.id, { ...target, parentId: primary.id, transform: targetTransform, boundary: union, constructionId: fresh.id });
  }

  const sourceRoomToLevel = new Map(project.places.filter(({ kind, parentId }) => kind === "room" && parentId && sourceLevelIds.has(parentId)).map((room) => [room.id, room.parentId!]));
  const oldRoomAppearance = new Map(project.places.filter(({ kind }) => kind === "room").map((room) => [room.id, room.appearance]));
  const selectedIds = new Set(selected.map(({ id }) => id)); const removedLevelIds = new Set([...sourceLevelIds].filter((id) => !targetLevelIds.has(id)));
  const directSecondaryChildren = project.places.filter(({ parentId, kind }) => parentId && selectedIds.has(parentId) && parentId !== primary.id && kind !== "level" && kind !== "room");
  let places = project.places.filter((place) => !selectedIds.has(place.id) || place.id === primary.id).filter((place) => !removedLevelIds.has(place.id) && !sourceRoomToLevel.has(place.id));
  places = places.map((place) => place.id === primary.id ? { ...place, boundary: primaryBoundary, tags: [...new Set(selected.flatMap(({ tags }) => tags))], access: [...new Set(selected.flatMap(({ access }) => access))], properties: Object.assign({}, ...selected.map(({ properties }) => properties), primary.properties) } : updatedLevels.get(place.id) ?? place);
  places = places.map((place) => directSecondaryChildren.some(({ id }) => id === place.id) ? { ...place, parentId: primary.id, transform: matrixPose(relativePlaceMatrix(project, primary.id, place.id)) } : place);

  const constructions = [...project.constructions.filter(({ id }) => !sourceConstructionIds.has(id)), ...mergedDocuments];
  const roomFacesByLevel = new Map(mergedDocuments.map((document) => [updatedLevels.values().find((level) => level.constructionId === document.id)?.id, { document, faces: constructionNetwork(document.walls, document.enclosure).faces }]));
  const elements = project.elements.map((element) => {
    if (element.belongsToId === primary.id) return element;
    const secondaryBuilding = selected.find(({ id }) => id === element.belongsToId && id !== primary.id);
    if (secondaryBuilding) return { ...element, belongsToId: primary.id, geometry: transformDrawingGeometry(relativePlaceMatrix(project, primary.id, secondaryBuilding.id), element.geometry) };
    const sourceLevelId = sourceLevelIds.has(element.belongsToId) ? element.belongsToId : sourceRoomToLevel.get(element.belongsToId);
    if (!sourceLevelId) return element;
    const targetInfo = levelTarget.get(sourceLevelId); if (!targetInfo) return element;
    const geometry = transformDrawingGeometry(targetInfo.matrix, element.geometry); const anchor = geometryAnchor({ ...element, geometry });
    const roomData = roomFacesByLevel.get(targetInfo.id); const room = anchor && roomData ? roomData.document.rooms.find((candidate) => { const face = roomData.faces.find(({ id }) => id === candidate.faceId); return face && pointInRegion(anchor, roomFaceShape(face)); }) : undefined;
    return { ...element, geometry, belongsToId: room?.id ?? targetInfo.id };
  });
  const surfaces = project.surfaces.map((surface) => {
    if (surface.belongsToId === primary.id) return surface;
    const secondaryBuilding = selected.find(({ id }) => id === surface.belongsToId && id !== primary.id);
    if (secondaryBuilding) return { ...surface, belongsToId: primary.id, shape: transformRegion(relativePlaceMatrix(project, primary.id, secondaryBuilding.id), surface.shape) };
    const sourceLevelId = sourceLevelIds.has(surface.belongsToId) ? surface.belongsToId : sourceRoomToLevel.get(surface.belongsToId);
    if (!sourceLevelId) return surface;
    const targetInfo = levelTarget.get(sourceLevelId); if (!targetInfo) return surface;
    const shape = transformRegion(targetInfo.matrix, surface.shape);
    const anchor = regionBoundsCenter(shape); const roomData = roomFacesByLevel.get(targetInfo.id);
    const room = roomData?.document.rooms.find((candidate) => { const face = roomData.faces.find(({ id }) => id === candidate.faceId); return face && pointInRegion(anchor, roomFaceShape(face)); });
    return { ...surface, shape, belongsToId: room?.id ?? targetInfo.id };
  });
  let next: EditorProject = { ...project, places, constructions, elements, surfaces };
  for (const document of mergedDocuments) next = syncConstructionRooms(next, document);
  next = { ...next, places: next.places.map((place) => place.kind === "room" && oldRoomAppearance.has(place.id) ? { ...place, appearance: oldRoomAppearance.get(place.id) } : place) };
  return { state: "merged" as const, project: next, survivorId: primary.id };
}
