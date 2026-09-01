import { applyPlanningAlignment } from "../planning/selection-alignment";
import { splitPlanningElement } from "../planning/planning-operations";
import type { EditableSelection } from "../drawing/selection-operations";
import type { EditorProject } from "../model/project-model";
import type { AgentObjectRef } from "./agent-command-types";

const identity = { createId: () => crypto.randomUUID(), createRoomName: (index: number) => `Pomieszczenie ${index}` };

export function buildPlanningAlignmentChange(project: EditorProject, activePlaceId: string, input: { refs: AgentObjectRef[]; axis: "horizontal" | "vertical"; edge?: "start" | "center" | "end"; distribute?: boolean; boundaryEditing?: boolean }) {
  if (!input.refs.length) throw new Error("no-objects-selected");
  if (!input.distribute && !input.edge) throw new Error("edge-is-required-for-alignment");
  const selections: EditableSelection[] = input.refs.map(({ type, id }) => ({ kind: type, id }));
  const mode = input.distribute ? { kind: "distribute" as const, axis: input.axis } : { kind: "align" as const, axis: input.axis, edge: input.edge! };
  const result = applyPlanningAlignment(project, activePlaceId, selections, mode, input.boundaryEditing === true, identity);
  if (result.state !== "applied") throw new Error(result.reason);
  return { project: result.project, summary: input.distribute ? `Rozmieszczono równomiernie ${input.refs.length} obiektów.` : `Wyrównano ${input.refs.length} obiektów.`, effects: input.refs.map(({ type, id }) => `aligned:${type}:${id}`) };
}

export function buildPlanningSplitChange(project: EditorProject, input: { ref: AgentObjectRef; vertexIndex: number }) {
  if (input.ref.type !== "element") throw new Error("split-requires-element");
  const element = project.elements.find(({ id }) => id === input.ref.id);
  if (!element) throw new Error("element-not-found");
  if (element.locked) throw new Error("locked");
  const pieces = splitPlanningElement(element, input.vertexIndex, () => crypto.randomUUID(), `${element.name} (część 2)`);
  if (!pieces) throw new Error("geometry-cannot-be-split");
  return { project: { ...project, elements: project.elements.flatMap((candidate) => candidate.id === element.id ? pieces : [candidate]) }, summary: `Podzielono ${element.name} w węźle ${input.vertexIndex + 1}.`, effects: [`split:element:${element.id}:${input.vertexIndex}`] };
}
