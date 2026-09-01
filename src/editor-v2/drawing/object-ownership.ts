import { assessRegionConstraint, pointInRegion } from "../geometry/region-constraints";
import type { EditorProject, RegionShape } from "../model/project-model";

/** Chooses the smallest room that fully contains a newly placed object. */
export function objectOwnerForRegion(project: EditorProject, requestedOwnerId: string, shape: RegionShape) {
  const requested = project.places.find(({ id }) => id === requestedOwnerId);
  if (!requested || requested.kind === "room") return requested?.id;
  if (requested.kind !== "level") return requested.id;
  const rooms = project.places.filter(({ parentId, kind, boundary }) => parentId === requested.id && kind === "room" && boundary);
  const containing = rooms.filter(({ boundary }) => assessRegionConstraint(shape, boundary).state === "inside");
  return containing.length === 1 ? containing[0].id : rooms.length ? undefined : requested.id;
}

export function objectOwnerForPoint(project: EditorProject, requestedOwnerId: string, point: { x: number; y: number }) {
  const requested = project.places.find(({ id }) => id === requestedOwnerId);
  if (!requested || requested.kind === "room") return requested?.id;
  if (requested.kind !== "level") return requested.id;
  const rooms = project.places.filter(({ parentId, kind, boundary }) => parentId === requested.id && kind === "room" && boundary);
  const containing = rooms.filter(({ boundary }) => pointInRegion(point, boundary!));
  return containing.length === 1 ? containing[0].id : rooms.length ? undefined : requested.id;
}
