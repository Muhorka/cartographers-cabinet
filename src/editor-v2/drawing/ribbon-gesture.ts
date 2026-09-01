import type { MapGestureCommandInput, MapGestureCommandResult } from "./map-gesture-command";
import type { DrawingElement, EditorProject } from "../model/project-model";
import { arcBezierNodes } from "./gesture-geometry";
import { ribbonWidthFor } from "../geometry/ribbon-style";
import { isRibbonSubject } from "../geometry/ribbon-geometry";

/** Creates an editable ribbon without applying the road-only obstacle router. */
export function applyRibbonGesture(project: EditorProject, input: MapGestureCommandInput, id: string, name: string): MapGestureCommandResult {
  const points = input.gesture.points;
  const layerId = input.layerId === "terrain" || input.layerId === "roads" ? input.layerId : undefined;
  if (points.length < 2 || !layerId || !isRibbonSubject(layerId, input.subjectId)) return { state: "nothing", project };
  const geometry: DrawingElement["geometry"] = input.gesture.instrumentId === "arc" && points.length >= 3
    ? { kind: "bezier", nodes: input.gesture.bezierNodes ?? arcBezierNodes(points[0], points[1], points[2]), closed: false }
    : input.gesture.bezierNodes
    ? { kind: "bezier", nodes: input.gesture.bezierNodes, closed: input.gesture.closed ?? false }
    : { kind: "path", points, closed: false };
  const candidate: DrawingElement = { id, belongsToId: input.activePlaceId, name, layerId, subjectId: input.subjectId,
    widthMeters: Math.max(.1, Math.min(1000, input.widthMeters ?? ribbonWidthFor(input.subjectId))), geometry, visible: true, locked: false, tags: [], access: [], properties: {} };
  return { state: "applied", project: { ...project, elements: [...project.elements, candidate] }, selection: { kind: "element", id } };
}
