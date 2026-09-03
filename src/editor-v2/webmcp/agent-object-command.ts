import { duplicateSelectedElements, mergeSelectedElementRegions, transformSelectedElements } from "../drawing/element-transformations";
import { moveSelectionGroup } from "../drawing/group-selection-operations";
import { duplicateSelectedPlaces, mergeSelectedPlaces, transformSelectedPlaces } from "../drawing/place-transformations";
import { mergeSelectedRooms } from "../drawing/room-merge-operation";
import { duplicateSelectedRooms, transformSelectedRooms } from "../drawing/room-transformations";
import { deleteSelection, moveWallEndpoint, type EditableSelection, type SelectionOperationResult } from "../drawing/selection-operations";
import { resizeElementRegion, updateElementDetails, updateOpeningWidth, updateRoomName, updateTransitionDetails, updateSelectionState } from "../drawing/selection-detail-operations";
import { resizePlaceBoundary } from "../drawing/place-boundary-operations";
import { cutRegionFromSelection } from "../drawing/cutout-operation";
import { duplicateSelectedConstructionSurfaces, mergeSelectedConstructionSurfaces, resizeConstructionSurface, transformConstructionSurface, updateConstructionSurface } from "../drawing/construction-surface-operations";
import { rotateSelection } from "../drawing/selection-rotation";
import { deletePlaceSubtree, reparentPlace, updatePlaceDetails } from "../model/hierarchy-operations";
import type { EditorProject, RegionShape } from "../model/project-model";
import type { ResizeCorner } from "../geometry/region-resize";
import type { KernelPoint } from "../geometry/geometry-types";
import type { AgentLocale, AgentMetadata, AgentObjectRef, AgentTransformation, AgentTransitionDetails } from "./agent-command-types";
import type { PreparedChange } from "./editor-command-coordinator";
import { agentObjectScope } from "./agent-object-scope";
import { assertAgentEditableTarget } from "./agent-change-policy";

const identity = (locale: AgentLocale) => ({ createId: () => crypto.randomUUID(), createRoomName: (index: number) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` });
const copyName = (name: string, locale: AgentLocale) => `${name} — ${locale === "pl" ? "kopia" : "copy"}`;
const editable = (refs: AgentObjectRef[]): EditableSelection[] => refs.map(({ type, id, scopeId }) => ({ kind: type, id, ...(scopeId ? { scopeId } : {}) }));

function prepared(result: SelectionOperationResult, summary: string): PreparedChange {
  if (result.state === "blocked") throw new Error(result.reason);
  if (result.state === "review-required") return { project: result.accept(), summary, effects: result.effects };
  return { project: result.project, summary };
}

export function buildMetadataChange(project: EditorProject, activePlaceId: string, input: { ref: AgentObjectRef; metadata: AgentMetadata; ownerId?: string; openingWidth?: number; transitionDetails?: AgentTransitionDetails }, locale: AgentLocale = "en") {
  activePlaceId = agentObjectScope(project, activePlaceId, [input.ref]);
  const { ref, metadata } = input; let next = project;
  const editsDetails = Object.entries(metadata).some(([key, value]) => key !== "locked" && value !== undefined)
    || input.ownerId !== undefined || input.openingWidth !== undefined || Object.values(input.transitionDetails ?? {}).some((value) => value !== undefined);
  if (editsDetails) assertAgentEditableTarget(project, { kind: ref.type, id: ref.id, scopeId: ref.scopeId });
  const state = { ...(metadata.visible !== undefined ? { visible: metadata.visible } : {}), ...(metadata.locked !== undefined ? { locked: metadata.locked } : {}) };
  if (Object.keys(state).length) next = updateSelectionState(next, { kind: ref.type, id: ref.id, scopeId: ref.scopeId }, state);
  const details = { ...metadata };
  delete details.visible;
  delete details.locked;
  if (ref.type === "place") {
    if (Object.keys(details).length) next = updatePlaceDetails(next, ref.id, details);
    if (input.ownerId !== undefined) next = reparentPlace(next, ref.id, input.ownerId || undefined);
  } else if (ref.type === "room") {
    if (details.name) next = updateRoomName(next, activePlaceId, ref.id, details.name);
    const roomDetails = {
      ...(details.description !== undefined ? { description: details.description } : {}),
      ...(details.tags !== undefined ? { tags: details.tags } : {}),
      ...(details.appearance !== undefined ? { appearance: details.appearance } : {}),
    };
    if (Object.keys(roomDetails).length) next = updatePlaceDetails(next, ref.id, roomDetails);
  } else if (ref.type === "element") {
    if (Object.keys(details).length || input.ownerId !== undefined) next = updateElementDetails(next, ref.id, { ...details, belongsToId: input.ownerId });
  } else if (ref.type === "surface") {
    if (Object.keys(details).length || input.ownerId !== undefined) next = updateConstructionSurface(next, ref.id, { ...details, ...(input.ownerId !== undefined ? { belongsToId: input.ownerId } : {}) });
  } else if (ref.type === "opening" && input.openingWidth !== undefined) {
    const result = updateOpeningWidth(next, activePlaceId, ref.id, input.openingWidth, ref.scopeId);
    if (result.state !== "applied") throw new Error(result.state === "blocked" ? result.reason : "review-required"); next = result.project;
  } else if (ref.type === "transition" && input.transitionDetails) {
    const result = updateTransitionDetails(next, ref.id, input.transitionDetails, ref.scopeId);
    if (result.state !== "applied") throw new Error(result.state === "blocked" ? result.reason : "review-required"); next = result.project;
  } else if (Object.keys(details).length || !Object.keys(state).length) throw new Error("metadata-is-not-supported-for-object");
  return { project: next, summary: locale === "pl" ? `Zmieniono właściwości ${ref.type}:${ref.id}.` : `Changed properties of ${ref.type}:${ref.id}.`, effects: [`updated:${ref.type}:${ref.id}`] };
}

function transformMirror(project: EditorProject, activePlaceId: string, refs: AgentObjectRef[], transformation: Extract<AgentTransformation, { kind: "mirror" }>, boundaryEditing: boolean, locale: AgentLocale) {
  const commandIdentity = identity(locale);
  let next = project;
  const elements = refs.filter(({ type }) => type === "element").map(({ id }) => id);
  const places = refs.filter(({ type }) => type === "place").map(({ id }) => id);
  const rooms = refs.filter(({ type }) => type === "room").map(({ id }) => id);
  const surfaces = refs.filter(({ type }) => type === "surface").map(({ id }) => id);
  if (elements.length) { const result = transformSelectedElements(next, elements, transformation); if (result.state === "blocked") throw new Error(result.reason); next = result.project; }
  if (places.length) { const result = transformSelectedPlaces(next, places, transformation); if (result.state === "blocked") throw new Error(result.reason); next = result.project; }
  if (rooms.length) { const result = transformSelectedRooms(next, activePlaceId, rooms, transformation, boundaryEditing, commandIdentity); if (result.state === "blocked") throw new Error(result.reason); next = result.project; }
  if (surfaces.length) for (const id of surfaces) { const result = transformConstructionSurface(next, id, transformation); if (result.state === "blocked") throw new Error(result.reason); next = result.project; }
  if (elements.length + places.length + rooms.length + surfaces.length !== refs.length) throw new Error("transformation-is-not-supported-for-object");
  return next;
}

export function buildTransformChange(project: EditorProject, activePlaceId: string, refs: AgentObjectRef[], transformation: AgentTransformation, boundaryEditing = false, locale: AgentLocale = "en") {
  activePlaceId = agentObjectScope(project, activePlaceId, refs);
  if (!refs.length) throw new Error("no-objects-selected");
  const commandIdentity = identity(locale);
  const next = transformation.kind === "move"
    ? prepared(moveSelectionGroup(project, { activePlaceId, selections: editable(refs), delta: { x: transformation.dx, y: transformation.dy }, boundaryEditing }, commandIdentity), locale === "pl" ? "Przesunięto obiekty." : "Moved objects.").project
    : transformation.kind === "rotate"
      ? (() => { const result = rotateSelection(project, activePlaceId, editable(refs), transformation.degrees, commandIdentity, boundaryEditing); if (result.state === "blocked") throw new Error(result.reason); return result.project; })()
      : transformMirror(project, activePlaceId, refs, transformation, boundaryEditing, locale);
  const action = transformation.kind === "move" ? (locale === "pl" ? "Przesunięto" : "Moved") : transformation.kind === "rotate" ? (locale === "pl" ? "Obrócono" : "Rotated") : (locale === "pl" ? "Odbito lustrzanie" : "Mirrored");
  return { project: next, summary: `${action} ${refs.length} ${locale === "pl" ? "obiektów" : "objects"}.`, effects: refs.map((ref) => `transformed:${ref.type}:${ref.id}`) };
}

export function buildDuplicateChange(project: EditorProject, activePlaceId: string, refs: AgentObjectRef[], locale: AgentLocale = "en") {
  activePlaceId = agentObjectScope(project, activePlaceId, refs);
  const commandIdentity = identity(locale); const nameCopy = (name: string) => copyName(name, locale);
  let next = project; const created: string[] = [];
  const elements = refs.filter(({ type }) => type === "element").map(({ id }) => id);
  const places = refs.filter(({ type }) => type === "place").map(({ id }) => id);
  const rooms = refs.filter(({ type }) => type === "room").map(({ id }) => id);
  const surfaces = refs.filter(({ type }) => type === "surface").map(({ id }) => id);
  if (elements.length) { const result = duplicateSelectedElements(next, elements, commandIdentity.createId, nameCopy); if (result.state === "blocked") throw new Error(result.reason); next = result.project; created.push(...result.selectedIds); }
  if (places.length) { const result = duplicateSelectedPlaces(next, places, commandIdentity, nameCopy); if (result.state === "blocked") throw new Error(result.reason); next = result.project; created.push(...result.selectedIds); }
  if (rooms.length) { const result = duplicateSelectedRooms(next, activePlaceId, rooms, commandIdentity); if (result.state === "blocked") throw new Error(result.reason); next = result.project; created.push(...result.selectedIds); }
  if (surfaces.length) { const result = duplicateSelectedConstructionSurfaces(next, surfaces, commandIdentity.createId, nameCopy); if (result.state === "blocked") throw new Error(result.reason); next = result.project; created.push(...result.selectedIds); }
  if (elements.length + places.length + rooms.length + surfaces.length !== refs.length) throw new Error("duplication-is-not-supported-for-object");
  return { project: next, summary: locale === "pl" ? `Powielono ${refs.length} obiektów.` : `Duplicated ${refs.length} objects.`, effects: created.map((id) => `created:${id}`) };
}

export function buildMergeChange(project: EditorProject, activePlaceId: string, refs: AgentObjectRef[], mode: "outer-only" | "keep-partitions" = "outer-only", locale: AgentLocale = "en") {
  activePlaceId = agentObjectScope(project, activePlaceId, refs);
  const types = new Set(refs.map(({ type }) => type)); if (refs.length < 2 || types.size !== 1) throw new Error("merge-needs-two-objects-of-one-type");
  const ids = refs.map(({ id }) => id); const type = refs[0].type; const commandIdentity = identity(locale);
  const result = type === "element" ? mergeSelectedElementRegions(project, ids)
    : type === "place" ? mergeSelectedPlaces(project, ids, mode, commandIdentity)
      : type === "room" ? mergeSelectedRooms(project, activePlaceId, ids, commandIdentity)
        : type === "surface" ? mergeSelectedConstructionSurfaces(project, ids) : undefined;
  if (!result || result.state === "blocked") throw new Error(result?.reason ?? "merge-is-not-supported-for-object");
  return { project: result.project, summary: locale === "pl" ? `Scalono ${ids.length} obiektów.` : `Merged ${ids.length} objects.`, effects: [`merged:${type}:${ids.join(",")}`] };
}

export function buildDeleteChange(project: EditorProject, activePlaceId: string, refs: AgentObjectRef[], boundaryEditing = false, locale: AgentLocale = "en") {
  activePlaceId = agentObjectScope(project, activePlaceId, refs);
  let next = project; const placeRefs = refs.filter(({ type }) => type === "place"); const commandIdentity = identity(locale);
  for (const ref of refs.filter(({ type }) => type !== "place")) next = prepared(deleteSelection(next, { activePlaceId, selection: { kind: ref.type, id: ref.id, ...(ref.scopeId ? { scopeId: ref.scopeId } : {}) }, boundaryEditing }, commandIdentity), locale === "pl" ? "Usunięto obiekt." : "Deleted object.").project;
  for (const ref of placeRefs) if (next.places.some(({ id }) => id === ref.id)) next = deletePlaceSubtree(next, ref.id);
  return { project: next, summary: locale === "pl" ? `Usunięto ${refs.length} obiektów wraz z ich zawartością.` : `Deleted ${refs.length} objects and their contents.`, effects: refs.map((ref) => `deleted:${ref.type}:${ref.id}`) };
}

export function buildResizeChange(project: EditorProject, activePlaceId: string, input: { ref: AgentObjectRef; corner?: ResizeCorner; point?: KernelPoint; openingWidth?: number }, locale: AgentLocale = "en") {
  activePlaceId = agentObjectScope(project, activePlaceId, [input.ref]);
  const result = input.ref.type === "element" && input.corner && input.point ? resizeElementRegion(project, input.ref.id, input.corner, input.point)
    : input.ref.type === "place" && input.corner && input.point ? resizePlaceBoundary(project, input.ref.id, input.corner, input.point)
      : input.ref.type === "surface" && input.corner && input.point ? resizeConstructionSurface(project, input.ref.id, input.corner, input.point)
        : input.ref.type === "opening" && input.openingWidth !== undefined ? updateOpeningWidth(project, activePlaceId, input.ref.id, input.openingWidth, input.ref.scopeId) : undefined;
  if (!result) throw new Error("resize-parameters-do-not-match-object");
  return prepared(result, locale === "pl" ? `Zmieniono rozmiar ${input.ref.type}:${input.ref.id}.` : `Resized ${input.ref.type}:${input.ref.id}.`);
}

export function buildWallEndpointChange(project: EditorProject, activePlaceId: string, input: { wallId: string; scopeId?: string; endpoint: "start" | "end"; point: KernelPoint; boundaryEditing?: boolean }, locale: AgentLocale = "en") {
  return prepared(moveWallEndpoint(project, { activePlaceId, wallId: input.wallId, scopeId: input.scopeId, endpoint: input.endpoint, point: input.point, boundaryEditing: input.boundaryEditing ?? false }, identity(locale)), locale === "pl" ? `Przesunięto koniec ściany ${input.wallId}.` : `Moved wall endpoint ${input.wallId}.`);
}

export function buildCutoutChange(project: EditorProject, activePlaceId: string, target: { kind: "element" | "surface" | "place"; id: string }, shape: RegionShape, locale: AgentLocale = "en") {
  const result = cutRegionFromSelection(project, activePlaceId, target, shape, identity(locale));
  if (result.state === "blocked") throw new Error(result.reason);
  return { project: result.project, summary: locale === "pl" ? `Wycięto pustkę w ${target.kind}:${target.id}.` : `Cut out a void in ${target.kind}:${target.id}.`, effects: [`cutout:${target.kind}:${target.id}`] };
}
