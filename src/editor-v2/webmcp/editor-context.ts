import type { EditorSession } from "../state/editor-session";
import type { AgentObjectRef } from "./agent-command-types";
import { projectRevision, valueRevision } from "../state/project-revision";
import { inspectProjectObject } from "./project-read-model";
import type { EditorProject } from "../model/project-model";

export type EditorStoryView = { scenarioId?: string; stepId?: string; lensId?: string; routeId?: string; editTarget?: "base" | "scenario" };
export type StoryViewUpdateResult = { status: "applied" } | { status: "deferred"; reason: "draft" | "overlap" };
export type EditorLiveContext = { selections: AgentObjectRef[]; mode: "drawing" | "story"; view: EditorStoryView };
export type EditorContextBridge = {
  getSession(): EditorSession;
  getEditorContext?(): EditorLiveContext;
  setStoryView?(view: EditorStoryView): StoryViewUpdateResult | void;
};

export function scopedSelectionRefs(project: EditorProject, selections: { kind: AgentObjectRef["type"]; id: string }[], activePlaceId?: string): AgentObjectRef[] {
  const active = project.places.find(({ id }) => id === activePlaceId);
  return selections.map(({ kind, id }) => {
    const matches = inspectProjectObject(project, { type: kind, id });
    const chosen = matches.length === 1 ? matches[0] : matches.find(({ ref }) => ref.scopeId === activePlaceId || ref.scopeId === active?.parentId);
    return chosen?.ref ?? { type: kind, id };
  });
}

export function inspectEditorContext(bridge: EditorContextBridge) {
  const state = bridge.getSession().getState();
  const live = bridge.getEditorContext?.() ?? { selections: [], mode: "drawing" as const, view: {} };
  const context = { ...live, projectId: state.project.id, activePlaceId: state.activePlaceId, toolbox: state.toolbox, boundaryEditing: state.boundaryEditing };
  return { ...context, contextVersion: valueRevision(context), projectRevision: projectRevision(state.project),
    selectedObjects: live.selections.flatMap((ref) => inspectProjectObject(state.project, ref)),
    selectionAvailable: Boolean(bridge.getEditorContext),
  };
}
