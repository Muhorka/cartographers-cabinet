import type { RegionShape } from "../model/project-model";
import { transformRegion } from "./affine-transform";
import { labelObstaclesForShape } from "./region-label-layout";
import { assessRegionConstraint } from "./region-constraints";
import type { LabelObstacle } from "./room-label-layout";

export type LabelObstacleTranslation = { x: number; y: number };

export type RegionLabelObstacleSource = {
  id: string;
  ownerId: string;
  shape: RegionShape;
  translation?: LabelObstacleTranslation;
};

type PreparedSource = RegionLabelObstacleSource & {
  obstacles: readonly LabelObstacle[];
  absoluteBounds: Bounds;
  order: number;
};
type Bounds = { left: number; right: number; top: number; bottom: number };
export type RegionObstacleQueryMetrics = { sourceCount: number; scanned: number; bboxCandidates: number };

const BOUNDS_EPSILON = 1e-9;

/** Prepares same-owner region geometry once for contained-label collision checks. */
export function createContainedRegionObstacleIndex(sources: readonly RegionLabelObstacleSource[]) {
  const prepared = sources.map((source, order) => {
    const obstacles = labelObstaclesForShape(source.shape);
    const bounds = boundsFor(obstacles);
    const absoluteBounds = translateBounds(bounds, source.translation ?? { x: 0, y: 0 });
    return { ...source, obstacles, absoluteBounds, order } satisfies PreparedSource;
  });
  const byOwner = new Map<string, PreparedSource[]>();
  for (const source of prepared) {
    const group = byOwner.get(source.ownerId) ?? [];
    group.push(source);
    byOwner.set(source.ownerId, group);
  }
  for (const group of byOwner.values()) {
    group.sort((first, second) => first.absoluteBounds.left - second.absoluteBounds.left
      || first.absoluteBounds.right - second.absoluteBounds.right
      || first.order - second.order);
  }

  function query(target: RegionLabelObstacleSource) {
    const targetBounds = boundsFor(labelObstaclesForShape(target.shape));
    const absoluteTargetBounds = translateBounds(targetBounds, target.translation ?? { x: 0, y: 0 });
    const group = byOwner.get(target.ownerId) ?? [];
    const firstIndex = lowerBoundByLeft(group, absoluteTargetBounds.left - BOUNDS_EPSILON);
    const candidates: PreparedSource[] = [];
    let scanned = 0;
    for (let index = firstIndex; index < group.length; index += 1) {
      const source = group[index]!;
      if (source.absoluteBounds.left > absoluteTargetBounds.right + BOUNDS_EPSILON) break;
      scanned += 1;
      if (source.id !== target.id && boundsContained(source.absoluteBounds, absoluteTargetBounds)) candidates.push(source);
    }
    candidates.sort((first, second) => first.order - second.order);
    return { candidates, metrics: { sourceCount: group.length, scanned, bboxCandidates: candidates.length } };
  }

  return {
    forTarget(target: RegionLabelObstacleSource): LabelObstacle[] {
      const { candidates } = query(target);
      return candidates.flatMap((source) => {
        const translation = relativeTranslation(source.translation, target.translation);
        if (!fullyContained(source.shape, target.shape, translation)) return [];
        return source.obstacles.map((obstacle) => translateObstacle(obstacle, translation));
      });
    },
    metricsForTarget(target: RegionLabelObstacleSource): RegionObstacleQueryMetrics {
      return query(target).metrics;
    },
  };
}

function fullyContained(source: RegionShape, target: RegionShape, translation: LabelObstacleTranslation) {
  const translated = transformRegion([1, 0, 0, 1, translation.x, translation.y], source);
  return assessRegionConstraint(translated, target).state === "inside";
}

function relativeTranslation(source?: LabelObstacleTranslation, target?: LabelObstacleTranslation) {
  return { x: (source?.x ?? 0) - (target?.x ?? 0), y: (source?.y ?? 0) - (target?.y ?? 0) };
}

function translateObstacle(obstacle: LabelObstacle, translation: LabelObstacleTranslation): LabelObstacle {
  return {
    outer: obstacle.outer.map((point) => ({ x: point.x + translation.x, y: point.y + translation.y })),
    holes: obstacle.holes?.map((ring) => ring.map((point) => ({ x: point.x + translation.x, y: point.y + translation.y }))),
  };
}

function boundsFor(obstacles: readonly LabelObstacle[]): Bounds {
  const points = obstacles.flatMap(({ outer }) => outer);
  return {
    left: Math.min(...points.map(({ x }) => x)),
    right: Math.max(...points.map(({ x }) => x)),
    top: Math.min(...points.map(({ y }) => y)),
    bottom: Math.max(...points.map(({ y }) => y)),
  };
}

function translateBounds(bounds: Bounds, translation: LabelObstacleTranslation): Bounds {
  return { left: bounds.left + translation.x, right: bounds.right + translation.x, top: bounds.top + translation.y, bottom: bounds.bottom + translation.y };
}

function boundsContained(candidate: Bounds, container: Bounds) {
  return candidate.left >= container.left - BOUNDS_EPSILON
    && candidate.right <= container.right + BOUNDS_EPSILON
    && candidate.top >= container.top - BOUNDS_EPSILON
    && candidate.bottom <= container.bottom + BOUNDS_EPSILON;
}

function lowerBoundByLeft(sources: readonly PreparedSource[], left: number) {
  let lower = 0;
  let upper = sources.length;
  while (lower < upper) {
    const middle = (lower + upper) >>> 1;
    if (sources[middle]!.absoluteBounds.left < left) lower = middle + 1;
    else upper = middle;
  }
  return lower;
}
