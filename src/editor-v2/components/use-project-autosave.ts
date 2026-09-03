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
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current.handle); timer.current = undefined; }; }, []);
  const flush = useCallback(async (document: EditorProject) => {
    if (timer.current?.projectId === document.id) { clearTimeout(timer.current.handle); timer.current = undefined; }
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
  /**
   * A notebook edit arriving while the full-save debounce is pending must
   * promote that pending write to a full flush. Otherwise cancelling the timer
   * would leave the latest map/Worldbook change only in React state.
   */
  const saveStoryDocuments = useCallback(async (document: EditorProject) => {
    if (timer.current?.projectId === document.id) return flush(document);
    return queue.saveStoryDocuments(document);
  }, [flush, queue]);
  useEffect(() => {
    if (!project || queue.isRemoved(project.id)) return;
    const handle = setTimeout(() => {
      if (timer.current?.handle === handle) timer.current = undefined;
      void flush(project);
    }, 350);
    timer.current = { projectId: project.id, handle };
    return () => {
      clearTimeout(handle);
      if (timer.current?.handle === handle) timer.current = undefined;
    };
  }, [project, flush, queue]);
  const controls = useMemo(() => ({ flush, flushSession, saveStoryDocuments,
    latest: (id: string) => queue.latest(id),
    remove: async (id: string, action: (expectedRevision?: number) => Promise<void>) => {
      if (timer.current?.projectId === id) { clearTimeout(timer.current.handle); timer.current = undefined; }
      await queue.remove(id, (expectedRevision) => action(expectedRevision));
    },
  }), [flush, flushSession, queue, saveStoryDocuments]);
  const status = state.document === project ? state.status : project ? "saving" : "saved";
  return { ...controls, saving: status === "saving", saveFailed: status === "failed", saveConflict: status === "conflict", saveFailure: status === "failed" && state.document === project ? state.error : undefined };
}
