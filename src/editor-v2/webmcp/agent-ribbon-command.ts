import { z } from "zod";
import { ribbonEdges, isRibbonElement } from "../geometry/ribbon-geometry";
import { reshapeRibbon } from "../geometry/ribbon-editing";
import { commitRibbonEdit } from "../geometry/ribbon-commit";
import { updateElementDetails } from "../drawing/selection-detail-operations";
import { selectionIsLocked } from "../drawing/selection-locks";
import type { EditorProject } from "../model/project-model";
import type { AgentObjectRef } from "./agent-command-types";
import { joinFlowingWater } from "../roads/road-joining";

const inputSchema = z.object({
  id: z.string().min(1), widthMeters: z.number().finite().min(.1).max(1000).optional(),
  channel: z.number().int().min(0).max(2).optional(), index: z.number().int().min(0).max(100_000).optional(),
  point: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
}).strict();

export function ribbonEditingHandles(project: EditorProject, id: string) {
  const ribbon = project.elements.find((item) => item.id === id && isRibbonElement(item));
  if (!ribbon) throw new Error("ribbon-not-found");
  const points = ribbon.geometry.kind === "path" ? ribbon.geometry.points : ribbon.geometry.kind === "bezier" ? ribbon.geometry.nodes.map(({ anchor }) => anchor) : [];
  return { ownerId: ribbon.belongsToId, layerId: ribbon.layerId, subjectId: ribbon.subjectId, units: "metres", anchors: points.map((point, index) => ({ channel: 0, index, point })), edges: ribbonEdges(ribbon).flatMap(({ t, left, right }, index) => [{ channel: 1, index, t, point: left }, { channel: 2, index, t, point: right }]) };
}

/** Builds the same prepared edit used by the editor for roads, rivers and
 * streams. Road routing remains inside commitRibbonEdit; water is committed
 * directly and therefore never receives obstacle constraints. */
export function buildRibbonEdit(project: EditorProject, value: unknown) {
  const input = inputSchema.parse(value); const ribbon = project.elements.find(({ id }) => id === input.id);
  if (!ribbon || !isRibbonElement(ribbon) || selectionIsLocked(project, { kind: "element", id: input.id })) throw new Error("ribbon-not-editable");
  let next = input.widthMeters !== undefined ? updateElementDetails(project, ribbon.id, { widthMeters: input.widthMeters }) : project;
  if (input.point) {
    if (input.channel === undefined || input.index === undefined) throw new Error("ribbon-handle-needs-channel-and-index");
    const current = next.elements.find(({ id }) => id === ribbon.id); if (!current || !isRibbonElement(current)) throw new Error("ribbon-not-editable");
    const reshaped = reshapeRibbon(current, input.channel, input.index, input.point); const committed = reshaped && commitRibbonEdit(next, reshaped);
    if (!committed) throw new Error(isRibbonElement(current) && current.layerId === "roads" ? "road-obstacle" : "ribbon-edit-invalid");
    next = committed;
  }
  return { project: next, summary: "Updated ribbon shape / width.", effects: [`updated:element:${ribbon.id}`] };
}

export function buildFlowingWaterJoin(project: EditorProject, refs: AgentObjectRef[]) {
  if (refs.length !== 2 || refs.some(({ type }) => type !== "element")) throw new Error("join-requires-two-watercourses");
  const result = joinFlowingWater(project, refs.map(({ id }) => id));
  if (result.state !== "joined") throw new Error(result.state === "blocked" ? result.reason : "watercourse-join-unavailable");
  return { project: result.project, summary: "Połączono rzekę lub strumień w jeden edytowalny przebieg.", effects: [`joined:watercourse:${result.survivorId}:${result.removedId}`] };
}
