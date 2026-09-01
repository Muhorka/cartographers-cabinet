import { sampleBezier } from "./bezier-geometry";
import type { KernelPoint } from "./geometry-types";
import type { DrawingElement, RegionShape } from "../model/project-model";
import { repairRegionShape, subtractRegionShape } from "./region-constraints";

/** A geometric band, independent of roads, water, ownership and collision rules. */
export type Ribbon = Pick<DrawingElement, "geometry" | "widthMeters" | "widthProfile" | "ribbonCutouts">;
export function isRoad(element: Pick<DrawingElement, "layerId">) { return element.layerId === "roads"; }
export function isFlowingWater(element: Pick<DrawingElement, "layerId" | "subjectId">) { return element.layerId === "terrain" && (element.subjectId === "terrain.river" || element.subjectId === "terrain.stream"); }
export function isRibbonElement(element: Pick<DrawingElement, "layerId" | "subjectId">) { return isRoad(element) || isFlowingWater(element); }
export function isRibbonSubject(layerId: string, subjectId: string) { return layerId === "roads" || layerId === "terrain" && (subjectId === "terrain.river" || subjectId === "terrain.stream"); }
export type RibbonWidthStation = { t: number; left: number; right: number };
export const ribbonWidth = (ribbon: Ribbon) => Math.max(.1, Math.min(1000, ribbon.widthMeters ?? 4));
export function ribbonPoints(ribbon: Ribbon): KernelPoint[] {
  const geometry = ribbon.geometry;
  const points = geometry.kind === "path" ? geometry.points : geometry.kind === "bezier" ? sampleBezier(geometry.nodes, geometry.closed) : [];
  return points.filter((point, index) => !index || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > 1e-8);
}
function pathStations(points: KernelPoint[]) {
  let length = 0;
  const distances = points.map((point, index) => { if (index) length += Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y); return length; });
  return distances.map((distance) => length ? distance / length : 0);
}
function ribbonWidthsAt(ribbon: Ribbon, t: number): Omit<RibbonWidthStation, "t"> {
  const half = ribbonWidth(ribbon) / 2;
  const profile = [{ t: 0, left: half, right: half }, ...(ribbon.widthProfile ?? []), { t: 1, left: half, right: half }]
    .toSorted((a, b) => a.t - b.t).filter((item, index, all) => index === all.length - 1 || item.t !== all[index + 1].t);
  // Explicit end stations replace the defaults.
  const first = ribbon.widthProfile?.find((item) => item.t === 0); if (first) profile[0] = first;
  const last = ribbon.widthProfile?.find((item) => item.t === 1); if (last) profile[profile.length - 1] = last;
  const end = profile.findIndex((item) => item.t >= t);
  const b = profile[Math.max(0, end)]; const a = profile[Math.max(0, end - 1)];
  const ratio = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return { left: a.left + (b.left - a.left) * ratio, right: a.right + (b.right - a.right) * ratio };
}

/** Normalized distance of an editable path/Bezier anchor along a ribbon. */
export function ribbonStationAt(ribbon: Ribbon, vertexIndex: number) {
  const points = ribbon.geometry.kind === "path" ? ribbon.geometry.points : ribbon.geometry.kind === "bezier" ? ribbon.geometry.nodes.map(({ anchor }) => anchor) : [];
  if (points.length < 2 || vertexIndex <= 0 || vertexIndex >= points.length - 1) return undefined;
  return pathStations(points)[vertexIndex];
}

/** Re-parameterizes an existing road width profile for its two split pieces. */
export function splitRibbonWidthProfile(ribbon: Ribbon, splitT: number): [RibbonWidthStation[] | undefined, RibbonWidthStation[] | undefined] {
  if (ribbon.widthProfile && ribbon.widthProfile.length === 0) return [[], []];
  if (!ribbon.widthProfile?.length || splitT <= 1e-6 || splitT >= 1 - 1e-6) return [undefined, undefined];
  const firstTs = [0, ...ribbon.widthProfile.map(({ t }) => t).filter((t) => t > 1e-6 && t < splitT - 1e-6), splitT];
  const secondTs = [splitT, ...ribbon.widthProfile.map(({ t }) => t).filter((t) => t > splitT + 1e-6 && t < 1 - 1e-6), 1];
  const toProfile = (stations: number[], start: number, span: number) => stations.map((t) => ({ t: (t - start) / span, ...ribbonWidthsAt(ribbon, t) }));
  return [toProfile(firstTs, 0, splitT), toProfile(secondTs, splitT, 1 - splitT)];
}
function ribbonFrame(points: KernelPoint[], index: number) {
  const point = points[index]; const before = points[Math.max(0, index - 1)]; const after = points[Math.min(points.length - 1, index + 1)];
  const normal = (a: KernelPoint, b: KernelPoint) => { const length = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }; };
  const n1 = normal(index ? before : point, index ? point : after);
  const n2 = normal(index === points.length - 1 ? before : point, index === points.length - 1 ? point : after);
  const magnitude = Math.hypot(n1.x + n2.x, n1.y + n2.y);
  const direction = magnitude > 1e-6 ? { x: (n1.x + n2.x) / magnitude, y: (n1.y + n2.y) / magnitude } : n1;
  const miter = Math.min(2, 1 / Math.max(.1, direction.x * n2.x + direction.y * n2.y));
  return { point, normal: { x: direction.x * miter, y: direction.y * miter } };
}
export function ribbonEdges(ribbon: Ribbon) {
  const source = ribbonPoints(ribbon); const original = pathStations(source);
  if (source.length < 2) return [];
  // Width stations are geometry, not just metadata. Include them even along a
  // perfectly straight two-anchor road; midpoints also provide edge handles.
  const stations = [...new Set([...original, ...original.slice(1).map((t, i) => (t + original[i]) / 2), ...(ribbon.widthProfile ?? []).map(({ t }) => t)])].sort((a, b) => a - b);
  const points = stations.map((t) => {
    const end = Math.max(1, original.findIndex((station) => station >= t));
    const start = end - 1; const ratio = (t - original[start]) / (original[end] - original[start] || 1);
    return { x: source[start].x + (source[end].x - source[start].x) * ratio, y: source[start].y + (source[end].y - source[start].y) * ratio };
  });
  return points.map((_, index) => {
    const { point, normal } = ribbonFrame(points, index); const widths = ribbonWidthsAt(ribbon, stations[index]);
    return { point, normal, t: stations[index],
      left: { x: point.x + normal.x * widths.left, y: point.y + normal.y * widths.left },
      right: { x: point.x - normal.x * widths.right, y: point.y - normal.y * widths.right } };
  });
}
export function ribbonShape(ribbon: Ribbon): RegionShape | undefined {
  const edges = ribbonEdges(ribbon); if (edges.length < 2) return;
  const base = repairRegionShape({ kind: "polygon", points: [...edges.map(({ left }) => left), ...edges.map(({ right }) => right).reverse()] });
  let shape: RegionShape | undefined = base;
  for (const cutout of ribbon.ribbonCutouts ?? []) shape = shape ? subtractRegionShape(shape, cutout) : undefined;
  return shape;
}
/** Insert a local width station; neighbours preserve their widths. */
export function setRibbonWidthAt(ribbon: Ribbon, t: number, side: "left" | "right", distance: number) {
  const widths = ribbonWidthsAt(ribbon, t);
  const station = { t, ...widths, [side]: Math.max(.05, Math.min(500, distance)) };
  return [...(ribbon.widthProfile ?? []).filter((item) => Math.abs(item.t - t) > 1e-6), station].toSorted((a, b) => a.t - b.t);
}
