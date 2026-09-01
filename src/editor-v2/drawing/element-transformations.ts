import { roadFitsBuildings } from "../roads/road-routing";
import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import { shapePoints } from "../geometry/region-constraints";
import { unionCompatibleRegionShapes } from "../geometry/region-union";
import type { DrawingElement, EditorProject, RegionShape } from "../model/project-model";
import { geometryFitsBoundary } from "./geometry-containment";

export type ElementTransformationResult =
  | { state: "applied"; project: EditorProject; selectedIds: string[] }
  | { state: "blocked"; project: EditorProject; reason: "not-found" | "mixed-owners" | "outside-outline" | "unsupported" | "disconnected" };

type Transformation = { kind: "rotate"; degrees: -90 | 90 } | { kind: "mirror"; axis: "horizontal" | "vertical" };

function pointTransform(point: KernelPoint, center: KernelPoint, transformation: Transformation): KernelPoint {
  const x = point.x - center.x; const y = point.y - center.y;
  if (transformation.kind === "mirror") return transformation.axis === "horizontal" ? { x: center.x - x, y: point.y } : { x: point.x, y: center.y - y };
  return transformation.degrees === 90 ? { x: center.x - y, y: center.y + x } : { x: center.x + y, y: center.y - x };
}

function transformNodes(nodes: BezierNode[], center: KernelPoint, transformation: Transformation) {
  const map = (point?: KernelPoint) => point ? pointTransform(point, center, transformation) : undefined;
  return nodes.map((node) => ({ anchor: map(node.anchor)!, inHandle: map(node.inHandle), outHandle: map(node.outHandle) }));
}

function transformRegion(shape: RegionShape, center: KernelPoint, transformation: Transformation): RegionShape {
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map((point) => pointTransform(point, center, transformation)), holes: holes.map((hole) => hole.map((point) => pointTransform(point, center, transformation))) })) };
  if (shape.kind === "circle") { const at = pointTransform({ x: shape.cx, y: shape.cy }, center, transformation); return { ...shape, cx: at.x, cy: at.y }; }
  if (shape.kind === "ellipse" && transformation.kind === "rotate") {
    const at = pointTransform({ x: shape.cx, y: shape.cy }, center, transformation);
    return { kind: "ellipse", cx: at.x, cy: at.y, rx: shape.ry, ry: shape.rx };
  }
  if (shape.kind === "ellipse") { const at = pointTransform({ x: shape.cx, y: shape.cy }, center, transformation); return { ...shape, cx: at.x, cy: at.y }; }
  if (shape.kind === "bezier") return { ...shape, nodes: transformNodes(shape.nodes, center, transformation) };
  return { kind: "polygon", points: shapePoints(shape).map((point) => pointTransform(point, center, transformation)) };
}

function transformElement(element: DrawingElement, center: KernelPoint, transformation: Transformation): DrawingElement {
  const geometry = element.geometry.kind === "region" ? { ...element.geometry, shape: transformRegion(element.geometry.shape, center, transformation) }
    : element.geometry.kind === "path" ? { ...element.geometry, points: element.geometry.points.map((point) => pointTransform(point, center, transformation)) }
      : element.geometry.kind === "bezier" ? { ...element.geometry, nodes: transformNodes(element.geometry.nodes, center, transformation) }
        : { ...element.geometry, at: pointTransform(element.geometry.at, center, transformation) };
  const widthProfile = transformation.kind === "mirror" ? element.widthProfile?.map(({ t, left, right }) => ({ t, left: right, right: left })) : element.widthProfile;
  return { ...element, geometry, ...(widthProfile ? { widthProfile } : {}), ...(element.ribbonCutouts ? { ribbonCutouts: element.ribbonCutouts.map((shape) => transformRegion(shape, center, transformation)) } : {}) };
}

function elementPoints(element: DrawingElement) {
  if (element.geometry.kind === "region") return shapePoints(element.geometry.shape);
  if (element.geometry.kind === "path") return element.geometry.points;
  if (element.geometry.kind === "bezier") return element.geometry.nodes.map(({ anchor }) => anchor);
  return [element.geometry.at];
}

function groupCenter(elements: DrawingElement[]) {
  const points = elements.flatMap(elementPoints); const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function translated(element: DrawingElement, delta: KernelPoint) {
  return translateElement(element, delta);
}

function translateElement(element: DrawingElement, delta: KernelPoint): DrawingElement {
  const map = (point: KernelPoint) => ({ x: point.x + delta.x, y: point.y + delta.y });
  const geometry = element.geometry.kind === "region" ? { ...element.geometry, shape: translateRegion(element.geometry.shape, delta) }
    : element.geometry.kind === "path" ? { ...element.geometry, points: element.geometry.points.map(map) }
      : element.geometry.kind === "bezier" ? { ...element.geometry, nodes: element.geometry.nodes.map((node) => ({ anchor: map(node.anchor), inHandle: node.inHandle ? map(node.inHandle) : undefined, outHandle: node.outHandle ? map(node.outHandle) : undefined })) }
        : { ...element.geometry, at: map(element.geometry.at) };
  return { ...element, geometry, ...(element.ribbonCutouts ? { ribbonCutouts: element.ribbonCutouts.map((shape) => translateRegion(shape, delta)) } : {}) };
}

function translateRegion(shape: RegionShape, delta: KernelPoint): RegionShape {
  if (shape.kind === "rectangle") return { ...shape, x: shape.x + delta.x, y: shape.y + delta.y };
  if (shape.kind === "circle" || shape.kind === "ellipse") return { ...shape, cx: shape.cx + delta.x, cy: shape.cy + delta.y };
  if (shape.kind === "bezier") return { ...shape, nodes: shape.nodes.map((node) => ({ anchor: { x: node.anchor.x + delta.x, y: node.anchor.y + delta.y }, inHandle: node.inHandle ? { x: node.inHandle.x + delta.x, y: node.inHandle.y + delta.y } : undefined, outHandle: node.outHandle ? { x: node.outHandle.x + delta.x, y: node.outHandle.y + delta.y } : undefined })) };
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: outer.map(({ x, y }) => ({ x: x + delta.x, y: y + delta.y })), holes: holes.map((hole) => hole.map(({ x, y }) => ({ x: x + delta.x, y: y + delta.y }))) })) };
  return { ...shape, points: shape.points.map(({ x, y }) => ({ x: x + delta.x, y: y + delta.y })) };
}

function selectedElements(project: EditorProject, ids: readonly string[]) {
  const wanted = new Set(ids); return project.elements.filter(({ id }) => wanted.has(id));
}

function allFit(project: EditorProject, elements: DrawingElement[]) {
  return elements.every((element) => {
    if (!roadFitsBuildings(project, element)) return false;
    if (element.layerId !== "equipment") return true;
    const owner = project.places.find(({ id }) => id === element.belongsToId);
    return !owner?.boundary || geometryFitsBoundary(element.geometry, owner.boundary);
  });
}

export function transformSelectedElements(project: EditorProject, ids: readonly string[], transformation: Transformation): ElementTransformationResult {
  const elements = selectedElements(project, ids);
  if (!elements.length || elements.length !== new Set(ids).size) return { state: "blocked", project, reason: "not-found" };
  if (new Set(elements.map(({ belongsToId }) => belongsToId)).size !== 1) return { state: "blocked", project, reason: "mixed-owners" };
  const center = groupCenter(elements); const changed = elements.map((element) => transformElement(element, center, transformation));
  if (!allFit(project, changed)) return { state: "blocked", project, reason: "outside-outline" };
  const byId = new Map(changed.map((element) => [element.id, element]));
  return { state: "applied", project: { ...project, elements: project.elements.map((element) => byId.get(element.id) ?? element) }, selectedIds: elements.map(({ id }) => id) };
}

export function duplicateSelectedElements(project: EditorProject, ids: readonly string[], createId: () => string, copyName: (name: string) => string): ElementTransformationResult {
  const elements = selectedElements(project, ids);
  if (!elements.length || elements.length !== new Set(ids).size) return { state: "blocked", project, reason: "not-found" };
  if (new Set(elements.map(({ belongsToId }) => belongsToId)).size !== 1) return { state: "blocked", project, reason: "mixed-owners" };
  const offsets = [{ x: 2, y: 2 }, { x: -2, y: 2 }, { x: 2, y: -2 }, { x: -2, y: -2 }, { x: 0, y: 0 }];
  const moved = offsets.map((delta) => elements.map((element) => translated(element, delta))).find((candidates) => allFit(project, candidates));
  if (!moved) return { state: "blocked", project, reason: "outside-outline" };
  const copies = moved.map((element) => ({ ...element, id: createId(), name: copyName(element.name) }));
  return { state: "applied", project: { ...project, elements: [...project.elements, ...copies] }, selectedIds: copies.map(({ id }) => id) };
}

export function mergeSelectedElementRegions(project: EditorProject, ids: readonly string[]): ElementTransformationResult {
  const elements = selectedElements(project, ids);
  if (elements.length < 2 || elements.length !== new Set(ids).size || elements.some(({ geometry }) => geometry.kind !== "region")) return { state: "blocked", project, reason: "unsupported" };
  const first = elements[0];
  if (elements.some((element) => element.belongsToId !== first.belongsToId || element.layerId !== first.layerId || element.subjectId !== first.subjectId)) return { state: "blocked", project, reason: "mixed-owners" };
  const union = unionCompatibleRegionShapes(elements.flatMap((element) => element.geometry.kind === "region" ? [element.geometry.shape] : []));
  if (!union) return { state: "blocked", project, reason: "disconnected" };
  if (union.state === "unchanged") return { state: "blocked", project, reason: "unsupported" };
  const shape = union.shape;
  const removed = new Set(ids.slice(1)); const merged = { ...first, geometry: { kind: "region" as const, shape }, tags: [...new Set(elements.flatMap(({ tags }) => tags))], access: [...new Set(elements.flatMap(({ access }) => access))] };
  return { state: "applied", project: { ...project, elements: project.elements.map((element) => element.id === first.id ? merged : element).filter(({ id }) => !removed.has(id)) }, selectedIds: [first.id] };
}
