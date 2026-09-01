import { pointKey } from "../geometry/geometry-normalization";
import { shapePolygons } from "../geometry/region-constraints";
import { buildWallNetwork } from "../geometry/wall-network-kernel";
import type { KernelPoint } from "../geometry/geometry-types";
import type { RegionShape } from "../model/project-model";
import { assessPathConstraint } from "../geometry/path-constraints";
import { analyzeDraft, appendDraftStroke, wallsForDraft, type SemanticDraft } from "./semantic-draft";

export type DraftClosureProposal = {
  before: SemanticDraft;
  after: SemanticDraft;
  connectorIds: string[];
};

export function proposeDraftClosure(draft: SemanticDraft, connectorId: string, boundary?: RegionShape, boundaryTolerance = 1.5): DraftClosureProposal | undefined {
  const workingDraft = boundary ? clipDraftToBoundary(draft, boundary) : draft;
  const network = buildWallNetwork(wallsForDraft(workingDraft));
  const degree = new Map<string, number>();
  const points = new Map<string, (typeof network.segments)[number]["start"]>();
  for (const segment of network.segments) {
    for (const point of [segment.start, segment.end]) {
      const key = pointKey(point);
      degree.set(key, (degree.get(key) ?? 0) + 1);
      points.set(key, point);
    }
  }
  const looseEnds = [...degree.entries()].filter(([, count]) => count === 1).map(([key]) => points.get(key)!);
  if (looseEnds.length < 2) return undefined;
  // When both ends meet the existing enclosure, the missing edge is the
  // boundary arc.  Trying a straight connector first turns an attached
  // balcony/terrace into an interior face and hides the attachment.
  const boundaryPath = boundary && looseEnds.length === 2 ? shortestBoundaryClosure(looseEnds[0], looseEnds[1], boundary, boundaryTolerance) : undefined;
  if (boundaryPath) {
    const boundaryId = `${connectorId}:boundary`; const boundaryClosed = appendDraftStroke(workingDraft, { id: boundaryId, points: boundaryPath });
    if (analyzeDraft(boundaryClosed).faces.length > analyzeDraft(workingDraft).faces.length) return { before: draft, after: boundaryClosed, connectorIds: [boundaryId] };
  }
  let after = workingDraft; const remaining = [...looseEnds]; const connectorIds: string[] = [];
  while (remaining.length >= 2) {
    let firstIndex = 0; let secondIndex = 1; let nearest = Number.POSITIVE_INFINITY;
    for (let first = 0; first < remaining.length - 1; first += 1) for (let second = first + 1; second < remaining.length; second += 1) {
      const distance = Math.hypot(remaining[first].x - remaining[second].x, remaining[first].y - remaining[second].y);
      if (distance < nearest) { nearest = distance; firstIndex = first; secondIndex = second; }
    }
    const second = remaining.splice(secondIndex, 1)[0]; const first = remaining.splice(firstIndex, 1)[0];
    if (pointKey(first) === pointKey(second)) continue;
    const id = `${connectorId}:${connectorIds.length + 1}`; connectorIds.push(id);
    after = appendDraftStroke(after, { id, points: [first, second] });
  }
  if (analyzeDraft(after).faces.length > analyzeDraft(workingDraft).faces.length) return { before: draft, after, connectorIds };
  return undefined;
}

function clipDraftToBoundary(draft: SemanticDraft, boundary: RegionShape): SemanticDraft {
  const strokes = draft.strokes.flatMap((stroke) => {
    const result = assessPathConstraint(stroke.points, boundary);
    if (result.state === "outside") return [];
    return result.paths.map((points, index) => ({ id: index ? `${stroke.id}:inside:${index + 1}` : stroke.id, points }));
  });
  return { ...draft, strokes };
}

type Projection = { point: KernelPoint; offset: number; perimeter: number; vertices: { point: KernelPoint; offset: number }[] };

function shortestBoundaryClosure(first: KernelPoint, second: KernelPoint, boundary: RegionShape, tolerance: number) {
  for (const { outer } of shapePolygons(boundary)) {
    const firstProjection = projectToRing(first, outer); const secondProjection = projectToRing(second, outer);
    if (!firstProjection || !secondProjection || firstProjection.distance > tolerance || secondProjection.distance > tolerance) continue;
    const forward = forwardBoundaryPath(firstProjection.value, secondProjection.value);
    const backward = forwardBoundaryPath(secondProjection.value, firstProjection.value).reverse();
    const arc = pathLength(forward) <= pathLength(backward) ? forward : backward;
    return deduplicate([first, ...arc, second]);
  }
}

function projectToRing(point: KernelPoint, ring: readonly KernelPoint[]) {
  if (ring.length < 3) return undefined;
  const edgeLengths = ring.map((start, index) => distance(start, ring[(index + 1) % ring.length]));
  const perimeter = edgeLengths.reduce((sum, length) => sum + length, 0); let cumulative = 0;
  const vertices = ring.map((vertex, index) => { const result = { point: vertex, offset: cumulative }; cumulative += edgeLengths[index]; return result; });
  let best: { distance: number; value: Projection } | undefined; cumulative = 0;
  ring.forEach((start, index) => {
    const end = ring[(index + 1) % ring.length]; const dx = end.x - start.x; const dy = end.y - start.y; const squared = dx * dx + dy * dy;
    const amount = squared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared)) : 0;
    const projected = { x: start.x + amount * dx, y: start.y + amount * dy }; const candidate = distance(point, projected);
    if (!best || candidate < best.distance) best = { distance: candidate, value: { point: projected, offset: cumulative + amount * edgeLengths[index], perimeter, vertices } };
    cumulative += edgeLengths[index];
  });
  return best;
}

function forwardBoundaryPath(from: Projection, to: Projection) {
  const toOffset = to.offset >= from.offset ? to.offset : to.offset + from.perimeter;
  const vertices = from.vertices.flatMap(({ point, offset }) => {
    const adjusted = offset > from.offset ? offset : offset + from.perimeter;
    return adjusted < toOffset ? [{ point, offset: adjusted }] : [];
  }).toSorted((a, b) => a.offset - b.offset).map(({ point }) => point);
  return deduplicate([from.point, ...vertices, to.point]);
}

function distance(first: KernelPoint, second: KernelPoint) { return Math.hypot(first.x - second.x, first.y - second.y); }
function pathLength(points: readonly KernelPoint[]) { return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0); }
function deduplicate(points: readonly KernelPoint[]) { return points.filter((point, index) => index === 0 || distance(points[index - 1], point) > 1e-7); }
