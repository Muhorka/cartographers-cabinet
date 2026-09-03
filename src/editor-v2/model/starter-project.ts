import { createConstructionDocument } from "../construction/construction-document";
import { createBuildingWithDefaultLevel, createPlace } from "./hierarchy-operations";
import { emptyProject, type EditorProject } from "./project-model";
import type { EditorLocale } from "../i18n/workbench-copy";
import { localizeRegion } from "../geometry/region-transform";

export type StartingScale = "world" | "location" | "building" | "level" | "room";

export function createProjectAtScale(id: string, name: string, locale: EditorLocale, scale: StartingScale): EditorProject {
  let sequence = 0; const identity = { createId: () => `${id}:shape:${++sequence}` };
  let project = emptyProject(id, name); const rootId = `${id}:${scale}`;
  if (scale === "building" || scale === "level") {
    const constructionId = `${id}:plan`;
    const construction = createConstructionDocument(constructionId, [], { createId: identity.createId, createName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` });
    if (scale === "building") {
      project = createPlace(project, { id: rootId, name, kind: "building" });
      project = createPlace(project, { id: `${id}:level`, parentId: rootId, name: locale === "pl" ? "Parter" : "Ground floor", kind: "level", constructionId, order: 0 });
    } else project = createPlace(project, { id: rootId, name, kind: "level", constructionId, order: 0 });
    project = { ...project, constructions: [construction] };
  } else project = createPlace(project, { id: rootId, name, kind: scale === "room" ? "standalone-room" : scale });
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
