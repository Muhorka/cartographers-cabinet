import type { AffineMatrix } from "./affine-transform";
import { applyAffinePoint } from "./affine-transform";
import { labelObstacleForLayout, type LabelObstacle, type RoomLabelLayout } from "./room-label-layout";
import type { RegionLabelLayout } from "./region-label-layout";

const identity: AffineMatrix = [1, 0, 0, 1, 0, 0];

export type PlannedLabelLayout = RoomLabelLayout | RegionLabelLayout;

export type LabelCollisionEntry = {
  key: string;
  matrix?: AffineMatrix;
  bounds?: LabelObstacle;
  localObstacles?: readonly LabelObstacle[];
  layout(obstacles: readonly LabelObstacle[]): PlannedLabelLayout | undefined;
};

export type LabelLayoutPlan = {
  get(key: string): PlannedLabelLayout | undefined;
};

/** Pure two-phase layout: all labels are planned before any child renders. */
export function createLabelLayoutPlan(entries: readonly LabelCollisionEntry[]): LabelLayoutPlan {
  const layouts = new Map<string, PlannedLabelLayout>();
  const sheetObstacles: Array<{ obstacle: LabelObstacle; bounds: Bounds }> = [];
  const buckets = new Map<string, number[]>();
  for (const entry of entries) {
    const matrix = entry.matrix ?? identity;
    const inverse = invert(matrix);
    const targetBounds = entry.bounds ? boundsFor(transformObstacle(matrix, entry.bounds)) : undefined;
    const candidateIndexes = targetBounds ? bucketIndexes(buckets, targetBounds) : sheetObstacles.map((_, index) => index);
    const dynamic = candidateIndexes
      .filter((index) => !targetBounds || intersects(sheetObstacles[index]!.bounds, targetBounds))
      .map((index) => transformObstacle(inverse, sheetObstacles[index]!.obstacle));
    const layout = entry.layout([...(entry.localObstacles ?? []), ...dynamic]);
    if (!layout) continue;
    layouts.set(entry.key, layout);
    if (isInsideLayout(layout)) {
      const obstacle = transformObstacle(matrix, labelObstacleForLayout(layout));
      const index = sheetObstacles.push({ obstacle, bounds: boundsFor(obstacle) }) - 1;
      for (const bucket of bucketsFor(sheetObstacles[index]!.bounds)) buckets.set(bucket, [...(buckets.get(bucket) ?? []), index]);
    }
  }
  return { get: (key) => layouts.get(key) };
}

function isInsideLayout(layout: PlannedLabelLayout): layout is RoomLabelLayout | (RegionLabelLayout & { kind: "inside" }) {
  return !("kind" in layout) || layout.kind === "inside";
}

function transformObstacle(matrix: AffineMatrix, obstacle: LabelObstacle): LabelObstacle {
  return { outer: obstacle.outer.map((point) => applyAffinePoint(matrix, point)), holes: obstacle.holes?.map((ring) => ring.map((point) => applyAffinePoint(matrix, point))) };
}

type Bounds = { left: number; right: number; top: number; bottom: number };
function boundsFor(obstacle: LabelObstacle): Bounds {
  const points = obstacle.outer;
  return { left: Math.min(...points.map(({ x }) => x)), right: Math.max(...points.map(({ x }) => x)), top: Math.min(...points.map(({ y }) => y)), bottom: Math.max(...points.map(({ y }) => y)) };
}
function intersects(first: Bounds, second: Bounds) { return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top; }

const bucketSize = 128;
function bucketsFor(bounds: Bounds) {
  const keys: string[] = [];
  for (let x = Math.floor(bounds.left / bucketSize); x <= Math.floor(bounds.right / bucketSize); x += 1) for (let y = Math.floor(bounds.top / bucketSize); y <= Math.floor(bounds.bottom / bucketSize); y += 1) keys.push(`${x}:${y}`);
  return keys;
}
function bucketIndexes(buckets: ReadonlyMap<string, readonly number[]>, bounds: Bounds) {
  const indexes = new Set<number>();
  for (const bucket of bucketsFor(bounds)) for (const index of buckets.get(bucket) ?? []) indexes.add(index);
  return [...indexes].toSorted((first, second) => first - second);
}

function invert([a, b, c, d, e, f]: AffineMatrix): AffineMatrix {
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return identity;
  return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant];
}
