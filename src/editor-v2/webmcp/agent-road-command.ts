import { z } from "zod";
import { commitRoadEdit, reshapeRoad } from "../roads/road-editing";
import { updateElementDetails } from "../drawing/selection-detail-operations";
import { selectionIsLocked } from "../drawing/selection-locks";
import type { EditorProject } from "../model/project-model";
import type { AgentLocale, AgentObjectRef } from "./agent-command-types";
import { ribbonEdges } from "../geometry/ribbon-geometry";
import { joinRoads } from "../roads/road-joining";
const inputSchema = z.object({
  id: z.string().min(1), widthMeters: z.number().finite().min(.1).max(1000).optional(),
  channel: z.number().int().min(0).max(2).optional(), index: z.number().int().min(0).max(100_000).optional(),
  point: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
}).strict();
export function roadEditingHandles(project: EditorProject, id: string) {
  const road = project.elements.find((item) => item.id === id && item.layerId === "roads");
  if (!road) throw new Error("road-not-found");
  const points = road.geometry.kind === "path" ? road.geometry.points : road.geometry.kind === "bezier" ? road.geometry.nodes.map(({ anchor }) => anchor) : [];
  return { ownerId: road.belongsToId, units: "metres", anchors: points.map((point, index) => ({ channel: 0, index, point })), edges: ribbonEdges(road).flatMap(({ t, left, right }, index) => [{ channel: 1, index, t, point: left }, { channel: 2, index, t, point: right }]) };
}
export function buildRoadEdit(project: EditorProject, value: unknown, locale: AgentLocale = "en") {
  const input = inputSchema.parse(value); const road = project.elements.find(({ id, layerId }) => id === input.id && layerId === "roads");
  if (!road || selectionIsLocked(project, { kind: "element", id: input.id })) throw new Error("road-not-editable");
  let next = input.widthMeters !== undefined ? updateElementDetails(project, road.id, { widthMeters: input.widthMeters }) : project;
  if (input.point) {
    if (input.channel === undefined || input.index === undefined) throw new Error("road-handle-needs-channel-and-index");
    const current = next.elements.find(({ id }) => id === road.id)!;
    const reshaped = reshapeRoad(current, input.channel, input.index, input.point);
    const committed = reshaped && commitRoadEdit(next, reshaped); if (!committed) throw new Error("road-obstacle");
    next = committed;
  }
  return { project: next, summary: locale === "pl" ? "Zmieniono kształt lub szerokość drogi." : "Updated road shape / width.", effects: [`updated:element:${road.id}`] };
}

export function buildRoadJoin(project: EditorProject, refs: AgentObjectRef[], locale: AgentLocale = "en") {
  if (refs.length !== 2 || refs.some(({ type }) => type !== "element")) throw new Error("join-requires-two-roads");
  const result = joinRoads(project, refs.map(({ id }) => id), { createId: () => crypto.randomUUID() });
  if (result.state === "blocked") throw new Error(result.reason);
  return { project: result.project, summary: result.state === "joined" ? (locale === "pl" ? "Połączono dwie drogi w jeden edytowalny przebieg." : "Joined two roads into one editable path.") : (locale === "pl" ? `Utworzono ${result.junctions.length} skrzyżowanie(a) dróg.` : `Created ${result.junctions.length} road junction(s).`), effects: result.state === "joined" ? [`joined:road:${result.survivorId}:${result.removedId}`] : result.junctions.map(({ id }) => `junction:road:${id}`) };
}
