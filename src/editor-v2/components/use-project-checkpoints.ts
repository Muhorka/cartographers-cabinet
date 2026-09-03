"use client";
import { useEffect, useState } from "react";
import type { EditorLocale } from "../i18n/workbench-copy";
import { checkpointCopy } from "../i18n/checkpoint-copy";
import type { EditorProject } from "../model/project-model";
import { checkpointSummary, type ProjectCheckpointSummary } from "../persistence/project-checkpoint";
import { listProjectCheckpoints, loadProjectCheckpoint, removeProjectCheckpoint, saveProjectCheckpoint } from "../persistence/project-library";
import { safePersistenceError } from "../persistence/persistence-errors";

export function useProjectCheckpoints(project: EditorProject | undefined, locale: EditorLocale) {
  const projectId = project?.id;
  const [error, setError] = useState<string>();
  const [items, setItems] = useState<ProjectCheckpointSummary[]>([]); const [activeId, chooseActiveId] = useState<string>(); const [opacity, setOpacity] = useState(.4);
  const [tracing, setTracing] = useState<{ id: string; projectId: string; project: EditorProject }>();
  const projectItems = items.filter(({ projectId: ownerId }) => ownerId === projectId); const effectiveActiveId = projectItems.some(({ id }) => id === activeId) ? activeId : undefined;
  function setActiveId(id?: string) { setError(undefined); setTracing(undefined); chooseActiveId(id); }
  useEffect(() => { let cancelled = false; if (!projectId) return; void listProjectCheckpoints(projectId).then((next) => { if (!cancelled) setItems(next); }).catch((cause) => { if (!cancelled) setError(safePersistenceError(cause).reason); }); return () => { cancelled = true; }; }, [projectId]);
  useEffect(() => {
    let cancelled = false;
    if (!effectiveActiveId || !projectId) return;
    void loadProjectCheckpoint(effectiveActiveId, projectId).then((loaded) => { if (!cancelled) setTracing({ id: effectiveActiveId, projectId, project: loaded }); }).catch((cause) => { if (!cancelled) setError(safePersistenceError(cause).reason); });
    return () => { cancelled = true; };
  }, [effectiveActiveId, projectId]);
  async function preserve(name: string) {
    if (!project) return;
    try {
      const checkpoint = await saveProjectCheckpoint(project, name || checkpointCopy[locale].automaticName(new Date()));
      setError(undefined); setItems((current) => [checkpointSummary(checkpoint), ...current]); return checkpoint;
    } catch { setError(checkpointCopy[locale].saveFailed); return undefined; }
  }
  async function preserveAgentChange(before: EditorProject, after: EditorProject, summary: string, kind: "safety" | "proposal") {
    const label = kind === "safety" ? checkpointCopy[locale].agentSafety : checkpointCopy[locale].proposal;
    try {
      const checkpoint = await saveProjectCheckpoint(kind === "safety" ? before : after, `${label} — ${summary}`, { kind, summary, ...(kind === "proposal" ? { baseSnapshot: before } : {}) });
      setError(undefined); setItems((current) => [checkpointSummary(checkpoint), ...current]); return checkpoint.id;
    } catch { setError(kind === "safety" ? checkpointCopy[locale].safetyFailed : checkpointCopy[locale].saveFailed); return undefined; }
  }
  async function remove(id: string) {
    try {
      await removeProjectCheckpoint(id);
      setError(undefined); setItems((current) => current.filter(({ id: checkpointId }) => checkpointId !== id)); if (activeId === id) setActiveId(undefined);
    } catch (cause) { setError(checkpointCopy[locale].removeFailed); throw cause; }
  }
  return { items: projectItems, activeId: effectiveActiveId, setActiveId, opacity, setOpacity, error, tracingProject: tracing && tracing.projectId === projectId && tracing.id === effectiveActiveId ? tracing.project : undefined, preserve, preserveAgentChange, remove };
}
