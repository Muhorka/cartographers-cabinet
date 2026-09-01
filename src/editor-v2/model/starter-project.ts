import { createBuildingWithDefaultLevel, createIndependentLevel, createPlace } from "./hierarchy-operations";
import { emptyProject, type EditorProject } from "./project-model";
import type { EditorLocale } from "../i18n/workbench-copy";
import { localizeRegion } from "../geometry/region-transform";

export type StartingScale = "world" | "location" | "building" | "level" | "room";

export function createProjectAtScale(id: string, name: string, locale: EditorLocale, scale: StartingScale): EditorProject {
  let sequence = 0; const identity = { createId: () => `${id}:shape:${++sequence}` };
  const boundary = { kind: "rectangle" as const, x: -30, y: -20, width: 60, height: 40 };
  let project = emptyProject(id, name); const rootId = `${id}:${scale}`;
  if (scale === "building") project = createBuildingWithDefaultLevel(project, { id: rootId, levelId: `${id}:level`, constructionId: `${id}:plan`, name, levelName: locale === "pl" ? "Parter" : "Ground floor", boundary, roomName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` }, identity);
  else if (scale === "level") project = createIndependentLevel(project, { id: rootId, constructionId: `${id}:plan`, name, boundary, roomName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` }, identity);
  else project = createPlace(project, { id: rootId, name, kind: scale === "room" ? "standalone-room" : scale, ...(scale === "world" ? {} : { boundary }) });
  return { ...project, updatedAt: new Date().toISOString() };
}

export function createStarterProject(id: string, name: string, locale: EditorLocale): EditorProject {
  let sequence = 0; const identity = { createId: () => `${id}:${++sequence}` };
  let project = createPlace(emptyProject(id, name), { id: `${id}:world`, name: locale === "pl" ? "Nowy atlas" : "New atlas", kind: "world", boundary: { kind: "rectangle", x: 0, y: 0, width: 120, height: 80 } });
  const location = localizeRegion({ kind: "polygon", points: [{ x: 12, y: 10 }, { x: 104, y: 8 }, { x: 110, y: 68 }, { x: 20, y: 72 }] });
  project = createPlace(project, { id: `${id}:place`, parentId: `${id}:world`, name: locale === "pl" ? "Pierwsze miejsce" : "First place", kind: "location", boundary: location.boundary, transform: location.transform });
  const building = localizeRegion({ kind: "rectangle", x: -16, y: -11, width: 32, height: 22 });
  project = createBuildingWithDefaultLevel(project, { id: `${id}:building`, levelId: `${id}:level`, constructionId: `${id}:plan`, parentId: `${id}:place`, name: locale === "pl" ? "Dom kartografa" : "Cartographer's house", levelName: locale === "pl" ? "Parter" : "Ground floor", roomName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}`, boundary: building.boundary, transform: building.transform }, identity);
  return { ...project, updatedAt: new Date().toISOString() };
}
