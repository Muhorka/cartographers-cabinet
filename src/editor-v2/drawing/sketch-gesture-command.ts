import { arcBezierNodes, regionFromGesture } from "./gesture-geometry";
import { addElement } from "../model/hierarchy-operations";
import type { DrawingElement, EditorProject } from "../model/project-model";
import type { MapGestureCommandInput, MapGestureCommandResult } from "./map-gesture-command";

type Identity = { createId(): string };
type Naming = { nameFor(subjectId: string, index: number): string };

/** Stores freehand, line, shape and arc sketches in the ordinary element model. */
export function applySketchGesture(project: EditorProject, input: MapGestureCommandInput, targetPlaceId: string, identity: Identity, naming: Naming): MapGestureCommandResult {
  const shape = regionFromGesture(input.gesture.instrumentId, input.gesture.points);
  const id = identity.createId();
  const geometry: DrawingElement["geometry"] = (input.gesture.instrumentId === "pen" || input.gesture.instrumentId === "arc") && (input.gesture.bezierNodes || input.gesture.instrumentId === "arc" && input.gesture.points.length >= 3)
    ? { kind: "bezier", nodes: input.gesture.bezierNodes ?? arcBezierNodes(input.gesture.points[0], input.gesture.points[1], input.gesture.points[2]), closed: input.gesture.closed ?? false }
    : shape
    ? { kind: "region", shape }
    : { kind: "path", points: input.gesture.points, closed: false };
  const next = addElement(project, { id, name: naming.nameFor(input.subjectId, 1), layerId: "sketch", subjectId: input.subjectId, geometry, visible: true, locked: false, tags: [], access: [], properties: {} }, targetPlaceId);
  return { state: "applied", project: next, selection: { kind: "element", id } };
}
