import { sampleBezier } from "../geometry/bezier-geometry";
import { assessPathConstraint } from "../geometry/path-constraints";
import { assessRegionConstraint, pointInRegion } from "../geometry/region-constraints";
import type { DrawingElement, EditorProject, RegionShape } from "../model/project-model";

export function geometryFitsBoundary(geometry: DrawingElement["geometry"], boundary: RegionShape) {
  if (geometry.kind === "region") return assessRegionConstraint(geometry.shape, boundary).state === "inside";
  if (geometry.kind === "path") return assessPathConstraint(geometry.points, boundary).state === "inside";
  if (geometry.kind === "bezier") return assessPathConstraint(sampleBezier(geometry.nodes, geometry.closed), boundary).state === "inside";
  return pointInRegion(geometry.at, boundary);
}

export function equipmentFitsBoundaries(project: EditorProject, ownerIds: ReadonlySet<string>) {
  const owners = new Map(project.places.map((place) => [place.id, place]));
  return project.elements.every((element) => {
    if (element.layerId !== "equipment" || !ownerIds.has(element.belongsToId)) return true;
    const owner = owners.get(element.belongsToId);
    return !owner?.boundary || geometryFitsBoundary(element.geometry, owner.boundary);
  });
}
