import type { EditorLocale } from "../i18n/workbench-copy";
import { nextSubjectName } from "../i18n/object-naming";
import type { EditorProject } from "../model/project-model";

export function drawingIdentity(locale: EditorLocale) {
  return {
    createId: () => crypto.randomUUID(),
    createRoomName: (index: number) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}`,
  };
}

export function drawingNaming(locale: EditorLocale, project?: EditorProject) {
  return {
    nameFor: (subjectId: string, index: number) => nextSubjectName(project, subjectId, locale, index),
    levelName: () => locale === "pl" ? "Parter" : "Ground floor",
  };
}
