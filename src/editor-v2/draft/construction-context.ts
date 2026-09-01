import { applyAffinePoint, relativePlaceMatrix } from "../geometry/affine-transform";
import type { CanonicalWall } from "../geometry/geometry-types";
import type { EditorProject } from "../model/project-model";

/** Returns the nearest construction wall set in the active place's coordinates. */
export function constructionWallsForPlace(project: EditorProject, placeId: string): CanonicalWall[] {
  const byId = new Map(project.places.map((place) => [place.id, place]));
  const visited = new Set<string>();
  let current = byId.get(placeId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.constructionId) {
      const walls = project.constructions.find(({ id }) => id === current!.constructionId)?.walls ?? [];
      const matrix = relativePlaceMatrix(project, placeId, current.id);
      return walls.map((wall) => ({
        ...wall,
        start: applyAffinePoint(matrix, wall.start),
        end: applyAffinePoint(matrix, wall.end),
      }));
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return [];
}
