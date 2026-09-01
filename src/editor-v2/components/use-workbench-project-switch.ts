"use client";
import { useEffect, useRef } from "react";
import type { EditorProject } from "../model/project-model";
import type { EditorSession } from "../state/editor-session";
import { readProjectCheckpoint, setPreference } from "../persistence/project-library";
import { assertProposalCurrent, restoreCheckpointSnapshot } from "../persistence/project-checkpoint";
import { restoreWorkbenchProject } from "./workbench-project-loading";
import { checkpointCopy } from "../i18n/checkpoint-copy";
import type { useProjectAutosave } from "./use-project-autosave";

type Autosave = ReturnType<typeof useProjectAutosave>;
export function useWorkbenchProjectSwitch(input: {
  session?: EditorSession; locale: "pl" | "en"; autosave: Autosave;
  install(loaded: Awaited<ReturnType<typeof restoreWorkbenchProject>>): void;
  onError(message: string | undefined): void;
}) {
  const liveSession = useRef(input.session); const generation = useRef(0);
  useEffect(() => { liveSession.current = input.session; }, [input.session]);
  useEffect(() => () => { generation.current += 1; }, []);
  async function loadProject(project: EditorProject) {
    input.onError(undefined);
    const request = ++generation.current; const source = liveSession.current;
    try {
      if (source && !await input.autosave.flushSession(source)) return false;
      if (request !== generation.current || liveSession.current !== source) return false;
      if (source?.getViewState().project.id === project.id) return true;
      const loaded = await restoreWorkbenchProject(input.autosave.latest(project.id) ?? project, input.locale);
      if (source && !await input.autosave.flushSession(source)) return false;
      if (request !== generation.current || liveSession.current !== source) return false;
      liveSession.current = loaded.session; input.install(loaded);
      void setPreference("activeProjectId", project.id).catch((error) => input.onError(String(error)));
      return true;
    } catch (error) { if (request === generation.current) input.onError(String(error)); return false; }
  }
  async function restoreCheckpoint(id: string, preserveSafety: (before: EditorProject, after: EditorProject) => Promise<string | undefined>) {
    input.onError(undefined);
    const session = liveSession.current; if (!session) return;
    const before = session.getViewState().project; const request = generation.current;
    const current = () => liveSession.current === session && generation.current === request && session.getViewState().project === before;
    try {
      const checkpoint = await readProjectCheckpoint(id, before.id);
      if (!current()) return;
      assertProposalCurrent(checkpoint, before);
      const restored = restoreCheckpointSnapshot(checkpoint, new Date().toISOString());
      if (!await preserveSafety(before, restored)) throw new Error(checkpointCopy[input.locale].safetyFailed);
      if (!current()) return;
      const outcome = session.executeTransaction({ id: `restore:${id}`, apply: () => restored });
      if (outcome.code !== "committed" && outcome.code !== "no-change") throw new Error(outcome.reason ?? outcome.code);
      return { session, project: session.getViewState().project };
    } catch (error) { if (liveSession.current === session) input.onError(error instanceof Error && error.message.includes("proposal-stale") ? checkpointCopy[input.locale].proposalStale : String(error)); }
  }
  return { loadProject, restoreCheckpoint, getSession: () => liveSession.current };
}
