import { arcBezierNodes } from "./gesture-geometry";
import { keepDraftAsSketch } from "../draft/complete-draft";
import { smoothPencilGesture } from "../geometry/pencil-smoothing";
import { addElement } from "../model/hierarchy-operations";
import type { DrawingElement, EditorProject } from "../model/project-model";
import type { MapGestureDraft } from "../components/map-sheet-gesture";
import type { SemanticDraft } from "../draft/semantic-draft";
import type { Identity, Naming } from "./map-gesture-command-types";

export function savePendingDraftAsSketch(project: EditorProject, draft: SemanticDraft, identity: Identity, nameForStroke: (index: number) => string) {
  return keepDraftAsSketch(project, draft, identity, nameForStroke).project;
}

export function saveGestureDraftAsSketch(project: EditorProject, activePlaceId: string, draft: MapGestureDraft, identity: Identity, name: string) {
  const preparedDraft = smoothPencilGesture(draft, project.measureSettings.pencilSmoothing); const id = identity.createId();
  const geometry: DrawingElement["geometry"] = (preparedDraft.instrumentId === "pen" || preparedDraft.instrumentId === "arc") && (preparedDraft.bezierNodes || preparedDraft.instrumentId === "arc" && preparedDraft.points.length >= 3)
    ? { kind: "bezier", nodes: preparedDraft.bezierNodes ?? arcBezierNodes(preparedDraft.points[0], preparedDraft.points[1], preparedDraft.points[2]), closed: false }
    : { kind: "path", points: preparedDraft.points, closed: false };
  return addElement(project, { id, name, layerId: "sketch", subjectId: "sketch.stroke", geometry, visible: true, locked: false, tags: [], access: [], properties: {} }, activePlaceId);
}

export function savePendingDraftAsPath(project: EditorProject, draft: SemanticDraft, identity: Identity, naming: Naming) {
  if (draft.layerId !== "terrain" || !["terrain.water", "terrain.custom"].includes(draft.subjectId)) return project;
  return draft.strokes.reduce((next, stroke, index) => addElement(next, { id: identity.createId(), name: naming.nameFor(draft.subjectId, index + 1), layerId: "terrain", subjectId: draft.subjectId, geometry: { kind: "path", points: stroke.points, closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} }, draft.belongsToId), project);
}
