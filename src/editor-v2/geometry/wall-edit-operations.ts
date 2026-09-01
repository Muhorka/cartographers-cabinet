import { infiniteLineIntersection, pointOnSegment, pointsEqual, translate, wallNormal } from "./line-geometry";
import type { CanonicalWall, KernelPoint } from "./geometry-types";

type WallEditIssue = {
  kind: "wall-not-found" | "zero-length-wall" | "ambiguous-junction" | "parallel-junction";
  wallIds: string[];
  at?: KernelPoint;
};

export type WallEditResult = { walls: CanonicalWall[]; issues: WallEditIssue[] };

function replaceEndpoint(wall: CanonicalWall, previous: KernelPoint, next: KernelPoint) {
  if (pointsEqual(wall.start, previous)) return { ...wall, start: next };
  if (pointsEqual(wall.end, previous)) return { ...wall, end: next };
  return wall;
}

function uniquePoints(points: KernelPoint[]) {
  return points.filter((point, index) => points.findIndex((candidate) => pointsEqual(candidate, point)) === index);
}

export function offsetWall(source: CanonicalWall[], wallId: string, distance: number): WallEditResult {
  const selected = source.find(({ id }) => id === wallId);
  if (!selected) return { walls: source, issues: [{ kind: "wall-not-found", wallIds: [wallId] }] };
  const normal = wallNormal(selected);
  if (!normal) return { walls: source, issues: [{ kind: "zero-length-wall", wallIds: [wallId] }] };
  const delta = { x: normal.x * distance, y: normal.y * distance };
  const predicted = { ...selected, start: translate(selected.start, delta), end: translate(selected.end, delta) };
  const issues: WallEditIssue[] = []; let walls = source.map((wall) => ({ ...wall }));
  const resolveEndpoint = (previous: KernelPoint, fallback: KernelPoint) => {
    const neighbours = source.filter((wall) => wall.id !== wallId && pointOnSegment(previous, wall.start, wall.end));
    if (!neighbours.length) return fallback;
    const intersections = uniquePoints(neighbours.map((wall) => infiniteLineIntersection(predicted, wall)).filter((point): point is KernelPoint => Boolean(point)));
    if (!intersections.length) return fallback;
    const intersection = intersections.toSorted((first, second) => Math.hypot(first.x - fallback.x, first.y - fallback.y) - Math.hypot(second.x - fallback.x, second.y - fallback.y))[0];
    if (selected.role === "boundary") walls = walls.map((wall) => wall.id === wallId ? wall : replaceEndpoint(wall, previous, intersection));
    return intersection;
  };
  const start = resolveEndpoint(selected.start, predicted.start);
  const end = resolveEndpoint(selected.end, predicted.end);
  walls = walls.map((wall) => wall.id === wallId ? { ...wall, start, end } : wall);
  return { walls, issues };
}

export function moveJunction(source: CanonicalWall[], at: KernelPoint, next: KernelPoint): WallEditResult {
  const connected = source.filter((wall) => pointsEqual(wall.start, at) || pointsEqual(wall.end, at));
  if (!connected.length) return { walls: source, issues: [] };
  const ids = new Set(connected.map(({ id }) => id));
  return { walls: source.map((wall) => ids.has(wall.id) ? replaceEndpoint(wall, at, next) : wall), issues: [] };
}
