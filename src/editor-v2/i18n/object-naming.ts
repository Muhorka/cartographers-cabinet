import type { EditorProject } from "../model/project-model";
import { toolboxCopy } from "./toolbox-copy";
import type { EditorLocale } from "./workbench-copy";

/** Canonical user-facing default name for every drawable subject. */
export function nextSubjectName(project: EditorProject | undefined, subjectId: string, locale: EditorLocale, offset = 1) {
  const base = toolboxCopy[locale].subjects[subjectId] ?? (locale === "pl" ? "Obiekt" : "Object");
  const names = new Set(project ? [...project.places, ...project.elements, ...project.surfaces].map(({ name }) => name) : []);
  let number = 1; let freeSlot = 0;
  while (freeSlot < Math.max(1, offset)) {
    if (!names.has(`${base} ${number}`) && !(number === 1 && names.has(base))) freeSlot += 1;
    if (freeSlot < Math.max(1, offset)) number += 1;
  }
  return `${base} ${number}`;
}
