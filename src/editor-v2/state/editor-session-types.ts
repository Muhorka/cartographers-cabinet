import type { EditorProject } from "../model/project-model";
import type { ToolboxState } from "../toolbox/toolbox-state";

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
  /** Maximum number of undo/redo snapshots retained per direction. */
  historyLimit?: number;
};
