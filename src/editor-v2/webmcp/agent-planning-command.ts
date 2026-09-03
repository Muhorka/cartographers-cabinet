import { applyPlanningAlignment } from "../planning/selection-alignment";
import { splitPlanningElement } from "../planning/planning-operations";
import type { EditableSelection } from "../drawing/selection-operations";
import type { EditorProject } from "../model/project-model";
import type { AgentLocale, AgentObjectRef } from "./agent-command-types";

const identity = (locale: AgentLocale) => ({ createId: () => crypto.randomUUID(), createRoomName: (index: number) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` });

export function buildPlanningAlignmentChange(project: EditorProject, activePlaceId: string, input: { refs: AgentObjectRef[]; axis: "horizontal" | "vertical"; edge?: "start" | "center" | "end"; distribute?: boolean; boundaryEditing?: boolean }, locale: AgentLocale = "en") {
  if (!input.refs.length) throw new Error("no-objects-selected");
  if (!input.distribute && !input.edge) throw new Error("edge-is-required-for-alignment");
  const selections: EditableSelection[] = input.refs.map(({ type, id }) => ({ kind: type, id }));
  const mode = input.distribute ? { kind: "distribute" as const, axis: input.axis } : { kind: "align" as const, axis: input.axis, edge: input.edge! };
  const result = applyPlanningAlignment(project, activePlaceId, selections, mode, input.boundaryEditing === true, identity(locale));
  if (result.state !== "applied") throw new Error(result.reason);
  return { project: result.project, summary: input.distribute ? (locale === "pl" ? `Rozmieszczono równomiernie ${input.refs.length} obiektów.` : `Evenly distributed ${input.refs.length} objects.`) : (locale === "pl" ? `Wyrównano ${input.refs.length} obiektów.` : `Aligned ${input.refs.length} objects.`), effects: input.refs.map(({ type, id }) => `aligned:${type}:${id}`) };
}

export function buildPlanningSplitChange(project: EditorProject, input: { ref: AgentObjectRef; vertexIndex: number }, locale: AgentLocale = "en") {
  if (input.ref.type !== "element") throw new Error("split-requires-element");
  const element = project.elements.find(({ id }) => id === input.ref.id);
  if (!element) throw new Error("element-not-found");
  if (element.locked) throw new Error("locked");
  const pieces = splitPlanningElement(element, input.vertexIndex, () => crypto.randomUUID(), `${element.name} (${locale === "pl" ? "część 2" : "part 2"})`);
  if (!pieces) throw new Error("geometry-cannot-be-split");
  return { project: { ...project, elements: project.elements.flatMap((candidate) => candidate.id === element.id ? pieces : [candidate]) }, summary: locale === "pl" ? `Podzielono ${element.name} w węźle ${input.vertexIndex + 1}.` : `Split ${element.name} at node ${input.vertexIndex + 1}.`, effects: [`split:element:${element.id}:${input.vertexIndex}`] };
}
