import { addMapLevel, type MapLevelKind } from "../model/add-containing-scale";
import { createLevelForBuilding, reparentPlace } from "../model/hierarchy-operations";
import { reorderLevel } from "../model/level-operations";
import type { EditorProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import type { ConstructionClearCategory } from "../state/clear-construction-layer";
import { createToolboxState } from "../toolbox/toolbox-state";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { normalizedClearLayer } from "../state/editor-session";
import type { PreparedChange } from "./editor-command-coordinator";

const identity = { createId: () => crypto.randomUUID(), createRoomName: (index: number) => `Pomieszczenie ${index}` };

export type HierarchyChange =
  | { action: "add-map-level"; placeId: string; kind: MapLevelKind; name?: string; locale?: "pl" | "en" }
  | { action: "add-building-level"; buildingId: string; position: "above" | "below"; name?: string }
  | { action: "reorder-level"; levelId: string; beforeLevelId?: string }
  | { action: "reparent-place"; placeId: string; parentId?: string };

function levelName(project: EditorProject, buildingId: string, position: "above" | "below") {
  const levels = project.places.filter(({ parentId, kind }) => parentId === buildingId && kind === "level");
  const count = levels.filter(({ order }) => position === "below" ? (order ?? 0) < 0 : (order ?? 0) > 0).length + 1;
  return position === "below" ? count === 1 ? "Piwnica" : `Piwnica ${count}` : `Piętro ${count}`;
}

export function buildHierarchyChange(project: EditorProject, input: HierarchyChange): PreparedChange {
  if (input.action === "add-map-level") {
    const result = addMapLevel(project, input.placeId, input.kind, input.name, input.locale ?? "pl", identity);
    if (!result) throw new Error("map-level-cannot-be-added-here");
    return { project: result.project, summary: `Dodano poziom mapy ${result.openedId}.`, effects: result.addedIds.map((id) => `created:place:${id}`) };
  }
  if (input.action === "add-building-level") {
    const id = identity.createId(); const name = input.name ?? levelName(project, input.buildingId, input.position);
    const next = createLevelForBuilding(project, { id, constructionId: identity.createId(), buildingId: input.buildingId, name, position: input.position, roomName: identity.createRoomName }, identity);
    return { project: next, summary: `Dodano kondygnację ${name}.`, effects: [`created:place:${id}`] };
  }
  if (input.action === "reorder-level") return { project: reorderLevel(project, input.levelId, input.beforeLevelId), summary: "Zmieniono kolejność kondygnacji.", effects: [`reordered:place:${input.levelId}`] };
  return { project: reparentPlace(project, input.placeId, input.parentId), summary: "Zmieniono miejsce w hierarchii.", effects: [`reparented:place:${input.placeId}`] };
}

export function buildClearLayerChange(project: EditorProject, activePlaceId: string, layerId: WorkLayerId, category: ConstructionClearCategory = "all"): PreparedChange {
  const visibleLayer = normalizedClearLayer(layerId);
  const temporary = new EditorSession(project, { initialPlaceId: activePlaceId, initialToolbox: createToolboxState(visibleLayer), createId: identity.createId, createRoomName: identity.createRoomName });
  const result = temporary.clearCurrentLayer(visibleLayer, category);
  if (!result.changed) throw new Error(result.code);
  return { project: temporary.getState().project, summary: `Wyczyszczono zakres ${category} warstwy ${visibleLayer}.`, effects: [`cleared:${visibleLayer}:${category}:${activePlaceId}`] };
}
