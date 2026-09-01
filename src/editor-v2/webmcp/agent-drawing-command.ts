import { applyMapGesture } from "../drawing/map-gesture-command";
import { updateElementDetails, updateOpeningWidth, updateTransitionDetails } from "../drawing/selection-detail-operations";
import { addElement, updatePlaceDetails } from "../model/hierarchy-operations";
import { availableWorkSubjects, workLayerAvailability } from "../model/work-context";
import type { EditorProject } from "../model/project-model";
import { availableInstruments, getWorkLayer } from "../toolbox/toolbox-model";
import type { AgentDrawingInput, AgentMetadata } from "./agent-command-types";
import type { PreparedChange } from "./editor-command-coordinator";
import { nextSubjectName } from "../i18n/object-naming";
import { smoothPencilPoints } from "../geometry/pencil-smoothing";
import { applyProjectStoryMetadata } from "../story/project-commands";

const identity = { createId: () => crypto.randomUUID(), createRoomName: (index: number) => `Pomieszczenie ${index}` };

function applyMetadata(project: EditorProject, selection: { kind: string; id: string } | undefined, metadata: AgentMetadata) {
  if (!selection) return project;
  if (selection.kind === "place") return updatePlaceDetails(project, selection.id, {
    ...(metadata.name ? { name: metadata.name } : {}), ...(metadata.description !== undefined ? { description: metadata.description } : {}),
    ...(metadata.tags ? { tags: metadata.tags } : {}), ...(metadata.appearance ? { appearance: metadata.appearance } : {}),
  });
  if (selection.kind === "element") return updateElementDetails(project, selection.id, metadata);
  return project;
}

function openTerrainPath(project: EditorProject, ownerId: string, input: AgentDrawingInput): PreparedChange {
  const id = crypto.randomUUID(); const name = input.name ?? nextSubjectName(project, input.subjectId, "pl");
  const next = addElement(project, {
    id, name, description: input.description, layerId: "terrain", subjectId: input.subjectId,
    geometry: { kind: "path", points: smoothPencilPoints(input.points, project.measureSettings.pencilSmoothing), closed: false }, visible: input.visible ?? true,
    locked: input.locked ?? false, tags: input.tags ?? [], access: [], properties: {}, appearance: input.appearance,
  }, ownerId);
  return { project: next, summary: `Utworzono ${name}.`, effects: [`created:element:${id}`] };
}

export function buildDrawingChange(project: EditorProject, activePlaceId: string, input: AgentDrawingInput): PreparedChange {
  const ownerId = input.ownerId ?? activePlaceId; const layer = getWorkLayer(input.layerId);
  if (!layer.subjects.some(({ id }) => id === input.subjectId)) throw new Error("subject-is-not-available-on-layer");
  if (!availableWorkSubjects(project, ownerId, input.layerId).some(({ id }) => id === input.subjectId)) throw new Error("subject-is-not-available-in-map-context");
  if (!availableInstruments(input.layerId, input.subjectId).includes(input.instrumentId)) {
    const terrainPath = input.layerId === "terrain" && input.instrumentId === "pencil" && !input.closed && ["terrain.water", "terrain.custom"].includes(input.subjectId);
    if (!terrainPath) throw new Error("instrument-is-not-available-for-subject");
  }
  if (input.points.length < 1) throw new Error("geometry-needs-points");
  if (input.layerId === "terrain" && input.instrumentId === "pencil" && !input.closed && ["terrain.water", "terrain.custom"].includes(input.subjectId)) {
    return openTerrainPath(project, ownerId, input);
  }
  const naming = { nameFor: () => input.name ?? nextSubjectName(project, input.subjectId, "pl"), levelName: () => input.levelName ?? "Parter" };
  const result = applyMapGesture(project, {
    activePlaceId: ownerId, layerId: input.layerId, subjectId: input.subjectId, widthMeters: input.widthMeters,
    gesture: { instrumentId: input.instrumentId, points: input.points, bezierNodes: input.bezierNodes, closed: input.closed, snapTolerance: input.snapTolerance, hitRadius: input.hitRadius },
    boundaryEditing: input.boundaryEditing ?? false, acceptClip: input.acceptClip ?? true,
    ...((input.subjectId === "opening.stairs" || input.subjectId === "opening.elevator") ? { transition: { sourceLevelId: input.sourceLevelId, targetLevelId: input.targetLevelId, connectedLevelIds: input.connectedLevelIds, style: input.transitionStyle, direction: input.direction, sameLevelRise: input.sameLevelRise } } : {}),
  }, identity, naming);
  if (result.state === "blocked") throw new Error(result.reason);
  if (result.state === "clip-review") throw new Error("clipping-needs-acceptance");
  if (result.state === "review-required") throw new Error(`ambiguous-erase:${result.candidateIds.join(",")}`);
  if (result.state === "transition-config-required") throw new Error("transition-levels-need-selection");
  if (result.state === "draft-updated") throw new Error("geometry-did-not-form-an-object");
  if (result.state !== "applied") throw new Error("gesture-created-nothing");
  let next = applyMetadata(result.project, result.selection, input);
  const authoredName = input.name?.trim();
  if (result.selection && (result.selection.kind === "opening" || result.selection.kind === "transition") && (authoredName || input.description !== undefined)) {
    const availability = workLayerAvailability(next, ownerId, input.layerId);
    if (availability.available && availability.constructionId) {
      next = applyProjectStoryMetadata(next, {
        refs: [{ kind: result.selection.kind, id: result.selection.id, scopeId: availability.constructionId }],
        metadata: { ...(authoredName ? { narrativeLabel: authoredName } : {}), ...(input.description !== undefined ? { narrativeDescription: input.description } : {}) },
        action: "replace",
        target: "base",
      });
    }
  }
  if (input.openingWidth && result.selection?.kind === "opening") {
    const resized = updateOpeningWidth(next, ownerId, result.selection.id, input.openingWidth);
    if (resized.state !== "applied") throw new Error(`opening-width:${resized.state === "blocked" ? resized.reason : "review-required"}`); next = resized.project;
  }
  if (result.selection?.kind === "transition" && (input.sourceLevelId || input.targetLevelId || input.connectedLevelIds || input.transitionStyle || input.direction !== undefined || input.sameLevelRise !== undefined)) {
    const updated = updateTransitionDetails(next, result.selection.id, { sourceLevelId: input.sourceLevelId, targetLevelId: input.targetLevelId, connectedLevelIds: input.connectedLevelIds, style: input.transitionStyle, direction: input.direction, sameLevelRise: input.sameLevelRise });
    if (updated.state === "blocked") throw new Error(`transition-details:${updated.reason}`); next = updated.state === "review-required" ? updated.accept() : updated.project;
  }
  const reference = result.selection ? `${result.selection.kind}:${result.selection.id}` : input.layerId;
  return { project: next, summary: `Utworzono ${input.name ?? input.subjectId}.`, effects: [`created:${reference}`] };
}
