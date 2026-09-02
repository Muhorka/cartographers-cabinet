import type { AffineMatrix } from "./affine-transform";
import { labelObstacleForLayout, type LabelObstacle, type RoomLabelLayout } from "./room-label-layout";

const identity: AffineMatrix = [1, 0, 0, 1, 0, 0];

/**
 * Render-only label obstacles. Entries are kept in sheet coordinates so labels
 * belonging to different place owners can still avoid one another.
 */
export type LabelCollisionRegistry = {
  obstaclesFor(matrix?: AffineMatrix, local?: readonly LabelObstacle[]): LabelObstacle[];
  register(layout: RoomLabelLayout | undefined, matrix?: AffineMatrix): void;
};

export function createLabelCollisionRegistry(): LabelCollisionRegistry {
  const sheetObstacles: LabelObstacle[] = [];
  const frameCache = new Map<string, LabelObstacle[]>();
  return {
    obstaclesFor(matrix = identity, local = []) {
      const key = matrix.join(",");
      const transformed = frameCache.get(key) ?? [];
      for (let index = transformed.length; index < sheetObstacles.length; index += 1) transformed.push(transformObstacle(invert(matrix), sheetObstacles[index]!));
      frameCache.set(key, transformed);
      return local.length ? [...local, ...transformed] : transformed;
    },
    register(layout, matrix = identity) {
      if (!layout) return;
      sheetObstacles.push(transformObstacle(matrix, labelObstacleForLayout(layout)));
    },
  };
}

function transformObstacle(matrix: AffineMatrix, obstacle: LabelObstacle): LabelObstacle {
  return { outer: obstacle.outer.map((point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] })), holes: obstacle.holes?.map((ring) => ring.map((point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] }))) };
}

function invert([a, b, c, d, e, f]: AffineMatrix): AffineMatrix {
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return identity;
  return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant];
}
