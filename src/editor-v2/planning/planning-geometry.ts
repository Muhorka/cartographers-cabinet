import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";

export type PlanningBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type PlanningItem = { id: string; bounds: PlanningBounds };
export type PlanningAxis = "horizontal" | "vertical";
export type AlignmentEdge = "start" | "center" | "end";
export type PlanningInsertionTarget = { point: KernelPoint; segmentIndex: number; ratio: number; distance: number; polygonIndex?: number };
export type PlanningGeometry =
  | { kind: "region"; shape: RegionShape }
  | { kind: "path"; points: KernelPoint[]; closed: boolean }
  | { kind: "bezier"; nodes: BezierNode[]; closed: boolean };

const epsilon = 1e-6;

function boundsFromPoints(points: KernelPoint[]): PlanningBounds | undefined {
  if (!points.length) return undefined;
  return points.reduce<PlanningBounds>((result, point) => ({
    minX: Math.min(result.minX, point.x), minY: Math.min(result.minY, point.y),
    maxX: Math.max(result.maxX, point.x), maxY: Math.max(result.maxY, point.y),
  }), { minX: points[0].x, minY: points[0].y, maxX: points[0].x, maxY: points[0].y });
}

/** Bounds used by planning tools are display-space bounds; they never rewrite geometry. */
export function regionBounds(shape: RegionShape): PlanningBounds | undefined {
  if (shape.kind === "polygon") return boundsFromPoints(shape.points);
  if (shape.kind === "compound") return boundsFromPoints(shape.polygons.flatMap(({ outer, holes }) => [...outer, ...holes.flat()]));
  if (shape.kind === "rectangle") return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.width, maxY: shape.y + shape.height };
  if (shape.kind === "circle") return { minX: shape.cx - shape.radius, minY: shape.cy - shape.radius, maxX: shape.cx + shape.radius, maxY: shape.cy + shape.radius };
  if (shape.kind === "ellipse") return { minX: shape.cx - shape.rx, minY: shape.cy - shape.ry, maxX: shape.cx + shape.rx, maxY: shape.cy + shape.ry };
  return boundsFromPoints(shape.nodes.flatMap((node) => [node.anchor, ...(node.inHandle ? [node.inHandle] : []), ...(node.outHandle ? [node.outHandle] : [])]));
}

function edgeValue(bounds: PlanningBounds, axis: PlanningAxis, edge: AlignmentEdge) {
  if (axis === "horizontal") return edge === "start" ? bounds.minX : edge === "end" ? bounds.maxX : (bounds.minX + bounds.maxX) / 2;
  return edge === "start" ? bounds.minY : edge === "end" ? bounds.maxY : (bounds.minY + bounds.maxY) / 2;
}

/** Returns per-id translation deltas, retaining every object's own size. */
export function alignmentDeltas(items: PlanningItem[], axis: PlanningAxis, edge: AlignmentEdge): Record<string, KernelPoint> {
  if (!items.length) return {};
  const target = edge === "start" ? Math.min(...items.map((item) => edgeValue(item.bounds, axis, edge))) : edge === "end" ? Math.max(...items.map((item) => edgeValue(item.bounds, axis, edge))) : items.reduce((sum, item) => sum + edgeValue(item.bounds, axis, edge), 0) / items.length;
  return Object.fromEntries(items.map((item) => {
    const delta = target - edgeValue(item.bounds, axis, edge);
    return [item.id, axis === "horizontal" ? { x: delta, y: 0 } : { x: 0, y: delta }];
  }));
}

/** Distributes item centres evenly between the outermost selected items. */
export function distributionDeltas(items: PlanningItem[], axis: PlanningAxis): Record<string, KernelPoint> {
  if (items.length < 3) return Object.fromEntries(items.map(({ id }) => [id, { x: 0, y: 0 }]));
  const ordered = [...items].sort((a, b) => edgeValue(a.bounds, axis, "center") - edgeValue(b.bounds, axis, "center"));
  const first = edgeValue(ordered[0].bounds, axis, "center"); const last = edgeValue(ordered.at(-1)!.bounds, axis, "center");
  const step = (last - first) / (ordered.length - 1);
  return Object.fromEntries(ordered.map((item, index) => {
    const delta = first + step * index - edgeValue(item.bounds, axis, "center");
    return [item.id, axis === "horizontal" ? { x: delta, y: 0 } : { x: 0, y: delta }];
  }));
}

export function polygonArea(points: KernelPoint[]) {
  return Math.abs(points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0) / 2);
}

function projectToSegment(point: KernelPoint, start: KernelPoint, end: KernelPoint) {
  const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared < epsilon ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return { point: { x: start.x + dx * t, y: start.y + dy * t }, distance: Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t)) };
}

function cubicPoint(first: BezierNode, second: BezierNode, ratio: number): KernelPoint {
  const start = first.anchor; const controlA = first.outHandle ?? start; const end = second.anchor; const controlB = second.inHandle ?? end; const inverse = 1 - ratio;
  return { x: inverse ** 3 * start.x + 3 * inverse ** 2 * ratio * controlA.x + 3 * inverse * ratio ** 2 * controlB.x + ratio ** 3 * end.x, y: inverse ** 3 * start.y + 3 * inverse ** 2 * ratio * controlA.y + 3 * inverse * ratio ** 2 * controlB.y + ratio ** 3 * end.y };
}

function nearestCubicPoint(first: BezierNode, second: BezierNode, near: KernelPoint) {
  const samples = 32;
  let sampleIndex = 0;
  let sampleDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= samples; index += 1) {
    const point = cubicPoint(first, second, index / samples);
    const distance = (point.x - near.x) ** 2 + (point.y - near.y) ** 2;
    if (distance < sampleDistance) { sampleIndex = index; sampleDistance = distance; }
  }
  let left = Math.max(0, (sampleIndex - 1) / samples);
  let right = Math.min(1, (sampleIndex + 1) / samples);
  const golden = (Math.sqrt(5) - 1) / 2;
  let lower = right - golden * (right - left);
  let upper = left + golden * (right - left);
  const distanceAt = (ratio: number) => {
    const point = cubicPoint(first, second, ratio);
    return (point.x - near.x) ** 2 + (point.y - near.y) ** 2;
  };
  let lowerDistance = distanceAt(lower);
  let upperDistance = distanceAt(upper);
  for (let iteration = 0; iteration < 24; iteration += 1) {
    if (lowerDistance <= upperDistance) {
      right = upper; upper = lower; upperDistance = lowerDistance;
      lower = right - golden * (right - left); lowerDistance = distanceAt(lower);
    } else {
      left = lower; lower = upper; lowerDistance = upperDistance;
      upper = left + golden * (right - left); upperDistance = distanceAt(upper);
    }
  }
  const candidates = [sampleIndex / samples, left, right, (left + right) / 2, 0, 1];
  let ratio = candidates[0]; let distance = distanceAt(ratio);
  candidates.slice(1).forEach((candidate) => { const candidateDistance = distanceAt(candidate); if (candidateDistance < distance) { ratio = candidate; distance = candidateDistance; } });
  return { point: cubicPoint(first, second, ratio), ratio, distance: Math.sqrt(distance) };
}

/** Finds the nearest editable segment. `distance` lets the caller enforce a hit radius. */
export function planningInsertionTarget(geometry: PlanningGeometry, near: KernelPoint): PlanningInsertionTarget | undefined {
  if (geometry.kind === "path") {
    if (geometry.points.length < 2) return undefined;
    let best: PlanningInsertionTarget | undefined;
    const segmentCount = geometry.closed ? geometry.points.length : geometry.points.length - 1;
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const nextIndex = (segmentIndex + 1) % geometry.points.length; const candidate = projectToSegment(near, geometry.points[segmentIndex], geometry.points[nextIndex]);
      if (!best || candidate.distance < best.distance) best = { point: candidate.point, segmentIndex, ratio: Math.max(0, Math.min(1, Math.hypot(candidate.point.x - geometry.points[segmentIndex].x, candidate.point.y - geometry.points[segmentIndex].y) / (Math.hypot(geometry.points[nextIndex].x - geometry.points[segmentIndex].x, geometry.points[nextIndex].y - geometry.points[segmentIndex].y) || 1))), distance: candidate.distance };
    }
    return best;
  }
  if (geometry.kind === "bezier") {
    if (geometry.nodes.length < 2) return undefined;
    let best: PlanningInsertionTarget | undefined; const segmentCount = geometry.closed ? geometry.nodes.length : geometry.nodes.length - 1;
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const nextIndex = (segmentIndex + 1) % geometry.nodes.length;
      const candidate = nearestCubicPoint(geometry.nodes[segmentIndex], geometry.nodes[nextIndex], near);
      if (!best || candidate.distance < best.distance) best = { ...candidate, segmentIndex };
    }
    return best;
  }
  if (geometry.kind === "region") {
    const rings = geometry.shape.kind === "polygon" ? [geometry.shape.points] : geometry.shape.kind === "compound" ? geometry.shape.polygons.map(({ outer }) => outer) : undefined;
    if (!rings) return undefined;
    let best: PlanningInsertionTarget | undefined;
    rings.forEach((ring, polygonIndex) => ring.forEach((start, segmentIndex) => { const end = ring[(segmentIndex + 1) % ring.length]; const candidate = projectToSegment(near, start, end); if (!best || candidate.distance < best.distance) best = { point: candidate.point, segmentIndex, polygonIndex, ratio: Math.max(0, Math.min(1, Math.hypot(candidate.point.x - start.x, candidate.point.y - start.y) / (Math.hypot(end.x - start.x, end.y - start.y) || 1))), distance: candidate.distance }; }));
    return best;
  }
  return undefined;
}

/** Inserts at the closest outer-ring edge. Curves and primitives stay untouched. */
export function insertRegionVertex(shape: RegionShape, near: KernelPoint): RegionShape | undefined {
  const rings = shape.kind === "polygon" ? [shape.points] : shape.kind === "compound" ? shape.polygons.map(({ outer }) => outer) : undefined;
  if (!rings) return undefined;
  let best: { polygonIndex: number; edgeIndex: number; point: KernelPoint; distance: number } | undefined;
  rings.forEach((ring, polygonIndex) => ring.forEach((start, edgeIndex) => { const candidate = projectToSegment(near, start, ring[(edgeIndex + 1) % ring.length]); if (!best || candidate.distance < best.distance) best = { polygonIndex, edgeIndex, point: candidate.point, distance: candidate.distance }; }));
  if (!best) return undefined;
  if (shape.kind === "polygon") return { ...shape, points: [...shape.points.slice(0, best.edgeIndex + 1), best.point, ...shape.points.slice(best.edgeIndex + 1)] };
  if (shape.kind !== "compound") return undefined;
  return { ...shape, polygons: shape.polygons.map((polygon, index) => index === best!.polygonIndex ? { ...polygon, outer: [...polygon.outer.slice(0, best!.edgeIndex + 1), best!.point, ...polygon.outer.slice(best!.edgeIndex + 1)] } : polygon) };
}

export function removeRegionVertex(shape: RegionShape, polygonIndex: number, vertexIndex: number): RegionShape | undefined {
  const rings = shape.kind === "polygon" ? [shape.points] : shape.kind === "compound" ? shape.polygons.map(({ outer }) => outer) : undefined;
  if (!rings || !rings[polygonIndex] || rings[polygonIndex].length <= 3 || !Number.isInteger(vertexIndex)) return undefined;
  const next = rings[polygonIndex].filter((_, index) => index !== vertexIndex); if (polygonArea(next) < epsilon) return undefined;
  if (shape.kind === "polygon") return { ...shape, points: next };
  if (shape.kind !== "compound") return undefined;
  return { ...shape, polygons: shape.polygons.map((polygon, index) => index === polygonIndex ? { ...polygon, outer: next } : polygon) };
}

function lerp(a: KernelPoint, b: KernelPoint, ratio: number): KernelPoint { return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }; }

/** Inserts a true cubic Bézier node with de Casteljau subdivision at ratio 0.5. */
export function insertBezierNode(nodes: BezierNode[], segmentIndex: number, closed = false): BezierNode[] | undefined {
  return insertBezierNodeAt(nodes, segmentIndex, .5, closed);
}

/** Inserts a cubic node at an arbitrary parameter while preserving the curve exactly. */
export function insertBezierNodeAt(nodes: BezierNode[], segmentIndex: number, ratio: number, closed = false): BezierNode[] | undefined {
  const nextIndex = segmentIndex + 1 < nodes.length ? segmentIndex + 1 : closed && segmentIndex === nodes.length - 1 ? 0 : -1;
  if (segmentIndex < 0 || nextIndex < 0 || ratio <= epsilon || ratio >= 1 - epsilon || !nodes[segmentIndex] || !nodes[nextIndex] || (!closed && segmentIndex >= nodes.length - 1)) return undefined;
  const first = nodes[segmentIndex]; const second = nodes[nextIndex]; const p0 = first.anchor; const p1 = first.outHandle ?? p0; const p2 = second.inHandle ?? second.anchor; const p3 = second.anchor;
  const a = lerp(p0, p1, ratio); const b = lerp(p1, p2, ratio); const c = lerp(p2, p3, ratio); const d = lerp(a, b, ratio); const e = lerp(b, c, ratio); const middle = lerp(d, e, ratio);
  const updated = nodes.map((node) => ({ ...node })); updated[segmentIndex] = { ...first, outHandle: a }; updated[nextIndex] = { ...second, inHandle: c };
  const inserted: BezierNode = { anchor: middle, inHandle: d, outHandle: e };
  return nextIndex === 0 ? [...updated, inserted] : [...updated.slice(0, nextIndex), inserted, ...updated.slice(nextIndex)];
}

/** Sharp removes handles; smooth creates symmetric handles along adjacent anchors. */
export function setBezierNodeSmooth(nodes: BezierNode[], index: number, smooth: boolean, closed = false): BezierNode[] | undefined {
  if (!nodes[index]) return undefined;
  const previous = nodes[index - 1] ?? (closed ? nodes.at(-1) : undefined); const next = nodes[index + 1] ?? (closed ? nodes[0] : undefined);
  if (!smooth || !previous || !next) return nodes.map((node, candidate) => candidate === index ? { anchor: node.anchor } : { ...node });
  const dx = next.anchor.x - previous.anchor.x; const dy = next.anchor.y - previous.anchor.y; const length = Math.hypot(dx, dy) || 1; const handleLength = Math.min(Math.hypot(dx, dy) / 3, Math.hypot(nodes[index].anchor.x - previous.anchor.x, nodes[index].anchor.y - previous.anchor.y) / 2, Math.hypot(next.anchor.x - nodes[index].anchor.x, next.anchor.y - nodes[index].anchor.y) / 2);
  const unit = { x: dx / length, y: dy / length }; const node = nodes[index];
  return nodes.map((candidate, candidateIndex) => candidateIndex === index ? { ...node, inHandle: { x: node.anchor.x - unit.x * handleLength, y: node.anchor.y - unit.y * handleLength }, outHandle: { x: node.anchor.x + unit.x * handleLength, y: node.anchor.y + unit.y * handleLength } } : { ...candidate });
}

function cleanRing(points: KernelPoint[]) { return points.filter((point, index) => index === 0 || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > epsilon); }

function clipHalfPlane(points: KernelPoint[], lineStart: KernelPoint, lineEnd: KernelPoint, keepPositive: boolean) {
  const side = (point: KernelPoint) => (lineEnd.x - lineStart.x) * (point.y - lineStart.y) - (lineEnd.y - lineStart.y) * (point.x - lineStart.x);
  const result: KernelPoint[] = [];
  points.forEach((current, index) => { const previous = points[(index + points.length - 1) % points.length]; const currentInside = keepPositive ? side(current) >= -epsilon : side(current) <= epsilon; const previousInside = keepPositive ? side(previous) >= -epsilon : side(previous) <= epsilon; if (currentInside !== previousInside) { const a = side(previous); const b = side(current); const ratio = Math.abs(a - b) < epsilon ? 0 : a / (a - b); result.push(lerp(previous, current, ratio)); } if (currentInside) result.push(current); });
  return cleanRing(result);
}

/** Splits a simple polygon by an infinite line; rejects degenerate/non-crossing cuts. */
export function splitPolygonByLine(points: KernelPoint[], lineStart: KernelPoint, lineEnd: KernelPoint): [KernelPoint[], KernelPoint[]] | undefined {
  if (points.length < 3 || Math.hypot(lineEnd.x - lineStart.x, lineEnd.y - lineStart.y) < epsilon) return undefined;
  const positive = clipHalfPlane(points, lineStart, lineEnd, true); const negative = clipHalfPlane(points, lineStart, lineEnd, false);
  return positive.length >= 3 && negative.length >= 3 && polygonArea(positive) > epsilon && polygonArea(negative) > epsilon ? [positive, negative] : undefined;
}

export function splitPathAt(points: KernelPoint[], vertexIndex: number): [KernelPoint[], KernelPoint[]] | undefined {
  if (points.length < 3 || vertexIndex <= 0 || vertexIndex >= points.length - 1) return undefined;
  return [points.slice(0, vertexIndex + 1), points.slice(vertexIndex)];
}

export function joinPaths(first: KernelPoint[], second: KernelPoint[], tolerance = .001): KernelPoint[] | undefined {
  if (first.length < 2 || second.length < 2) return undefined;
  const distance = Math.hypot(first.at(-1)!.x - second[0].x, first.at(-1)!.y - second[0].y);
  if (distance > tolerance) return undefined;
  return [...first, ...second.slice(1)];
}
