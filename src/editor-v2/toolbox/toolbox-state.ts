import { availableInstruments, getWorkLayer, workLayers, type InstrumentId, type WorkLayerId } from "./toolbox-model";

type LayerMemory = { subjectId: string; instrumentId: InstrumentId; lastRegionInstrumentId?: InstrumentId; widthMeters?: number };
const regionInstruments: readonly InstrumentId[] = ["pencil", "pen", "rectangle", "circle", "ellipse", "arc", "polygon"];

export type ToolboxState = {
  activeLayerId: WorkLayerId;
  byLayer: Record<WorkLayerId, LayerMemory>;
};

function defaultInstrument(layerId: WorkLayerId, subjectId: string) {
  const layer = getWorkLayer(layerId); const subject = layer.subjects.find(({ id }) => id === subjectId);
  return subject?.defaultInstrumentId ?? layer.defaultInstrumentId;
}

export function createToolboxState(activeLayerId: WorkLayerId = "terrain"): ToolboxState {
  const byLayer = Object.fromEntries(workLayers.map(({ id: layerId }) => {
    const subjectId = getWorkLayer(layerId).defaultSubjectId;
    return [layerId, { subjectId, instrumentId: defaultInstrument(layerId, subjectId) }];
  })) as Record<WorkLayerId, LayerMemory>;
  return { activeLayerId, byLayer };
}

export function activateLayer(state: ToolboxState, layerId: WorkLayerId): ToolboxState {
  if (state.activeLayerId === layerId) return state;
  const previousInstrument = state.byLayer[state.activeLayerId].instrumentId; const target = state.byLayer[layerId];
  const instrumentId = availableInstruments(layerId, target.subjectId).includes(previousInstrument) ? previousInstrument : target.instrumentId;
  return { ...state, activeLayerId: layerId, byLayer: { ...state.byLayer, [layerId]: { ...target, instrumentId, lastRegionInstrumentId: regionInstruments.includes(instrumentId) ? instrumentId : target.lastRegionInstrumentId } } };
}

export function chooseSubject(state: ToolboxState, subjectId: string): ToolboxState {
  const layerId = state.activeLayerId;
  const layer = getWorkLayer(layerId);
  if (!layer.subjects.some((subject) => subject.id === subjectId)) throw new Error(`${subjectId} is not available in ${layerId}`);
  const previous = state.byLayer[layerId];
  const instruments = availableInstruments(layerId, subjectId);
  const instrumentId = instruments.includes(previous.instrumentId) ? previous.instrumentId : defaultInstrument(layerId, subjectId);
  return { ...state, byLayer: { ...state.byLayer, [layerId]: { ...previous, subjectId, instrumentId } } };
}

export function chooseInstrument(state: ToolboxState, instrumentId: InstrumentId): ToolboxState {
  const layerId = state.activeLayerId;
  const current = state.byLayer[layerId];
  if (!availableInstruments(layerId, current.subjectId).includes(instrumentId)) throw new Error(`${instrumentId} is not available for ${current.subjectId}`);
  return { ...state, byLayer: { ...state.byLayer, [layerId]: { ...current, instrumentId, lastRegionInstrumentId: regionInstruments.includes(instrumentId) ? instrumentId : current.lastRegionInstrumentId } } };
}

export const outlineInstruments: readonly InstrumentId[] = ["select", "marquee", ...regionInstruments];

/** Geometry editing has its own instruments; it must not corrupt the remembered
 * creation tool (e.g. placing windows) or depend on that subject's tool list. */
export function outlineInstrumentFor(state: ToolboxState, remembered?: InstrumentId): InstrumentId {
  const memory = state.byLayer[state.activeLayerId];
  if (regionInstruments.includes(memory.instrumentId)) return memory.instrumentId;
  if (remembered && outlineInstruments.includes(remembered)) return remembered;
  return memory.lastRegionInstrumentId ?? "rectangle";
}
