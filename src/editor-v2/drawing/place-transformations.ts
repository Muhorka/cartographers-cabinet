import { relativePlaceMatrix, transformDrawingGeometry, transformRegion, type AffineMatrix } from "../geometry/affine-transform";
import type { KernelPoint } from "../geometry/geometry-types";
import { assessRegionConstraint, shapePoints, unionRegionShapes } from "../geometry/region-constraints";
import type { EditorProject, PlaceNode } from "../model/project-model";
import { mergeBuildingOverlapGroup, type BuildingMergeMode } from "./building-overlap-operations";

type Identity = { createId(): string; createRoomName(index: number): string };
type Transformation = { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" };
export type PlaceTransformationResult = { state: "applied"; project: EditorProject; selectedIds: string[] } | { state: "blocked"; project: EditorProject; reason: "not-found" | "mixed-parents" | "outside-outline" | "unsupported" | "disconnected" };

function selectedPlaces(project: EditorProject, ids: readonly string[]) {
  return ids.flatMap((id) => project.places.find((place) => place.id === id) ?? []);
}

function transformPoint(point: KernelPoint, center: KernelPoint, transformation: Transformation) {
  const x = point.x - center.x; const y = point.y - center.y;
  if (transformation.kind === "rotate") return transformation.degrees === 90 ? { x: center.x - y, y: center.y + x } : { x: center.x + y, y: center.y - x };
  return transformation.axis === "horizontal" ? { x: center.x - x, y: point.y } : { x: point.x, y: center.y - y };
}

function transformedRotation(rotation: number, transformation: Transformation) {
  if (transformation.kind === "rotate") return rotation + transformation.degrees;
  return transformation.axis === "horizontal" ? 180 - rotation : -rotation;
}

function groupCenter(project: EditorProject, parentId: string, places: PlaceNode[]) {
  const points = places.flatMap((place) => place.boundary ? shapePoints(transformRegion(relativePlaceMatrix(project, parentId, place.id), place.boundary)) : []);
  if (!points.length) return undefined; const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function transformedPlace(place: PlaceNode, center: KernelPoint, transformation: Transformation): PlaceNode {
  const at = transformPoint({ x: place.transform.x, y: place.transform.y }, center, transformation);
  return { ...place, transform: { x: at.x, y: at.y, rotation: transformedRotation(place.transform.rotation, transformation) } };
}

function placeFits(project: EditorProject, place: PlaceNode) {
  if (!place.boundary || !place.parentId || place.kind === "location" || place.kind === "custom") return true;
  const parent = project.places.find(({ id }) => id === place.parentId); if (!parent?.boundary) return true;
  const radians = place.transform.rotation * Math.PI / 180; const matrix: AffineMatrix = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), place.transform.x, place.transform.y];
  return assessRegionConstraint(transformRegion(matrix, place.boundary), parent.boundary).state === "inside";
}

export function transformSelectedPlaces(project: EditorProject, ids: readonly string[], transformation: Transformation): PlaceTransformationResult {
  const places = selectedPlaces(project, ids); const parentId = places[0]?.parentId;
  if (!places.length || places.length !== new Set(ids).size) return { state: "blocked", project, reason: "not-found" };
  if (!parentId || places.some((place) => place.parentId !== parentId || place.kind === "level" || place.kind === "room" || place.kind === "world")) return { state: "blocked", project, reason: "mixed-parents" };
  const center = groupCenter(project, parentId, places); if (!center) return { state: "blocked", project, reason: "unsupported" };
  const changed = places.map((place) => transformedPlace(place, center, transformation));
  if (changed.some((place) => !placeFits(project, place))) return { state: "blocked", project, reason: "outside-outline" };
  const byId = new Map(changed.map((place) => [place.id, place]));
  return { state: "applied", project: { ...project, places: project.places.map((place) => byId.get(place.id) ?? place) }, selectedIds: places.map(({ id }) => id) };
}

function descendants(project: EditorProject, rootIds: readonly string[]) {
  const wanted = new Set(rootIds); let changed = true;
  while (changed) { changed = false; for (const place of project.places) if (place.parentId && wanted.has(place.parentId) && !wanted.has(place.id)) { wanted.add(place.id); changed = true; } }
  return wanted;
}

function duplicateRoots(project: EditorProject, ids: readonly string[], identity: Identity, copyName: (name: string) => string) {
  const selected = selectedPlaces(project, ids); const selectedIds = new Set(selected.map(({ id }) => id));
  const roots = selected.filter((place) => { let parentId = place.parentId; while (parentId) { if (selectedIds.has(parentId)) return false; parentId = project.places.find(({ id }) => id === parentId)?.parentId; } return true; });
  const treeIds = descendants(project, roots.map(({ id }) => id)); const placeId = new Map([...treeIds].map((id) => [id, identity.createId()]));
  const sourceConstructions = project.constructions.filter((document) => project.places.some((place) => treeIds.has(place.id) && place.constructionId === document.id));
  const constructionId = new Map(sourceConstructions.map(({ id }) => [id, identity.createId()])); const wallIds = new Map<string, string>();
  sourceConstructions.forEach((document) => document.walls.forEach(({ id }) => wallIds.set(`${document.id}:${id}`, identity.createId())));
  const rootSet = new Set(roots.map(({ id }) => id));
  const places = project.places.filter(({ id }) => treeIds.has(id)).map((place) => ({ ...structuredClone(place), id: placeId.get(place.id)!, name: rootSet.has(place.id) ? copyName(place.name) : place.name, parentId: place.parentId && treeIds.has(place.parentId) ? placeId.get(place.parentId) : place.parentId, constructionId: place.constructionId ? constructionId.get(place.constructionId) : undefined, transform: rootSet.has(place.id) ? { ...place.transform, x: place.transform.x + 2, y: place.transform.y + 2 } : place.transform }));
  const constructions = sourceConstructions.map((document) => ({ ...structuredClone(document), id: constructionId.get(document.id)!, walls: document.walls.map((wall) => ({ ...wall, id: wallIds.get(`${document.id}:${wall.id}`)! })), rooms: document.rooms.map((room) => ({ ...room, id: placeId.get(room.id) ?? identity.createId() })), openings: document.openings.map((opening) => ({ ...opening, id: identity.createId(), wallId: wallIds.get(`${document.id}:${opening.wallId}`) ?? opening.wallId })), transitions: document.transitions.map((transition) => ({ ...transition, id: identity.createId(), targetLevelId: transition.targetLevelId ? placeId.get(transition.targetLevelId) ?? transition.targetLevelId : undefined })) }));
  const elements = project.elements.filter(({ belongsToId }) => treeIds.has(belongsToId)).map((element) => ({ ...structuredClone(element), id: identity.createId(), belongsToId: placeId.get(element.belongsToId)! }));
  const surfaces = project.surfaces.filter(({ belongsToId }) => treeIds.has(belongsToId)).map((surface) => ({ ...structuredClone(surface), id: identity.createId(), belongsToId: placeId.get(surface.belongsToId)! }));
  return { project: { ...project, places: [...project.places, ...places], constructions: [...project.constructions, ...constructions], elements: [...project.elements, ...elements], surfaces: [...project.surfaces, ...surfaces] }, selectedIds: roots.map(({ id }) => placeId.get(id)!) };
}

export function duplicateSelectedPlaces(project: EditorProject, ids: readonly string[], identity: Identity, copyName: (name: string) => string): PlaceTransformationResult {
  const places = selectedPlaces(project, ids); if (!places.length || places.length !== new Set(ids).size) return { state: "blocked", project, reason: "not-found" };
  if (places.some(({ kind }) => kind === "level" || kind === "room" || kind === "world")) return { state: "blocked", project, reason: "unsupported" };
  const duplicated = duplicateRoots(project, ids, identity, copyName); const copies = selectedPlaces(duplicated.project, duplicated.selectedIds);
  if (copies.some((place) => !placeFits(duplicated.project, place))) return { state: "blocked", project, reason: "outside-outline" };
  return { state: "applied", ...duplicated };
}

function matrixPose(matrix: AffineMatrix) { return { x: matrix[4], y: matrix[5], rotation: Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI }; }

function mergeGenericPlaces(project: EditorProject, places: PlaceNode[]): PlaceTransformationResult {
  const primary = places[0]; const parentId = primary.parentId!;
  const union = unionRegionShapes(places.map((place) => transformRegion(relativePlaceMatrix(project, parentId, place.id), place.boundary!)));
  if (!union) return { state: "blocked", project, reason: "disconnected" };
  const primaryBoundary = transformRegion(relativePlaceMatrix(project, primary.id, parentId), union); const removed = new Set(places.slice(1).map(({ id }) => id));
  const directChildren = project.places.filter(({ parentId: owner }) => owner && removed.has(owner));
  const childTransforms = new Map(directChildren.map((child) => [child.id, matrixPose(relativePlaceMatrix(project, primary.id, child.id))]));
  const placesNext = project.places.filter(({ id }) => !removed.has(id)).map((place) => place.id === primary.id ? { ...place, boundary: primaryBoundary, tags: [...new Set(places.flatMap(({ tags }) => tags))], access: [...new Set(places.flatMap(({ access }) => access))], properties: Object.assign({}, ...places.map(({ properties }) => properties), primary.properties) } : childTransforms.has(place.id) ? { ...place, parentId: primary.id, transform: childTransforms.get(place.id)! } : place);
  const elements = project.elements.map((element) => { const owner = places.find(({ id }) => id === element.belongsToId && id !== primary.id); return owner ? { ...element, belongsToId: primary.id, geometry: transformDrawingGeometry(relativePlaceMatrix(project, primary.id, owner.id), element.geometry) } : element; });
  const surfaces = project.surfaces.map((surface) => { const owner = places.find(({ id }) => id === surface.belongsToId && id !== primary.id); return owner ? { ...surface, belongsToId: primary.id, shape: transformRegion(relativePlaceMatrix(project, primary.id, owner.id), surface.shape) } : surface; });
  return { state: "applied", project: { ...project, places: placesNext, elements, surfaces }, selectedIds: [primary.id] };
}

export function mergeSelectedPlaces(project: EditorProject, ids: readonly string[], mode: BuildingMergeMode, identity: Identity): PlaceTransformationResult {
  const places = selectedPlaces(project, ids); const primary = places[0];
  if (places.length < 2 || places.length !== new Set(ids).size) return { state: "blocked", project, reason: "not-found" };
  if (!primary?.parentId || places.some((place) => place.parentId !== primary.parentId || place.kind !== primary.kind || !place.boundary)) return { state: "blocked", project, reason: "mixed-parents" };
  if (primary.kind === "building") { const result = mergeBuildingOverlapGroup(project, [...ids], mode, identity); return result.state === "merged" ? { state: "applied", project: result.project, selectedIds: [result.survivorId] } : { state: "blocked", project, reason: "disconnected" }; }
  if (!["location", "custom", "object"].includes(primary.kind) || places.some(({ constructionId }) => constructionId)) return { state: "blocked", project, reason: "unsupported" };
  return mergeGenericPlaces(project, places);
}
