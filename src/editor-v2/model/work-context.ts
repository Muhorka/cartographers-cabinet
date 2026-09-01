import type { EditorProject, PlaceNode } from "./project-model";
import { getWorkLayer, type WorkLayerId, type WorkSubject } from "../toolbox/toolbox-model";

export type LayerAvailability = { available: true; targetPlaceId: string; constructionId?: string } | { available: false; reason: "missing-place" | "requires-broader-map" | "requires-level-plan" | "requires-boundary" };

function place(project: EditorProject, placeId: string) {
  return project.places.find(({ id }) => id === placeId);
}

function levelsOf(project: EditorProject, buildingId: string) {
  return project.places.filter(({ parentId, kind }) => parentId === buildingId && kind === "level");
}

function constructionTarget(project: EditorProject, active: PlaceNode) {
  if (active.kind === "level" && active.constructionId) return { targetPlaceId: active.id, constructionId: active.constructionId };
  if (active.kind === "building") {
    const levels = levelsOf(project, active.id);
    if (levels.length === 1 && levels[0].constructionId) return { targetPlaceId: levels[0].id, constructionId: levels[0].constructionId };
  }
  if (active.kind === "room" && active.parentId) {
    const level = place(project, active.parentId);
    if (level?.kind === "level" && level.constructionId) return { targetPlaceId: active.id, constructionId: level.constructionId };
  }
  return undefined;
}

const broadMapKinds = new Set<PlaceNode["kind"]>(["world", "location", "custom"]);

/**
 * Returns the subjects exposed by the current work layer.
 *
 * Equipment uses one catalogue in every map context. A room can contain a
 * plant or monument just as an outdoor map can contain furniture, so filtering
 * these subjects by hierarchy made the UI and agent disagree with the model.
 */
export function availableWorkSubjects(project: EditorProject, placeId: string, layerId: WorkLayerId): readonly WorkSubject[] {
  const subjects = getWorkLayer(layerId).subjects;
  return subjects;
}

export function preferredWorkLayer(project: EditorProject, placeId: string): WorkLayerId {
  const active = place(project, placeId);
  if (!active) return "sketch";
  if (active.kind === "room" || active.kind === "standalone-room") return active.boundary ? "equipment" : "sketch";
  if (active.kind === "level" || (active.kind === "building" && levelsOf(project, active.id).length === 1)) return "construction";
  return broadMapKinds.has(active.kind) ? "terrain" : "sketch";
}

export function workLayerAvailability(project: EditorProject, placeId: string, layerId: WorkLayerId): LayerAvailability {
  const active = place(project, placeId); if (!active) return { available: false, reason: "missing-place" };
  if (layerId === "sketch") return { available: true, targetPlaceId: active.id };
  if (layerId === "roads") return broadMapKinds.has(active.kind)
    ? { available: true, targetPlaceId: active.id } : { available: false, reason: "requires-broader-map" };
  if (layerId === "terrain") return broadMapKinds.has(active.kind) || active.kind === "building" || active.kind === "level"
    ? { available: true, targetPlaceId: active.id }
    : { available: false, reason: "requires-broader-map" };
  if (layerId === "boundaries") return broadMapKinds.has(active.kind)
    ? { available: true, targetPlaceId: active.id }
    : { available: false, reason: "requires-broader-map" };
  if (layerId === "buildings") return broadMapKinds.has(active.kind)
    ? { available: true, targetPlaceId: active.id } : { available: false, reason: "requires-broader-map" };
  if (layerId === "construction") {
    const target = constructionTarget(project, active);
    return target ? { available: true, ...target } : { available: true, targetPlaceId: active.id };
  }
  if (layerId === "openings") {
    const target = constructionTarget(project, active);
    return target ? { available: true, ...target } : { available: false, reason: "requires-level-plan" };
  }
  if (layerId === "equipment") {
    const target = constructionTarget(project, active);
    return target ? { available: true, ...target } : { available: true, targetPlaceId: active.id };
  }
  return { available: true, targetPlaceId: active.id };
}
