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
import type { AgentLocale } from "./agent-command-types";

const identity = (locale: AgentLocale) => ({ createId: () => crypto.randomUUID(), createRoomName: (index: number) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` });

export type HierarchyChange =
  | { action: "add-map-level"; placeId: string; kind: MapLevelKind; name?: string }
  | { action: "add-building-level"; buildingId: string; position: "above" | "below"; name?: string }
  | { action: "reorder-level"; levelId: string; beforeLevelId?: string }
  | { action: "reparent-place"; placeId: string; parentId?: string };

function levelName(project: EditorProject, buildingId: string, position: "above" | "below", locale: AgentLocale) {
  const levels = project.places.filter(({ parentId, kind }) => parentId === buildingId && kind === "level");
  const count = levels.filter(({ order }) => position === "below" ? (order ?? 0) < 0 : (order ?? 0) > 0).length + 1;
  if (locale === "pl") return position === "below" ? count === 1 ? "Piwnica" : `Piwnica ${count}` : `Piętro ${count}`;
  return position === "below" ? count === 1 ? "Basement" : `Basement ${count}` : `Floor ${count}`;
}

export function buildHierarchyChange(project: EditorProject, input: HierarchyChange, locale: AgentLocale = "en"): PreparedChange {
  if (input.action === "add-map-level") {
    const result = addMapLevel(project, input.placeId, input.kind, input.name, locale, identity(locale));
    if (!result) throw new Error("map-level-cannot-be-added-here");
    return { project: result.project, summary: locale === "pl" ? `Dodano poziom mapy ${result.openedId}.` : `Added map level ${result.openedId}.`, effects: result.addedIds.map((id) => `created:place:${id}`) };
  }
  if (input.action === "add-building-level") {
    const commandIdentity = identity(locale); const id = commandIdentity.createId(); const name = input.name ?? levelName(project, input.buildingId, input.position, locale);
    const next = createLevelForBuilding(project, { id, constructionId: commandIdentity.createId(), buildingId: input.buildingId, name, position: input.position, roomName: commandIdentity.createRoomName }, commandIdentity);
    return { project: next, summary: locale === "pl" ? `Dodano kondygnację ${name}.` : `Added floor ${name}.`, effects: [`created:place:${id}`] };
  }
  if (input.action === "reorder-level") return { project: reorderLevel(project, input.levelId, input.beforeLevelId), summary: locale === "pl" ? "Zmieniono kolejność kondygnacji." : "Reordered floors.", effects: [`reordered:place:${input.levelId}`] };
  return { project: reparentPlace(project, input.placeId, input.parentId), summary: locale === "pl" ? "Zmieniono miejsce w hierarchii." : "Changed place in hierarchy.", effects: [`reparented:place:${input.placeId}`] };
}

export function buildClearLayerChange(project: EditorProject, activePlaceId: string, layerId: WorkLayerId, category: ConstructionClearCategory = "all", locale: AgentLocale = "en"): PreparedChange {
  const visibleLayer = normalizedClearLayer(layerId);
  const commandIdentity = identity(locale);
  const temporary = new EditorSession(project, { initialPlaceId: activePlaceId, initialToolbox: createToolboxState(visibleLayer), createId: commandIdentity.createId, createRoomName: commandIdentity.createRoomName });
  const result = temporary.clearCurrentLayer(visibleLayer, category);
  if (!result.changed) throw new Error(result.code);
  return { project: temporary.getState().project, summary: locale === "pl" ? `Wyczyszczono zakres ${category} warstwy ${visibleLayer}.` : `Cleared ${category} layer ${visibleLayer}.`, effects: [`cleared:${visibleLayer}:${category}:${activePlaceId}`] };
}
