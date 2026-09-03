"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorProject } from "../model/project-model";
import type { EditorSession } from "../state/editor-session";
import { ProjectSaveQueue } from "../persistence/project-save-queue";
import type { SafePersistenceError } from "../persistence/persistence-errors";

export function useProjectAutosave(project: EditorProject | undefined, onSaved: (project: EditorProject) => void) {
  const [queue] = useState(() => new ProjectSaveQueue());
  const [state, setState] = useState<{ document?: EditorProject; status: "saved" | "saving" | "failed" | "conflict"; error?: SafePersistenceError }>({ status: "saved" });
  const current = useRef(project); const notify = useRef(onSaved);
  const timer = useRef<{ projectId: string; handle: ReturnType<typeof setTimeout> } | undefined>(undefined);
  const mounted = useRef(true);
  if (project) queue.observe(project.id);
  useEffect(() => { current.current = project; notify.current = onSaved; }, [project, onSaved]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current?.handle); }; }, []);
  const flush = useCallback(async (document: EditorProject) => {
    if (timer.current?.projectId === document.id) clearTimeout(timer.current.handle);
    if (mounted.current && current.current === document) setState({ document, status: "saving" });
    const result = await queue.save(document);
    if (mounted.current) {
      // A completed old-project write still updates the library, not the new project's badge.
      if (result.state === "saved" && !queue.isRemoved(document.id)) notify.current(result.project);
      if (current.current === document) setState({ document, status: result.state, ...(result.state === "failed" ? { error: result.error } : {}) });
    }
    return result;
  }, [queue]);
  const flushSession = useCallback(async (session: EditorSession) => {
    while (true) {
      const document = session.getViewState().project;
      if (queue.isRemoved(document.id)) return true;
      if ((await flush(document)).state !== "saved") return false;
      if (session.getViewState().project === document) return true;
    }
  }, [flush, queue]);
  /** Persist the notebook branch without cloning and validating the full map. */
  const saveStoryDocuments = useCallback(async (document: EditorProject) => {
    if (timer.current?.projectId === document.id) clearTimeout(timer.current.handle);
    return queue.saveStoryDocuments(document);
  }, [queue]);
  useEffect(() => {
    if (!project || queue.isRemoved(project.id)) return;
    const handle = setTimeout(() => { void flush(project); }, 350);
    timer.current = { projectId: project.id, handle };
    return () => clearTimeout(handle);
  }, [project, flush, queue]);
  const controls = useMemo(() => ({ flush, flushSession, saveStoryDocuments,
    latest: (id: string) => queue.latest(id),
    remove: async (id: string, action: (expectedRevision?: number) => Promise<void>) => {
      if (timer.current?.projectId === id) clearTimeout(timer.current.handle);
      await queue.remove(id, (expectedRevision) => action(expectedRevision));
    },
  }), [flush, flushSession, queue, saveStoryDocuments]);
  const status = state.document === project ? state.status : project ? "saving" : "saved";
  return { ...controls, saving: status === "saving", saveFailed: status === "failed", saveConflict: status === "conflict", saveFailure: status === "failed" && state.document === project ? state.error : undefined };
}
