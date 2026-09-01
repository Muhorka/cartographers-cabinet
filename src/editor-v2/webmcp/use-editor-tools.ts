"use client";
import { useEffect, useRef, useState } from "react";
import type { EditorSession } from "../state/editor-session";
import type { ProjectCheckpoint, ProjectCheckpointSummary } from "../persistence/project-checkpoint";
import { readProjectCheckpoint } from "../persistence/project-library";
import type { AgentObjectRef } from "./agent-command-types";
import type { EditorProject } from "../model/project-model";
import type { StartingScale } from "../model/starter-project";
import { registerEditorV2Tools } from "./register-editor-tools";
import { reportWebMcpDiagnostics } from "./diagnostics";
import type { EditorLiveContext, EditorStoryView, StoryViewUpdateResult } from "./editor-context";
import type { CommandBridge } from "./editor-command-coordinator";

export function useEditorV2Tools(session: EditorSession | undefined, activePlaceId: string | undefined, actions: {
  getEditorContext?(): EditorLiveContext; setStoryView?(view: EditorStoryView): StoryViewUpdateResult | void;
  preserveAgentChange?: CommandBridge["preserveAgentChange"]; reportAgentChange?: CommandBridge["reportAgentChange"];
  refresh(): void; openPlace(placeId: string): boolean; focusObjects(refs: AgentObjectRef[]): boolean | void; clearFocus(): void;
  getCheckpoints(): ProjectCheckpointSummary[]; createCheckpoint(name: string): Promise<ProjectCheckpoint | undefined>;
  deleteCheckpoint(checkpointId: string): Promise<boolean>;
  showCheckpoint(checkpointId: string | undefined, opacity?: number): boolean;
  getProjects(): EditorProject[]; createProject(name: string, scale: StartingScale): Promise<EditorProject | undefined>;
  openProject(id: string): Promise<boolean>; duplicateProject(id: string): Promise<EditorProject | undefined>;
  renameProject(id: string, name: string): Promise<EditorProject | undefined>; deleteProject(id: string): Promise<boolean>;
}) {
  const sessionRef = useRef(session); const activePlaceRef = useRef(activePlaceId); const actionsRef = useRef(actions);
  const [diagnosticAttempt, setDiagnosticAttempt] = useState(0);
  useEffect(() => { const retry = () => setDiagnosticAttempt((attempt) => attempt + 1); window.addEventListener("cartographer-webmcp-retry", retry); return () => window.removeEventListener("cartographer-webmcp-retry", retry); }, []);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { activePlaceRef.current = activePlaceId; }, [activePlaceId]);
  useEffect(() => { actionsRef.current = actions; }, [actions]);
  useEffect(() => {
    reportWebMcpDiagnostics({ state: "checking", registered: 0, total: 0, errors: [] });
    let active = true; let attempts = 0; let retry: ReturnType<typeof setTimeout> | undefined; let dispose: () => void = () => undefined;
    const register = () => registerEditorV2Tools({
      getEditorContext: () => actionsRef.current.getEditorContext?.() ?? { selections: [], mode: "drawing", view: {} },
      setStoryView: (view) => actionsRef.current.setStoryView?.(view),
      preserveAgentChange: (before, after, summary, kind) => actionsRef.current.preserveAgentChange?.(before, after, summary, kind) ?? Promise.resolve(undefined),
      reportAgentChange: (change) => actionsRef.current.reportAgentChange?.(change),
      getSession: () => { if (!sessionRef.current) throw new Error("No editor session is open yet."); return sessionRef.current; },
      getProject: () => { if (!sessionRef.current) throw new Error("No project is open yet."); return sessionRef.current.getState().project; },
      getActivePlaceId: () => { if (!activePlaceRef.current) throw new Error("No map is open yet."); return activePlaceRef.current; },
      refresh: () => actionsRef.current.refresh(), openPlace: (placeId) => actionsRef.current.openPlace(placeId),
      focusObjects: (refs) => actionsRef.current.focusObjects(refs), clearFocus: () => actionsRef.current.clearFocus(),
      getCheckpoints: () => actionsRef.current.getCheckpoints(), createCheckpoint: (name) => actionsRef.current.createCheckpoint(name),
      getCheckpoint: (id) => { if (!sessionRef.current) return Promise.resolve(undefined); return readProjectCheckpoint(id, sessionRef.current.getViewState().project.id); },
      deleteCheckpoint: (checkpointId) => actionsRef.current.deleteCheckpoint(checkpointId),
      showCheckpoint: (checkpointId, opacity) => actionsRef.current.showCheckpoint(checkpointId, opacity),
      getProjects: () => actionsRef.current.getProjects(), createProject: (name, scale) => actionsRef.current.createProject(name, scale), openProject: (id) => actionsRef.current.openProject(id),
      duplicateProject: (id) => actionsRef.current.duplicateProject(id), renameProject: (id, name) => actionsRef.current.renameProject(id, name), deleteProject: (id) => actionsRef.current.deleteProject(id),
    }).then((registration) => {
      if (!active) { registration.dispose(); return; }
      dispose(); attempts += 1;
      if (registration.available) dispose = registration.dispose;
      else { registration.dispose(); dispose = () => undefined; if (attempts < 12) retry = setTimeout(register, 250); }
    }).catch((error: unknown) => { if (!active) return; reportWebMcpDiagnostics({ state: "error", registered: 0, total: 0, errors: [error instanceof Error ? error.message : String(error)] }); attempts += 1; if (attempts < 12) retry = setTimeout(register, 250); });
    void register();
    return () => { active = false; if (retry) clearTimeout(retry); dispose(); };
  }, [diagnosticAttempt]);
}
