import type { CanonicalWall, KernelPoint } from "../geometry/geometry-types";
import { pointOnSegment, pointsEqual } from "../geometry/line-geometry";
import { shapePolygons } from "../geometry/region-constraints";
import type { RegionShape } from "../model/project-model";

type CreateId = () => string;

function sameDirection(first: CanonicalWall, start: KernelPoint, end: KernelPoint) {
  return pointsEqual(first.start, start) && pointsEqual(first.end, end);
}

function sourceForSegment(start: KernelPoint, end: KernelPoint, previous: CanonicalWall[]) {
  return previous.find((wall) => pointOnSegment(start, wall.start, wall.end) && pointOnSegment(end, wall.start, wall.end));
}

function splitAtPreviousVertices(start: KernelPoint, end: KernelPoint, previous: CanonicalWall[]) {
  const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy || 1;
  return [start, end, ...previous.flatMap(({ start: oldStart, end: oldEnd }) => [oldStart, oldEnd])]
    .filter((point, index, points) => index < 2 || pointOnSegment(point, start, end) && !points.slice(0, index).some((other) => pointsEqual(other, point)))
    .toSorted((first, second) => ((first.x - start.x) * dx + (first.y - start.y) * dy) / lengthSquared - ((second.x - start.x) * dx + (second.y - start.y) * dy) / lengthSquared);
}

function wallForSegment(start: KernelPoint, end: KernelPoint, previous: CanonicalWall[], createId: CreateId) {
  const source = sourceForSegment(start, end, previous);
  if (!source) return { id: createId(), start, end, thickness: .3, role: "boundary" as const };
  if (sameDirection(source, start, end)) return source;
  if (sameDirection(source, end, start)) return { ...source };
  const forward = (end.x - start.x) * (source.end.x - source.start.x) + (end.y - start.y) * (source.end.y - source.start.y) >= 0;
  const sourceStart = forward ? start : end;
  const sourceEnd = sourceStart === start ? end : start;
  return { ...source, id: `${source.id}:outline:${createId()}`, start: sourceStart, end: sourceEnd };
}

/** Materializes every outer and hole ring while retaining source wall identity
 * wherever geometry survives. Collinear source vertices split new edges so
 * openings can be remapped to the surviving piece by absolute position. */
export function boundaryWallsForRegion(shape: RegionShape, previousWalls: CanonicalWall[], createId: CreateId): CanonicalWall[] {
  const previous = previousWalls.filter(({ role }) => role === "boundary");
  return shapePolygons(shape).flatMap(({ outer, holes }) => [outer, ...holes].flatMap((ring) => ring.flatMap((start, index) => {
    const end = ring[(index + 1) % ring.length]; const points = splitAtPreviousVertices(start, end, previous);
    return points.slice(0, -1).map((point, pointIndex) => wallForSegment(point, points[pointIndex + 1], previous, createId));
  })));
}
