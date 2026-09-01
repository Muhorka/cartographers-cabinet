import type { EditorProject, PlaceNode } from "../model/project-model";

export type InspectorFocus = Readonly<{ projectId: string; placeId: string }>;

export type PlaceOpenIntent = Readonly<{
  displayedPlaceId: string;
  inspectedPlaceId: string;
}>;

function projectPlace(project: EditorProject, placeId?: string) {
  return placeId ? project.places.find(({ id }) => id === placeId) : undefined;
}

function currentBuildingLevel(project: EditorProject, buildingId: string, displayedPlaceId?: string) {
  const byId = new Map(project.places.map((place) => [place.id, place]));
  const seen = new Set<string>(); let place = projectPlace(project, displayedPlaceId);
  while (place && !seen.has(place.id)) {
    seen.add(place.id);
    if (place.kind === "level" && place.parentId === buildingId) return place;
    place = place.parentId ? byId.get(place.parentId) : undefined;
  }
  return undefined;
}

export function orderedBuildingLevels(project: EditorProject, buildingId: string): PlaceNode[] {
  return project.places
    .map((place, index) => ({ place, index }))
    .filter(({ place }) => place.kind === "level" && place.parentId === buildingId)
    .sort((left, right) => (left.place.order ?? left.index) - (right.place.order ?? right.index) || left.place.id.localeCompare(right.place.id))
    .map(({ place }) => place);
}

/** Keeps the sheet being displayed separate from the hierarchy place being edited. */
export function placeOpenIntent(project: EditorProject, requestedPlaceId: string, currentDisplayedPlaceId?: string): PlaceOpenIntent | undefined {
  const requested = projectPlace(project, requestedPlaceId); if (!requested) return undefined;
  if (requested.kind !== "building") return { displayedPlaceId: requested.id, inspectedPlaceId: requested.id };
  const displayed = currentBuildingLevel(project, requested.id, currentDisplayedPlaceId) ?? orderedBuildingLevels(project, requested.id)[0] ?? requested;
  return { displayedPlaceId: displayed.id, inspectedPlaceId: requested.id };
}

export function inspectorFocus(project: EditorProject, placeId?: string): InspectorFocus | undefined {
  return projectPlace(project, placeId) ? { projectId: project.id, placeId: placeId! } : undefined;
}

/** A focus never crosses projects and never points at a place removed by history or restore. */
export function reconcileInspectorFocus(focus: InspectorFocus | undefined, project: EditorProject, activePlaceId?: string): InspectorFocus | undefined {
  if (focus?.projectId === project.id && projectPlace(project, focus.placeId)) return focus;
  return inspectorFocus(project, activePlaceId);
}

export function resolvedInspectedPlaceId(project: EditorProject, focus: InspectorFocus | undefined, activePlaceId?: string) {
  return reconcileInspectorFocus(focus, project, activePlaceId)?.placeId;
}
