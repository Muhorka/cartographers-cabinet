import type { KernelPoint } from "../geometry/geometry-types";
import type { SemanticDraft } from "./semantic-draft";

type Endpoint = { strokeIndex: number; pointIndex: number; point: KernelPoint };

function distance(first: KernelPoint, second: KernelPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function projection(point: KernelPoint, start: KernelPoint, end: KernelPoint) {
  const dx = end.x - start.x; const dy = end.y - start.y; const squared = dx * dx + dy * dy;
  if (!squared) return start;
  const at = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared));
  return { x: start.x + dx * at, y: start.y + dy * at };
}

export function normalizeDraftTopology(draft: SemanticDraft, tolerance = 1.25): SemanticDraft {
  if (!(tolerance > 0) || draft.strokes.length === 0) return draft;
  const strokes = draft.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) }));
  const endpoints: Endpoint[] = strokes.flatMap((stroke, strokeIndex) => stroke.points.length < 2 ? [] : [
    { strokeIndex, pointIndex: 0, point: stroke.points[0] },
    { strokeIndex, pointIndex: stroke.points.length - 1, point: stroke.points.at(-1)! },
  ]);
  const pairs = endpoints.flatMap((first, firstIndex) => endpoints.slice(firstIndex + 1).map((second, offset) => ({ firstIndex, secondIndex: firstIndex + offset + 1, gap: distance(first.point, second.point) })))
    .filter(({ gap }) => gap <= tolerance).toSorted((first, second) => first.gap - second.gap);
  const paired = new Set<number>();
  for (const { firstIndex, secondIndex } of pairs) {
    if (paired.has(firstIndex) || paired.has(secondIndex)) continue;
    const first = endpoints[firstIndex]; const second = endpoints[secondIndex];
    const joined = { x: (first.point.x + second.point.x) / 2, y: (first.point.y + second.point.y) / 2 };
    strokes[first.strokeIndex].points[first.pointIndex] = joined; strokes[second.strokeIndex].points[second.pointIndex] = joined;
    paired.add(firstIndex); paired.add(secondIndex);
  }
  endpoints.forEach((endpoint, endpointIndex) => {
    if (paired.has(endpointIndex)) return;
    const current = strokes[endpoint.strokeIndex].points[endpoint.pointIndex]; let best: KernelPoint | undefined; let bestDistance = tolerance;
    strokes.forEach((stroke, strokeIndex) => stroke.points.slice(1).forEach((end, segmentIndex) => {
      const touchesOwnEndpoint = strokeIndex === endpoint.strokeIndex && (segmentIndex === 0 && endpoint.pointIndex === 0 || segmentIndex === stroke.points.length - 2 && endpoint.pointIndex === stroke.points.length - 1);
      if (touchesOwnEndpoint) return;
      const candidate = projection(current, stroke.points[segmentIndex], end); const gap = distance(current, candidate);
      if (gap < bestDistance) { best = candidate; bestDistance = gap; }
    }));
    if (best) strokes[endpoint.strokeIndex].points[endpoint.pointIndex] = best;
  });
  return { ...draft, strokes };
}
