import { normalizePoint } from "../geometry/geometry-normalization";
import type { CanonicalWall, KernelPoint } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";

type SnapCandidate = { point: KernelPoint; distance: number; score?: number };
export const CONSTRUCTION_SNAP_TOLERANCE = 1.25;

function distance(first: KernelPoint, second: KernelPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function projection(point: KernelPoint, wall: Pick<CanonicalWall, "start" | "end">): SnapCandidate {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lengthSquared = dx * dx + dy * dy;
  const position = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSquared))
    : 0;
  const projected = normalizePoint({ x: wall.start.x + dx * position, y: wall.start.y + dy * position });
  return { point: projected, distance: distance(point, projected) };
}

function closest(candidates: SnapCandidate[]) {
  return candidates.toSorted((first, second) => (first.score ?? first.distance) - (second.score ?? second.distance))[0];
}

export function snapConstructionPoint(point: KernelPoint, walls: readonly CanonicalWall[], tolerance = CONSTRUCTION_SNAP_TOLERANCE) {
  const endpoints = walls.flatMap((wall) => [wall.start, wall.end]).map((candidate) => {
    const candidateDistance = distance(point, candidate);
    return { point: candidate, distance: candidateDistance, score: candidateDistance * .72 };
  });
  const segments = walls.map((wall) => projection(point, wall));
  const snapped = closest([...endpoints, ...segments].filter((candidate) => candidate.distance <= tolerance));
  return snapped?.point ?? normalizePoint(point);
}

export function snapConstructionPath(points: readonly KernelPoint[], walls: readonly CanonicalWall[], tolerance = CONSTRUCTION_SNAP_TOLERANCE) {
  if (points.length < 2) return points.map(normalizePoint);
  const snapped = points.map(normalizePoint);
  snapped[0] = snapConstructionPoint(snapped[0], walls, tolerance);
  snapped[snapped.length - 1] = snapConstructionPoint(snapped.at(-1)!, walls, tolerance);
  return snapped.filter((point, index) => index === 0 || point.x !== snapped[index - 1].x || point.y !== snapped[index - 1].y);
}

/**
 * Snaps the meaningful vertices of an attached construction surface to the
 * existing wall network.  The interior of a hand-drawn shape is untouched;
 * only corners/anchors close enough to a wall move.  Circles and ellipses keep
 * their analytic geometry because they have no finite set of wall anchors.
 */
export function snapConstructionRegion(shape: RegionShape, walls: readonly CanonicalWall[], tolerance = CONSTRUCTION_SNAP_TOLERANCE): RegionShape {
  const snapRing = (points: readonly KernelPoint[]) => points.map((point) => snapConstructionPoint(point, walls, tolerance));
  if (shape.kind === "rectangle") return { kind: "polygon", points: snapRing([{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }, { x: shape.x, y: shape.y + shape.height }]) };
  if (shape.kind === "polygon") return { ...shape, points: snapRing(shape.points) };
  if (shape.kind === "compound") return { ...shape, polygons: shape.polygons.map(({ outer, holes }) => ({ outer: snapRing(outer), holes: holes.map(snapRing) })) };
  if (shape.kind === "bezier") return { ...shape, nodes: shape.nodes.map((node) => {
    const anchor = snapConstructionPoint(node.anchor, walls, tolerance);
    const dx = anchor.x - node.anchor.x; const dy = anchor.y - node.anchor.y;
    return { ...node, anchor, inHandle: node.inHandle ? { x: node.inHandle.x + dx, y: node.inHandle.y + dy } : undefined, outHandle: node.outHandle ? { x: node.outHandle.x + dx, y: node.outHandle.y + dy } : undefined };
  }) };
  return shape;
}
