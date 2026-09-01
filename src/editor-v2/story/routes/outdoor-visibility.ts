import type { KernelPoint } from "../../geometry/geometry-types";
import { distance } from "./geometry";

/** Searches the same visibility graph without approximating its collision checks. */
export function outdoorVisibilityPath(
  from: KernelPoint,
  to: KernelPoint,
  candidates: readonly KernelPoint[],
  openSegment: (a: KernelPoint, b: KernelPoint) => boolean,
) {
  const pointKeys = new Set([`${from.x},${from.y}`, `${to.x},${to.y}`]);
  const points = [from, to, ...candidates.filter((point) => {
    const key = `${point.x},${point.y}`;
    if (pointKeys.has(key)) return false;
    pointKeys.add(key);
    return true;
  })];
  const values = points.map(() => Infinity);
  const previous = points.map(() => -1);
  const remaining = points.map((point) => distance(point, to));
  const visited = points.map(() => false);
  values[0] = 0;

  for (let count = 0; count < points.length; count += 1) {
    let current = -1;
    let currentScore = Infinity;
    for (let index = 0; index < points.length; index += 1) {
      if (visited[index] || !Number.isFinite(values[index])) continue;
      const score = values[index]! + remaining[index]!;
      // Euclidean distance is consistent with every edge's Euclidean cost.
      // Compare g only for equal f; ascending iteration preserves the final ID tie.
      if (current < 0 || score < currentScore || score === currentScore && values[index]! < values[current]!) {
        current = index;
        currentScore = score;
      }
    }
    if (current < 0) break;
    visited[current] = true;
    if (current === 1) break;

    for (let next = 0; next < points.length; next += 1) {
      if (visited[next]) continue;
      const value = values[current]! + distance(points[current]!, points[next]!);
      // This is the exact relaxation predicate, not an estimate of a route to the goal.
      // A non-improving edge cannot change either values or previous, even when open.
      if (!(value < values[next]!)) continue;
      if (!openSegment(points[current]!, points[next]!)) continue;
      values[next] = value;
      previous[next] = current;
    }
  }
  if (!Number.isFinite(values[1])) return undefined;
  const result: KernelPoint[] = [];
  for (let index = 1; index >= 0; index = previous[index]!) {
    result.unshift(points[index]!);
    if (index === 0) break;
  }
  return { points: result, distance: values[1]! };
}
