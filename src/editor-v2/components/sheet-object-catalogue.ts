import { constructionNetwork } from "../construction/construction-network";
import type { EditorProject } from "../model/project-model";
import { createProjectStoryLabelResolver } from "../story/object-display-name";
import type { StoryObjectRef } from "../story/types";

import { constructionPlaceForView, elementContextDepth, roomEditingScope, surfaceContextDepth } from "./map-sheet-geometry";
import type { MapSelection } from "./map-sheet";
import type { SheetObjectListCopy } from "./sheet-object-list";

export type SheetObjectItem = {
  selection: MapSelection;
  label: string;
  description?: string;
  tags?: string[];
  visible?: boolean;
  locked?: boolean;
};

export type SheetObjectGroup = { id: string; label: string; open: boolean; items: SheetObjectItem[] };

export function sheetObjectGroups(project: EditorProject, activePlaceId: string, copy: SheetObjectListCopy): SheetObjectGroup[] {
  const places = project.places.filter(({ parentId, kind }) => parentId === activePlaceId && kind !== "room");
  const elements = project.elements.filter((element) => elementContextDepth(project, activePlaceId, element) !== undefined);
  const surfaces = project.surfaces.filter((surface) => surfaceContextDepth(project, activePlaceId, surface) !== undefined);
  const owner = constructionPlaceForView(project, activePlaceId);
  const construction = project.constructions.find(({ id }) => id === owner?.constructionId);
  const active = project.places.find(({ id }) => id === activePlaceId);
  const scope = active?.kind === "room" && construction ? roomEditingScope(active, construction, constructionNetwork(construction.walls, construction.enclosure)) : {};
  const rooms = active?.kind === "level" ? construction?.rooms ?? [] : [];
  const openings = (construction?.openings ?? []).filter(({ wallId }) => !scope.wallIds || scope.wallIds.has(wallId));
  const transitions = (construction?.transitions ?? []).filter(({ id }) => !scope.transitionIds || scope.transitionIds.has(id));
  const walls = (construction?.walls ?? []).filter(({ id }) => !scope.wallIds || scope.wallIds.has(id));
  const storyLabel = openings.length || transitions.length || walls.length ? createProjectStoryLabelResolver(project) : undefined;
  const structuralLabel = (kind: Extract<StoryObjectRef["kind"], "wall" | "opening" | "transition">, id: string, fallback: string) => storyLabel && construction
    ? storyLabel({ kind, id, scopeId: construction.id }, fallback)
    : fallback;
  const elementItems = (layerId: "terrain" | "roads" | "equipment" | "sketch") => elements.filter((element) => element.layerId === layerId).map((element) => ({
    selection: { kind: "element" as const, id: element.id }, label: element.name, description: element.description, tags: element.tags,
    visible: element.visible, locked: element.locked,
  }));
  return [
    { id: "places", label: copy.places, open: false, items: places.map((place) => ({ selection: { kind: "place" as const, id: place.id }, label: place.name, description: place.description, tags: place.tags, visible: place.visible ?? true, locked: place.locked ?? false })) },
    { id: "terrain", label: copy.terrain, open: false, items: elementItems("terrain") },
    { id: "roads", label: copy.roads ?? copy.terrain, open: false, items: elementItems("roads") },
    { id: "rooms", label: copy.rooms, open: false, items: rooms.map((room) => ({ selection: { kind: "room" as const, id: room.id, scopeId: construction?.id }, label: room.name, description: room.description, tags: room.tags, visible: room.visible ?? true, locked: room.locked ?? false })) },
    { id: "surfaces", label: copy.surfaces ?? copy.features, open: false, items: surfaces.map((surface) => ({ selection: { kind: "surface" as const, id: surface.id }, label: surface.name, description: surface.description, tags: surface.tags, visible: surface.visible, locked: surface.locked })) },
    { id: "equipment", label: copy.equipment, open: false, items: elementItems("equipment") },
    { id: "features", label: copy.features, open: false, items: [
      ...openings.map((opening, index) => ({ selection: { kind: "opening" as const, id: opening.id, scopeId: construction?.id }, label: structuralLabel("opening", opening.id, copy.openingName(opening.kind, index + 1)), visible: opening.visible ?? true, locked: opening.locked ?? false })),
      ...transitions.map((transition, index) => { const fallback = transition.kind === "elevator" ? copy.elevatorName?.(index + 1) ?? copy.stairsName(index + 1) : copy.stairsName(index + 1); return { selection: { kind: "transition" as const, id: transition.id, scopeId: construction?.id }, label: structuralLabel("transition", transition.id, fallback), visible: transition.visible ?? true, locked: transition.locked ?? false }; }),
    ] },
    { id: "walls", label: copy.walls, open: false, items: walls.map((wall, index) => ({ selection: { kind: "wall" as const, id: wall.id, scopeId: construction?.id }, label: structuralLabel("wall", wall.id, copy.wallName(index + 1)), visible: wall.visible ?? true, locked: wall.locked ?? false })) },
    { id: "sketch", label: copy.sketch, open: false, items: elementItems("sketch") },
  ].filter(({ items }) => items.length);
}

function searchableText(item: SheetObjectItem) {
  return [item.label, item.description, ...(item.tags ?? [])].filter(Boolean).join(" ").normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

export function filterSheetObjectGroups(groups: SheetObjectGroup[], query: string) {
  const normalized = query.trim().normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  if (!normalized) return groups;
  const words = normalized.split(/\s+/);
  return groups.map((group) => ({ ...group, open: true, items: group.items.filter((item) => {
    const text = searchableText(item); return words.every((word) => text.includes(word));
  }) })).filter(({ items }) => items.length);
}
