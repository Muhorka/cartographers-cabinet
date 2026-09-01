import { constructionNetwork } from "../construction/construction-network";
import { commitConstructionTransaction, previewWallReplacement } from "../construction/construction-document";
import { pointInRegion, shapePoints, shapePolygons } from "../geometry/region-constraints";
import type { KernelPoint } from "../geometry/geometry-types";
import type { DrawingElement, EditorProject, RegionShape } from "../model/project-model";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { sampleBezier } from "../geometry/bezier-geometry";

import { syncConstructionRooms } from "../model/hierarchy-operations";
import { workLayerAvailability } from "../model/work-context";
import { subtractEraserFromPath, subtractEraserFromRegion } from "../geometry/eraser-geometry";
import { applyAffinePoint, relativePlaceMatrix, transformRegion } from "../geometry/affine-transform";
import { eraseRibbon } from "../roads/road-eraser";
import { isRibbonElement } from "../geometry/ribbon-geometry";
import { noteCorners } from "../geometry/note-geometry";

type Identity = { createId(): string; createName(index: number): string };

function pointSegmentDistance(point: KernelPoint, start: KernelPoint, end: KernelPoint) {
  const dx = end.x - start.x; const dy = end.y - start.y; const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0;
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function orientation(a: KernelPoint, b: KernelPoint, c: KernelPoint) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function intersects(a: KernelPoint, b: KernelPoint, c: KernelPoint, d: KernelPoint) {
  const overlaps = (firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) => Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd)) <= Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd));
  return overlaps(a.x, b.x, c.x, d.x) && overlaps(a.y, b.y, c.y, d.y)
    && orientation(a, b, c) * orientation(a, b, d) <= 0 && orientation(c, d, a) * orientation(c, d, b) <= 0;
}
function segmentDistance(a: KernelPoint, b: KernelPoint, c: KernelPoint, d: KernelPoint) { return intersects(a, b, c, d) ? 0 : Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b)); }
function strokeSegments(points: KernelPoint[]) { return points.length === 1 ? [[points[0], points[0]] as const] : points.slice(0, -1).map((point, index) => [point, points[index + 1]] as const); }
function polylineHit(points: KernelPoint[], eraser: KernelPoint[], radius: number) { return strokeSegments(points).some(([a, b]) => strokeSegments(eraser).some(([c, d]) => segmentDistance(a, b, c, d) <= radius)); }

const pointInShape = pointInRegion;

function regionHit(shape: RegionShape, eraser: KernelPoint[], radius: number) {
  const rings = shapePolygons(shape).flatMap(({ outer, holes }) => [outer, ...holes]);
  return eraser.some((point) => pointInShape(point, shape)) || rings.some((ring) => polylineHit([...ring, ring[0]], eraser, radius));
}

function shapeInParent(shape: RegionShape, transform: { x: number; y: number; rotation: number }): RegionShape {
  const radians = transform.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const map = ({ x, y }: KernelPoint) => ({ x: x * cosine - y * sine + transform.x, y: x * sine + y * cosine + transform.y });
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(map), holes: holes.map((hole) => hole.map(map)) })) };
  return { kind: "polygon", points: shapePoints(shape).map(map) };
}

function eraseConstructionSurfaces(project: EditorProject, activePlaceId: string, points: KernelPoint[], radius: number, createId: () => string) {
  const availability = workLayerAvailability(project, activePlaceId, "construction");
  const owners = new Set([activePlaceId, ...(availability.available ? [availability.targetPlaceId] : [])]);
  let changed = false;
  const surfaces = project.surfaces.flatMap((surface) => {
    if (!owners.has(surface.belongsToId) || surface.locked) return [surface];
    const matrix = relativePlaceMatrix(project, surface.belongsToId, activePlaceId);
    const activeShape = transformRegion(matrix, surface.shape);
    if (!regionHit(activeShape, points, radius)) return [surface];
    const inverse = relativePlaceMatrix(project, activePlaceId, surface.belongsToId);
    const ownerPoints = points.map((point) => applyAffinePoint(inverse, point));
    const pieces = subtractEraserFromRegion(surface.shape, ownerPoints, radius);
    changed = true;
    return pieces.map((shape, index) => ({ ...surface, id: index ? `${surface.id}:cut:${createId()}` : surface.id, shape }));
  });
  return changed ? { state: "erased" as const, project: { ...project, surfaces } } : { state: "nothing" as const, project };
}

function erasePath(element: DrawingElement, eraser: KernelPoint[], radius: number, createId: () => string) {
  if (element.geometry.kind === "bezier") {
    const sampled = sampleBezier(element.geometry.nodes, element.geometry.closed);
    if (!polylineHit(sampled, eraser, radius)) return [element];
    return subtractEraserFromPath(sampled, eraser, radius).map((points, index) => ({ ...element, id: index ? createId() : element.id, geometry: { kind: "path" as const, points, closed: false } }));
  }
  if (element.geometry.kind !== "path") return regionOrPointHit(element, eraser, radius) ? [] : [element];
  if (!polylineHit(element.geometry.points, eraser, radius)) return [element];
  const pieces = subtractEraserFromPath(element.geometry.points, eraser, radius);
  return pieces.map((points, index) => ({ ...element, id: index ? createId() : element.id, geometry: { kind: "path" as const, points, closed: false } }));
}

function regionOrPointHit(element: DrawingElement, eraser: KernelPoint[], radius: number) {
  if (element.geometry.kind === "region") return regionHit(element.geometry.shape, eraser, radius);
  if (element.geometry.kind === "bezier") return polylineHit(sampleBezier(element.geometry.nodes, element.geometry.closed), eraser, radius);
  if (element.geometry.kind === "point") { const at = element.geometry.at; return eraser.some((point) => Math.hypot(point.x - at.x, point.y - at.y) <= radius); }
  if (element.geometry.kind === "note") return regionHit({ kind: "polygon", points: noteCorners(element.geometry) }, eraser, radius);
  return false;
}

function eraseRegion(element: DrawingElement, eraser: KernelPoint[], radius: number, createId: () => string) {
  if (element.geometry.kind !== "region") return erasePath(element, eraser, radius, createId);
  if (!regionHit(element.geometry.shape, eraser, radius)) return [element];
  return subtractEraserFromRegion(element.geometry.shape, eraser, radius).map((shape, index) => ({
    ...element,
    id: index ? createId() : element.id,
    geometry: { kind: "region" as const, shape },
  }));
}

function openingSegment(document: EditorProject["constructions"][number], opening: EditorProject["constructions"][number]["openings"][number]) {
  const wall = document.walls.find(({ id }) => id === opening.wallId); if (!wall) return undefined;
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const length = Math.hypot(dx, dy); if (!length) return undefined;
  const center = { x: wall.start.x + dx * opening.position, y: wall.start.y + dy * opening.position };
  const half = opening.width / 2;
  return [
    { x: center.x - dx / length * half, y: center.y - dy / length * half },
    { x: center.x + dx / length * half, y: center.y + dy / length * half },
  ];
}

function eraseOpenings(project: EditorProject, activePlaceId: string, points: KernelPoint[], radius: number) {
  const availability = workLayerAvailability(project, activePlaceId, "openings");
  if (!availability.available) return { state: "nothing" as const, project };
  const construction = availability.constructionId ? project.constructions.find(({ id }) => id === availability.constructionId) : undefined;
  if (!construction) return { state: "nothing" as const, project };
  const target = project.places.find(({ id }) => id === availability.targetPlaceId);
  const network = constructionNetwork(construction.walls, construction.enclosure);
  const room = target?.kind === "room" ? construction.rooms.find(({ id }) => id === target.id) : undefined;
  const roomFace = room ? network.faces.find(({ id }) => id === room.faceId) : undefined;
  const openingIds = new Set(construction.openings.flatMap((opening) => {
    const wall = construction.walls.find(({ id }) => id === opening.wallId); if (opening.locked || wall?.locked) return [];
    if (roomFace && !roomFace.wallIds.includes(opening.wallId)) return [];
    const segment = openingSegment(construction, opening);
    return segment && polylineHit(segment, points, radius) ? [opening.id] : [];
  }));
  const transitionIds = new Set(construction.transitions.filter(({ footprint, locked }) => !locked && (!target?.boundary || target.kind !== "room" || shapePoints(footprint).every((point) => pointInShape(point, target.boundary!))) && regionHit(footprint, points, radius)).map(({ id }) => id));
  if (!openingIds.size && !transitionIds.size) return { state: "nothing" as const, project };
  const document = {
    ...construction,
    revision: construction.revision + 1,
    openings: construction.openings.filter(({ id }) => !openingIds.has(id)),
    transitions: construction.transitions.filter(({ id }) => !transitionIds.has(id)),
  };
  return { state: "erased" as const, project: { ...project, constructions: project.constructions.map((item) => item.id === construction.id ? document : item) } };
}

export function eraseCurrentLayer(project: EditorProject, input: { activePlaceId: string; layerId: WorkLayerId; points: KernelPoint[]; radius: number; boundaryEditing: boolean }, identity: Identity) {
  if (!input.points.length) return { state: "nothing" as const, project };
  if (input.layerId === "roads") {
    let changed = false; const elements = project.elements.flatMap((element) => {
      if (element.belongsToId !== input.activePlaceId || element.layerId !== "roads" || element.locked) return [element];
      const pieces = eraseRibbon(element, input.points, input.radius); if (pieces.length !== 1 || pieces[0] !== element) changed = true; return pieces;
    });
    return changed ? { state: "erased" as const, project: { ...project, elements } } : { state: "nothing" as const, project };
  }
  if (input.layerId === "terrain" || input.layerId === "sketch") {
    let changed = false; const elements = project.elements.flatMap((element) => {
      if (element.belongsToId !== input.activePlaceId || element.layerId !== input.layerId || element.locked) return [element];
      const pieces = isRibbonElement(element) ? eraseRibbon(element, input.points, input.radius) : eraseRegion(element, input.points, input.radius, identity.createId); if (pieces.length !== 1 || pieces[0] !== element) changed = true; return pieces;
    });
    return changed ? { state: "erased" as const, project: { ...project, elements } } : { state: "nothing" as const, project };
  }
  if (input.layerId === "equipment") {
    const elements = project.elements.filter((element) => element.belongsToId !== input.activePlaceId || element.layerId !== "equipment" || element.locked || !regionOrPointHit(element, input.points, input.radius));
    return elements.length === project.elements.length ? { state: "nothing" as const, project } : { state: "erased" as const, project: { ...project, elements } };
  }
  if (input.layerId === "construction") {
    const availability = workLayerAvailability(project, input.activePlaceId, "construction");
    const surfaces = eraseConstructionSurfaces(project, input.activePlaceId, input.points, input.radius, identity.createId);
    const surfaceProject = surfaces.project;
    const construction = availability.available && availability.constructionId ? project.constructions.find(({ id }) => id === availability.constructionId) : undefined;
    if (!construction) return surfaces.state === "erased" ? surfaces : { state: "nothing" as const, project };
    const network = constructionNetwork(construction.walls, construction.enclosure);
    const active = project.places.find(({ id }) => id === input.activePlaceId); const activeRoom = active?.kind === "room" ? construction.rooms.find(({ id }) => id === active.id) : undefined;
    const activeFace = activeRoom ? network.faces.find(({ id }) => id === activeRoom.faceId) : undefined; const editableWallIds = activeFace ? new Set(activeFace.wallIds) : undefined;
    let changed = false;
    const walls = construction.walls.flatMap((wall) => {
      const editable = !wall.locked && (!editableWallIds || editableWallIds.has(wall.id)) && (input.boundaryEditing || wall.role !== "boundary");
      if (!editable || !polylineHit([wall.start, wall.end], input.points, input.radius)) return [wall];
      const pieces = subtractEraserFromPath([wall.start, wall.end], input.points, input.radius);
      if (pieces.length === 1 && pieces[0][0].x === wall.start.x && pieces[0][0].y === wall.start.y && pieces[0].at(-1)!.x === wall.end.x && pieces[0].at(-1)!.y === wall.end.y) return [wall];
      changed = true;
      return pieces.map((points, index) => ({ ...wall, id: index ? `${wall.id}:cut:${identity.createId()}` : wall.id, start: points[0], end: points.at(-1)! }));
    });
    const transaction = changed ? previewWallReplacement(construction, walls, identity) : undefined;
    if (!transaction) return surfaces.state === "erased" ? surfaces : { state: "nothing" as const, project };
    const committed = commitConstructionTransaction(construction, transaction);
    if (committed.state !== "committed") return { state: "blocked" as const, project };
    const next = { ...surfaceProject, constructions: surfaceProject.constructions.map((item) => item.id === construction.id ? committed.document : item) };
    return { state: "erased" as const, project: syncConstructionRooms(next, committed.document) };
  }
  if (input.layerId === "boundaries" || input.layerId === "buildings") {
    const candidates = project.places.filter(({ parentId, kind, boundary, transform, locked }) => parentId === input.activePlaceId && !locked && boundary && (input.layerId === "buildings" ? kind === "building" : kind === "location") && regionHit(shapeInParent(boundary, transform), input.points, input.radius)).map(({ id }) => id);
    return candidates.length ? { state: "review-required" as const, project, candidateIds: candidates } : { state: "nothing" as const, project };
  }
  if (input.layerId === "openings") return eraseOpenings(project, input.activePlaceId, input.points, input.radius);
  return { state: "nothing" as const, project };
}
