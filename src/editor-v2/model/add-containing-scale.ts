import { createLevelForBuilding, createPlace, wrapPlaceInBroaderMap, wrapStandaloneRoomInBuilding } from "./hierarchy-operations";
import type { EditorProject } from "./project-model";

export type ContainingScaleKind = "world" | "location" | "building" | "custom";
export type MapLevelKind = ContainingScaleKind | "level";
type Identity = { createId(): string };

function defaultName(kind: ContainingScaleKind, locale: "pl" | "en") {
  const names = locale === "pl"
    ? { building: "Nowy budynek", location: "Nowa lokalizacja", world: "Nowy świat", custom: "Własny poziom mapy" }
    : { building: "New building", location: "New place", world: "New world", custom: "Custom map scale" };
  return names[kind];
}

export function addContainingScale(project: EditorProject, placeId: string, desiredKind: ContainingScaleKind, chosenName: string | undefined, locale: "pl" | "en", identity: Identity) {
  let next = project; let currentId = placeId; let openedId = placeId; const addedIds: string[] = [];
  if (desiredKind === "custom") {
    const id = identity.createId(); next = wrapPlaceInBroaderMap(next, currentId, { id, name: chosenName ?? defaultName("custom", locale), kind: "custom" });
    return { project: next, openedId: id, addedIds: [id] };
  }
  for (let guard = 0; guard < 4; guard += 1) {
    const current = next.places.find(({ id }) => id === currentId); if (!current || current.kind === desiredKind) break;
    if (current.kind === "standalone-room") {
      const buildingId = identity.createId(); const levelId = identity.createId();
      next = wrapStandaloneRoomInBuilding(next, current.id, { buildingId, levelId, constructionId: identity.createId(), buildingName: desiredKind === "building" ? chosenName ?? defaultName("building", locale) : defaultName("building", locale), levelName: locale === "pl" ? "Parter" : "Ground floor" }, identity);
      currentId = buildingId; openedId = desiredKind === "building" ? levelId : buildingId; addedIds.push(buildingId, levelId); continue;
    }
    const nextKind = current.kind === "level" ? "building" : current.kind === "building" || current.kind === "object" || current.kind === "room" ? "location" : current.kind === "location" ? "world" : undefined;
    if (!nextKind) break;
    const id = identity.createId(); const final = nextKind === desiredKind;
    next = wrapPlaceInBroaderMap(next, current.id, { id, name: final ? chosenName ?? defaultName(nextKind, locale) : defaultName(nextKind, locale), kind: nextKind, ...(nextKind === "building" && current.boundary ? { boundary: current.boundary } : {}) });
    currentId = id; openedId = final && nextKind === "building" && current.kind === "level" ? current.id : id; addedIds.push(id);
  }
  return currentId === placeId ? undefined : { project: next, openedId, addedIds };
}

export function addMapLevel(project: EditorProject, placeId: string, desiredKind: MapLevelKind, chosenName: string | undefined, locale: "pl" | "en", identity: Identity) {
  const active = project.places.find(({ id }) => id === placeId); if (!active) return undefined;
  if (active.kind === "building" && desiredKind === "level") {
    const id = identity.createId(); const count = project.places.filter(({ parentId, kind }) => parentId === active.id && kind === "level").length;
    const next = createLevelForBuilding(project, { id, constructionId: identity.createId(), buildingId: active.id, name: chosenName ?? (locale === "pl" ? `Piętro ${count}` : `Level ${count}`), roomName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` }, identity);
    return { project: next, openedId: id, addedIds: [id] };
  }
  if (["world", "location", "custom"].includes(active.kind) && (desiredKind === "location" || desiredKind === "custom")) {
    const id = identity.createId(); const next = createPlace(project, { id, parentId: active.id, name: chosenName ?? defaultName(desiredKind, locale), kind: desiredKind });
    return { project: next, openedId: id, addedIds: [id] };
  }
  return desiredKind === "level" ? undefined : addContainingScale(project, placeId, desiredKind, chosenName, locale, identity);
}
