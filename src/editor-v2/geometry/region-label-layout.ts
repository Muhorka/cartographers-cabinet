import type { RegionShape } from "../model/project-model";
import type { KernelPoint } from "./geometry-types";
import { shapePoints, shapePolygons } from "./region-constraints";
import { roomLabelLayout, type LabelObstacle, type RoomLabelLayout, type InteriorLabelOptions } from "./room-label-layout";
import type { MapLabelText } from "./map-area";
import { createLabelCache, labelValueFingerprint } from "./label-layout-cache";

export type RegionLabelLayout =
  | ({ kind: "inside" } & RoomLabelLayout)
  | { kind: "boundary"; text: string; path: string; fontSize: number; textLength: number };

const regionLayoutCache = createLabelCache<RegionLabelLayout | undefined>(512);

export function clearRegionLabelLayoutCache() { regionLayoutCache.clear(); }
export function regionLabelLayoutCacheSize() { return regionLayoutCache.size; }

export function regionLabelLayout(name: MapLabelText, shape: RegionShape, zoom: number, boundaryFallback = false, options: InteriorLabelOptions = {}): RegionLabelLayout | undefined {
  const key = labelValueFingerprint({ name, shape, zoom, boundaryFallback, options });
  const cached = regionLayoutCache.get(key);
  if (cached.hit) return cached.value;
  const result = regionLabelLayoutUncached(name, shape, zoom, boundaryFallback, options);
  const frozen = result ? Object.freeze(result) as RegionLabelLayout : result;
  regionLayoutCache.set(key, frozen);
  return frozen;
}

function regionLabelLayoutUncached(name: MapLabelText, shape: RegionShape, zoom: number, boundaryFallback = false, options: InteriorLabelOptions = {}): RegionLabelLayout | undefined {
  const face = labelFace(shape);
  const fullInside = roomLabelLayout(name, face, zoom, { ...options, allowCompact: false, minimumScreenSize: 3.2, preferredScreenSize: 7 });
  if (fullInside && (!boundaryFallback || fullInside.fontSize * zoom >= 6.5)) return { kind: "inside", ...fullInside };
  if (boundaryFallback) {
    const boundary = boundaryLayout(typeof name === "string" ? name : `${name.name} · ${name.area}`, shape, zoom);
    if (boundary) return boundary;
  }
  const compactInside = roomLabelLayout(name, face, zoom, { ...options, minimumScreenSize: 3.2, preferredScreenSize: 7 });
  return compactInside ? { kind: "inside", ...compactInside } : undefined;
}

/** Supplies map-coordinate obstacles to labels without changing the source geometry. */
export function labelObstaclesForShape(shape: RegionShape): LabelObstacle[] {
  return shapePolygons(shape).map(({ outer, holes }) => ({ outer, holes }));
}

function labelRing(shape: RegionShape) { return labelFace(shape).outer; }
function labelFace(shape: RegionShape) {
  if (shape.kind !== "compound") return { outer: shapePoints(shape), holes: [] };
  const area = (points: KernelPoint[]) => Math.abs(points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0));
  return shapePolygons(shape).toSorted((first, second) => area(second.outer) - area(first.outer))[0] ?? { outer: [], holes: [] };
}

function boundaryLayout(text: string, shape: RegionShape, zoom: number): RegionLabelLayout | undefined {
  if (zoom <= 0) return undefined;
  const boundary = readableBoundary(shape);
  if (!boundary) return undefined;
  const availableScreenWidth = boundary.length * zoom * .9;
  const screenSize = Math.min(11, availableScreenWidth / Math.max(3, text.length * .58));
  // Keep a complete boundary label at any positive size; small map text is intentional.
  if (screenSize <= 0) return undefined;
  const naturalWidth = screenSize * text.length * .57;
  const usedWidth = Math.min(availableScreenWidth, Math.max(naturalWidth, availableScreenWidth * .72));
  return {
    kind: "boundary",
    text,
    path: boundary.path,
    fontSize: screenSize / zoom,
    textLength: usedWidth / zoom,
  };
}

function readableBoundary(shape: RegionShape) {
  if (shape.kind === "rectangle") return lineBoundary({ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y });
  if (shape.kind === "circle") return upperArc(shape.cx, shape.cy, shape.radius, shape.radius);
  if (shape.kind === "ellipse") return upperArc(shape.cx, shape.cy, shape.rx, shape.ry);
  const points = labelRing(shape);
  const simplified = simplifyClosed(points);
  const edges = simplified.map((start, index) => ({ start, end: simplified[(index + 1) % simplified.length] }));
  const longest = edges.toSorted((first, second) => edgeLength(second) - edgeLength(first))[0];
  return longest ? lineBoundary(longest.start, longest.end) : undefined;
}

function simplifyClosed(points: KernelPoint[]) {
  if (points.length <= 8) return points;
  const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const stride = Math.max(1, Math.floor(points.length / Math.max(8, Math.min(24, Math.ceil(diagonal / Math.max(diagonal * .035, .5))))));
  return points.filter((_, index) => index % stride === 0);
}

function lineBoundary(start: KernelPoint, end: KernelPoint) {
  const ordered = end.x < start.x || end.x === start.x && end.y < start.y ? { start: end, end: start } : { start, end };
  return { path: `M ${ordered.start.x} ${ordered.start.y} L ${ordered.end.x} ${ordered.end.y}`, length: edgeLength(ordered) };
}

function upperArc(cx: number, cy: number, rx: number, ry: number) {
  const points = Array.from({ length: 17 }, (_, index) => {
    const angle = Math.PI + index / 16 * Math.PI;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
  return {
    path: points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" "),
    length: points.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0),
  };
}
function edgeLength({ start, end }: { start: KernelPoint; end: KernelPoint }) { return Math.hypot(end.x - start.x, end.y - start.y); }
