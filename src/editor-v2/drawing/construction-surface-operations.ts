import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import { repairRegionShape } from "../geometry/region-constraints";
import { unionCompatibleRegionShapes } from "../geometry/region-union";
import { resizeRegionFromCorner, type ResizeCorner } from "../geometry/region-resize";
import { translateRegion } from "../geometry/region-transform";
import { moveRegionVertex } from "../geometry/region-vertex-edit";
import type { ConstructionSurface, EditorProject, MapAppearance, RegionShape } from "../model/project-model";
import type { SelectionOperationResult } from "./selection-operations";

type Transformation = { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" };
export type ConstructionSurfaceGroupResult = { state: "applied"; project: EditorProject; selectedIds: string[] } | { state: "blocked"; project: EditorProject; reason: "not-found" | "locked-outline" | "unsupported" | "collision" };

function shapePoints(shape: RegionShape): KernelPoint[] {
  if (shape.kind === "rectangle") return [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }, { x: shape.x, y: shape.y + shape.height }];
  if (shape.kind === "circle") return [{ x: shape.cx - shape.radius, y: shape.cy }, { x: shape.cx + shape.radius, y: shape.cy }];
  if (shape.kind === "ellipse") return [{ x: shape.cx - shape.rx, y: shape.cy }, { x: shape.cx + shape.rx, y: shape.cy }];
  if (shape.kind === "bezier") return shape.nodes.map(({ anchor }) => anchor);
  if (shape.kind === "compound") return shape.polygons.flatMap(({ outer }) => outer);
  return shape.points;
}

function pointTransform(point: KernelPoint, center: KernelPoint, transformation: Transformation) {
  const x = point.x - center.x; const y = point.y - center.y;
  if (transformation.kind === "mirror") return transformation.axis === "horizontal" ? { x: center.x - x, y: point.y } : { x: point.x, y: center.y - y };
  return transformation.degrees === 90 ? { x: center.x - y, y: center.y + x } : { x: center.x + y, y: center.y - x };
}

function transformNodes(nodes: BezierNode[], center: KernelPoint, transformation: Transformation) {
  const map = (point?: KernelPoint) => point ? pointTransform(point, center, transformation) : undefined;
  return nodes.map((node) => ({ anchor: map(node.anchor)!, inHandle: map(node.inHandle), outHandle: map(node.outHandle) }));
}

function transformShape(shape: RegionShape, center: KernelPoint, transformation: Transformation): RegionShape {
  if (shape.kind === "rectangle") return { kind: "polygon", points: shapePoints(shape).map((point) => pointTransform(point, center, transformation)) };
  if (shape.kind === "circle") { const at = pointTransform({ x: shape.cx, y: shape.cy }, center, transformation); return { ...shape, cx: at.x, cy: at.y }; }
  if (shape.kind === "ellipse") { const at = pointTransform({ x: shape.cx, y: shape.cy }, center, transformation); return transformation.kind === "rotate" ? { ...shape, cx: at.x, cy: at.y, rx: shape.ry, ry: shape.rx } : { ...shape, cx: at.x, cy: at.y }; }
  if (shape.kind === "bezier") return { ...shape, nodes: transformNodes(shape.nodes, center, transformation) };
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map((point) => pointTransform(point, center, transformation)), holes: holes.map((hole) => hole.map((point) => pointTransform(point, center, transformation))) })) };
  return { ...shape, points: shape.points.map((point) => pointTransform(point, center, transformation)) };
}

function surfaceCenter(surface: ConstructionSurface): KernelPoint {
  const points = shapePoints(surface.shape); const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export function transformConstructionSurface(project: EditorProject, id: string, transformation: Transformation): SelectionOperationResult {
  const surface = project.surfaces.find((candidate) => candidate.id === id);
  if (!surface) return { state: "blocked", project, reason: "not-found" };
  if (surface.locked) return { state: "blocked", project, reason: "locked-outline" };
  const shape = transformShape(surface.shape, surfaceCenter(surface), transformation);
  return { state: "applied", project: { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === id ? { ...candidate, shape } : candidate) } };
}

export function transformSelectedConstructionSurfaces(project: EditorProject, ids: readonly string[], transformation: Transformation): ConstructionSurfaceGroupResult {
  let next = project;
  for (const id of ids) {
    const result = transformConstructionSurface(next, id, transformation);
    if (result.state !== "applied") return { state: "blocked", project, reason: result.state === "blocked" && (result.reason === "not-found" || result.reason === "locked-outline") ? result.reason : "collision" }; next = result.project;
  }
  return { state: "applied", project: next, selectedIds: [...ids] };
}

export function duplicateSelectedConstructionSurfaces(project: EditorProject, ids: readonly string[], createId: () => string, copyName: (name: string) => string) {
  const selected = project.surfaces.filter(({ id }) => ids.includes(id));
  if (!selected.length || selected.some(({ locked }) => locked)) return { state: "blocked" as const, project, reason: selected.length ? "locked-outline" as const : "not-found" as const };
  const copies = selected.map((surface) => ({ ...structuredClone(surface), id: createId(), name: copyName(surface.name), shape: translateRegion(surface.shape, { x: 2, y: 2 }) }));
  return { state: "applied" as const, project: { ...project, surfaces: [...project.surfaces, ...copies] }, selectedIds: copies.map(({ id }) => id) };
}

export function mergeSelectedConstructionSurfaces(project: EditorProject, ids: readonly string[]) {
  const selected = project.surfaces.filter(({ id }) => ids.includes(id)); const first = selected[0];
  if (selected.length < 2 || selected.some(({ locked, belongsToId, kind }) => locked || belongsToId !== first.belongsToId || kind !== first.kind)) return { state: "blocked" as const, project, reason: "unsupported" as const };
  const union = unionCompatibleRegionShapes(selected.map(({ shape: candidate }) => candidate));
  if (!union || union.state === "unchanged") return { state: "blocked" as const, project, reason: "collision" as const };
  const shape = union.shape;
  const removed = new Set(ids.slice(1));
  return { state: "applied" as const, project: { ...project, surfaces: project.surfaces.filter(({ id }) => !removed.has(id)).map((surface) => surface.id === first.id ? { ...surface, shape } : surface) }, selectedIds: [first.id] };
}

export function moveConstructionSurface(project: EditorProject, id: string, delta: KernelPoint): SelectionOperationResult {
  const surface = project.surfaces.find((candidate) => candidate.id === id);
  if (!surface) return { state: "blocked", project, reason: "not-found" };
  if (surface.locked) return { state: "blocked", project, reason: "locked-outline" };
  return { state: "applied", project: { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === id ? { ...candidate, shape: translateRegion(candidate.shape, delta) } : candidate) } };
}

export function resizeConstructionSurface(project: EditorProject, id: string, corner: ResizeCorner, point: KernelPoint): SelectionOperationResult {
  const surface = project.surfaces.find((candidate) => candidate.id === id);
  if (!surface) return { state: "blocked", project, reason: "not-found" };
  if (surface.locked) return { state: "blocked", project, reason: "locked-outline" };
  const shape = resizeRegionFromCorner(surface.shape, corner, point);
  if (!shape) return { state: "blocked", project, reason: "collision" };
  return { state: "applied", project: { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === id ? { ...candidate, shape } : candidate) } };
}

export function moveConstructionSurfaceVertex(project: EditorProject, id: string, polygonIndex: number, vertexIndex: number, point: KernelPoint): SelectionOperationResult {
  const surface = project.surfaces.find((candidate) => candidate.id === id);
  if (!surface) return { state: "blocked", project, reason: "not-found" };
  if (surface.locked) return { state: "blocked", project, reason: "locked-outline" };
  const changed = moveRegionVertex(surface.shape, polygonIndex, vertexIndex, point);
  const shape = changed && repairRegionShape(changed);
  if (!shape) return { state: "blocked", project, reason: "collision" };
  return { state: "applied", project: { ...project, surfaces: project.surfaces.map((candidate) => candidate.id === id ? { ...candidate, shape } : candidate) } };
}

export function updateConstructionSurface(project: EditorProject, id: string, details: { name?: string; description?: string; tags?: string[]; belongsToId?: string; appearance?: MapAppearance; visible?: boolean; locked?: boolean; attachment?: "free" | "attached"; elevation?: number }) {
  if (!project.surfaces.some((surface) => surface.id === id)) return project;
  if (details.belongsToId !== undefined && !project.places.some(({ id: placeId }) => placeId === details.belongsToId)) return project;
  const patch = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
  return { ...project, surfaces: project.surfaces.map((surface) => surface.id === id ? { ...surface, ...patch } : surface) };
}
