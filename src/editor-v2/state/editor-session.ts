import { clearConstructionLayer, type ConstructionClearCategory } from "./clear-construction-layer";
import { activateLayer, chooseInstrument, chooseSubject, createToolboxState, type ToolboxState } from "../toolbox/toolbox-state";
import type { InstrumentId, WorkLayerId } from "../toolbox/toolbox-model";
import { normalizeEditorProject, type EditorProject } from "../model/project-model";
import { deletePlaceSubtree } from "../model/hierarchy-operations";
import { repairProjectConstructions } from "../model/construction-repair";
import { visibleLayerId } from "../toolbox/toolbox-model";
import { immutableSnapshot } from "./immutable-snapshot";
import { prepareProjectTransaction, type PreparedProjectTransaction, type ProjectTransaction } from "./project-transaction";
import { reconcileSessionNavigation } from "../model/navigation-fallback";
export type { PreparedProjectTransaction, ProjectTransaction } from "./project-transaction";

/** The only selectable things exposed by the editor session. */
export type EditorSelection =
  | { kind: "place"; id: string }
  | { kind: "element"; id: string }
  | { kind: "wall"; id: string; constructionId: string }
  | { kind: "room"; id: string; constructionId: string };

export type PendingStructuralTransaction = {
  id: string;
  constructionId: string;
  beforeRevision: number;
};

type SessionResultCode =
  | "committed"
  | "no-change"
  | "history-empty"
  | "place-not-found"
  | "navigation-blocked-pending-structural"
  | "selection-target-not-found"
  | "nothing-to-clear"
  | "construction-not-found"
  | "review-required"
  | "transaction-failed" | "road-obstacle";

export type SessionResult<T = undefined> = {
  code: SessionResultCode;
  changed: boolean;
  value?: T;
  reason?: string;
};

export type EditorSessionState = {
  project: EditorProject;
  activePlaceId?: string;
  selection: readonly EditorSelection[];
  boundaryEditing: boolean;
  toolbox: ToolboxState;
  pendingStructuralTransaction?: PendingStructuralTransaction;
  roadConflict?: boolean;
};

export type EditorSessionOptions = {
  createId?: () => string;
  createRoomName?: (index: number) => string;
  initialPlaceId?: string;
  initialToolbox?: ToolboxState;
};

type History = {
  past: EditorProject[];
  future: EditorProject[];
};

const clone = <T>(value: T): T => structuredClone(value);
function constructionFor(project: EditorProject, constructionId: string) {
  return project.constructions.find(({ id }) => id === constructionId);
}

function activePlace(project: EditorProject, id: string | undefined) {
  return id ? project.places.find((place) => place.id === id) : undefined;
}

function hasSelectionTarget(project: EditorProject, selection: EditorSelection) {
  if (selection.kind === "place") return project.places.some(({ id }) => id === selection.id);
  if (selection.kind === "element") return project.elements.some(({ id }) => id === selection.id);
  const construction = constructionFor(project, selection.constructionId);
  if (!construction) return false;
  return selection.kind === "wall"
    ? construction.walls.some(({ id }) => id === selection.id)
    : construction.rooms.some(({ id }) => id === selection.id);
}

/** The visible Construction tab owns all structural subcategories, including legacy openings. */
export function normalizedClearLayer(layerId: WorkLayerId) {
  return visibleLayerId(layerId);
}

export class EditorSession {
  private readonly history: History = { past: [], future: [] };
  private readonly preparedTransactions = new WeakSet<PreparedProjectTransaction>();
  private readonly createId: () => string;
  private readonly createRoomName: (index: number) => string;
  private state: EditorSessionState;
  private viewState?: { source: EditorSessionState; value: EditorSessionState };

  constructor(project: EditorProject, options: EditorSessionOptions = {}) {
    if (options.initialPlaceId && !activePlace(project, options.initialPlaceId)) throw new Error("initial-place-not-found");
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.createRoomName = options.createRoomName ?? ((index) => `room-${index}`);
    this.state = {
      project: immutableSnapshot(repairProjectConstructions(normalizeEditorProject(project), { createId: this.createId, createName: this.createRoomName })),
      activePlaceId: options.initialPlaceId,
      selection: [],
      boundaryEditing: false,
      toolbox: clone(options.initialToolbox ?? createToolboxState()),
    };
  }

  getState(): EditorSessionState {
    return clone(this.state);
  }

  /** Stable, deeply immutable UI read. getState remains an isolated editable copy. */
  getViewState(): EditorSessionState {
    if (this.viewState?.source !== this.state) {
      const { project, ...view } = this.state;
      this.viewState = { source: this.state, value: Object.freeze({ ...immutableSnapshot(view), project }) };
    }
    return this.viewState.value;
  }

  getHistoryState() {
    return { canUndo: this.history.past.length > 0, canRedo: this.history.future.length > 0 };
  }

  openPlace(placeId: string): SessionResult {
    if (!activePlace(this.state.project, placeId)) return { code: "place-not-found", changed: false };
    if (this.state.pendingStructuralTransaction && this.state.activePlaceId !== placeId) {
      return { code: "navigation-blocked-pending-structural", changed: false };
    }
    this.state = { ...this.state, activePlaceId: placeId, selection: [], boundaryEditing: false };
    return { code: "committed", changed: true };
  }

  setSelection(selection: readonly EditorSelection[]): SessionResult {
    if (selection.some((item) => !hasSelectionTarget(this.state.project, item))) {
      return { code: "selection-target-not-found", changed: false };
    }
    this.state = { ...this.state, selection: clone(selection) };
    return { code: "committed", changed: true };
  }

  setBoundaryEditing(enabled: boolean) {
    this.state = { ...this.state, boundaryEditing: enabled };
  }

  setPendingStructuralTransaction(pending: PendingStructuralTransaction | undefined) {
    this.state = { ...this.state, pendingStructuralTransaction: pending ? clone(pending) : undefined };
  }

  setToolbox(toolbox: ToolboxState) {
    this.state = { ...this.state, toolbox: clone(toolbox) };
  }

  activateLayer(layerId: WorkLayerId) {
    this.state = { ...this.state, toolbox: activateLayer(this.state.toolbox, layerId) };
  }

  chooseSubject(subjectId: string) {
    this.state = { ...this.state, toolbox: chooseSubject(this.state.toolbox, subjectId) };
  }

  chooseInstrument(instrumentId: InstrumentId) {
    this.state = { ...this.state, toolbox: chooseInstrument(this.state.toolbox, instrumentId) };
  }

  dismissRoadConflict() { this.state = { ...this.state, roadConflict: undefined }; }

  prepareTransaction(transaction: ProjectTransaction): PreparedProjectTransaction {
    const prepared = prepareProjectTransaction(this.state.project, transaction, { createId: this.createId, createRoomName: this.createRoomName });
    this.preparedTransactions.add(prepared);
    return prepared;
  }

  commitPreparedTransaction(prepared: PreparedProjectTransaction): SessionResult {
    if (!this.preparedTransactions.delete(prepared)) return { code: "transaction-failed", changed: false, reason: "transaction-untrusted" };
    if (prepared.before !== this.state.project) return { code: "transaction-failed", changed: false, reason: "transaction-stale" };
    if (prepared.status === "blocked") {
      if (prepared.code === "road-obstacle") this.state = { ...this.state, roadConflict: true };
      return { code: prepared.code, changed: false, ...(prepared.reason ? { reason: prepared.reason } : {}) };
    }
    this.state = { ...this.state, roadConflict: undefined };
    if (prepared.status === "no-change") return { code: "no-change", changed: false };
    this.history.past.push(this.state.project);
    this.history.future = [];
    this.installProject(prepared.project);
    return { code: "committed", changed: true };
  }

  executeTransaction(transaction: ProjectTransaction): SessionResult {
    return this.commitPreparedTransaction(this.prepareTransaction(transaction));
  }

  clearCurrentLayer(layerId: WorkLayerId = this.state.toolbox.activeLayerId, category: ConstructionClearCategory = "all"): SessionResult {
    layerId = normalizedClearLayer(layerId);
    const ownerId = this.state.activePlaceId;
    if (!ownerId || !activePlace(this.state.project, ownerId)) return { code: "place-not-found", changed: false };

    if (layerId === "terrain" || layerId === "roads" || layerId === "equipment" || layerId === "sketch") {
      const clearable = this.state.project.elements.some((element) => !element.locked && element.belongsToId === ownerId && element.layerId === layerId);
      if (!clearable) return { code: "nothing-to-clear", changed: false };
      return this.executeTransaction({
        id: `clear:${layerId}:${ownerId}`,
        apply: (project) => ({ ...project, elements: project.elements.filter((element) => element.locked || !(element.belongsToId === ownerId && element.layerId === layerId)) }),
      });
    }

    if (layerId === "buildings" || layerId === "boundaries") {
      const kinds = layerId === "buildings" ? new Set(["building"]) : new Set(["location"]);
      const ids = this.state.project.places.filter(({ parentId, kind, locked }) => !locked && parentId === ownerId && kinds.has(kind)).map(({ id }) => id);
      if (!ids.length) return { code: "nothing-to-clear", changed: false };
      return this.executeTransaction({ id: `clear:${layerId}:${ownerId}`, apply: (project) => ids.reduce((next, id) => next.places.some((place) => place.id === id) ? deletePlaceSubtree(next, id) : next, project) });
    }

    if (layerId !== "construction") return { code: "nothing-to-clear", changed: false };
    const next = clearConstructionLayer(this.state.project, ownerId, { createId: this.createId, createName: this.createRoomName }, category);
    if (next === this.state.project) return { code: "nothing-to-clear", changed: false };
    return this.executeTransaction({ id: `clear:construction:${category}:${ownerId}`, apply: () => next });
  }

  undo(): SessionResult {
    const previous = this.history.past.pop();
    if (!previous) return { code: "history-empty", changed: false };
    this.history.future.push(this.state.project);
    this.installProject(previous);
    return { code: "committed", changed: true };
  }

  redo(): SessionResult {
    const next = this.history.future.pop();
    if (!next) return { code: "history-empty", changed: false };
    this.history.past.push(this.state.project);
    this.installProject(next);
    return { code: "committed", changed: true };
  }

  /** Installs a canonical document and keeps session navigation valid across snapshots. */
  private installProject(project: EditorProject) {
    const navigation = reconcileSessionNavigation(this.state.project, project, {
      activePlaceId: this.state.activePlaceId,
      selection: this.state.selection,
      boundaryEditing: this.state.boundaryEditing,
    });
    this.state = { ...this.state, project, ...navigation };
  }
}
