import type { KernelPoint } from "./geometry-types";

type LabelBox = { center: KernelPoint; width: number; height: number; rotation: number };
type PreparedRing = { points: readonly KernelPoint[] };
type PreparedObstacle = {
  bounds: { left: number; right: number; top: number; bottom: number };
  contains(point: KernelPoint): boolean;
  outer: PreparedRing;
  holes?: readonly PreparedRing[];
};

/** Checks exact polygon/label-box overlap after a cheap bounding-box rejection. */
export function labelObstacleIntersectsBox(box: LabelBox, obstacle: PreparedObstacle) {
  const corners = labelBoxCorners(box);
  const bounds = boundsForPoints(corners);
  if (!boundsIntersect(bounds, obstacle.bounds)) return false;
  if (corners.some((point) => obstacle.contains(point))) return true;
  if (obstacle.outer.points.some((point) => pointInLabelBox(point, box))) return true;
  const boxEdges = corners.map((start, index) => [start, corners[(index + 1) % corners.length]] as const);
  return [obstacle.outer, ...(obstacle.holes ?? [])].some((ring) => ring.points.some((start, index) => {
    const end = ring.points[(index + 1) % ring.points.length]!;
    return boxEdges.some(([boxStart, boxEnd]) => segmentsIntersect(start, end, boxStart, boxEnd));
  }));
}

function labelBoxCorners(box: LabelBox) {
  const radians = box.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const local = (x: number, y: number) => ({ x: box.center.x + cosine * x - sine * y, y: box.center.y + sine * x + cosine * y });
  return [local(-box.width / 2, -box.height / 2), local(box.width / 2, -box.height / 2), local(box.width / 2, box.height / 2), local(-box.width / 2, box.height / 2)];
}

function boundsForPoints(points: readonly KernelPoint[]) {
  return { left: Math.min(...points.map(({ x }) => x)), right: Math.max(...points.map(({ x }) => x)), top: Math.min(...points.map(({ y }) => y)), bottom: Math.max(...points.map(({ y }) => y)) };
}

function boundsIntersect(first: ReturnType<typeof boundsForPoints>, second: PreparedObstacle["bounds"]) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function pointInLabelBox(point: KernelPoint, box: LabelBox) {
  const radians = box.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const localX = cosine * (point.x - box.center.x) + sine * (point.y - box.center.y);
  const localY = -sine * (point.x - box.center.x) + cosine * (point.y - box.center.y);
  return Math.abs(localX) <= box.width / 2 + 1e-9 && Math.abs(localY) <= box.height / 2 + 1e-9;
}

function segmentsIntersect(firstStart: KernelPoint, firstEnd: KernelPoint, secondStart: KernelPoint, secondEnd: KernelPoint) {
  const first = orientation(firstStart, firstEnd, secondStart); const second = orientation(firstStart, firstEnd, secondEnd);
  const third = orientation(secondStart, secondEnd, firstStart); const fourth = orientation(secondStart, secondEnd, firstEnd);
  return first * second < 0 && third * fourth < 0 || Math.abs(first) <= 1e-9 && onSegment(firstStart, firstEnd, secondStart) || Math.abs(second) <= 1e-9 && onSegment(firstStart, firstEnd, secondEnd) || Math.abs(third) <= 1e-9 && onSegment(secondStart, secondEnd, firstStart) || Math.abs(fourth) <= 1e-9 && onSegment(secondStart, secondEnd, firstEnd);
}

function orientation(first: KernelPoint, second: KernelPoint, third: KernelPoint) {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}

function onSegment(start: KernelPoint, end: KernelPoint, point: KernelPoint) {
  return point.x >= Math.min(start.x, end.x) - 1e-9 && point.x <= Math.max(start.x, end.x) + 1e-9 && point.y >= Math.min(start.y, end.y) - 1e-9 && point.y <= Math.max(start.y, end.y) + 1e-9;
}
