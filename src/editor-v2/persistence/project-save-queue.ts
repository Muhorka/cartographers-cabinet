import type { EditorProject } from "../model/project-model";
import { autosaveProject, type AutosaveOutcome } from "./project-autosave";

/** Serialize writes, including explicit deletion, without cloning on view changes. */
export class ProjectSaveQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastScheduled?: { source: EditorProject; promise: Promise<AutosaveOutcome> };
  private readonly saved = new Map<string, { source: EditorProject; stored: EditorProject }>();
  private readonly removed = new Set<string>();

  latest(id: string) { return this.saved.get(id)?.stored; }
  isRemoved(id: string) { return this.removed.has(id); }

  save(project: EditorProject): Promise<AutosaveOutcome> {
    if (this.removed.has(project.id)) return Promise.resolve({ state: "failed" });
    // Only adjacent requests may coalesce: A → B → A must finish by writing A.
    if (this.lastScheduled?.source === project) return this.lastScheduled.promise;
    const operation = this.tail.then(async (): Promise<AutosaveOutcome> => {
      if (this.removed.has(project.id)) return { state: "failed" };
      const existing = this.saved.get(project.id);
      if (existing?.source === project) return { state: "saved", project: existing.stored };
      const result = await autosaveProject(project);
      if (result.state === "saved") this.saved.set(project.id, { source: project, stored: result.project });
      return result;
    });
    this.lastScheduled = { source: project, promise: operation };
    this.tail = operation;
    void operation.finally(() => { if (this.lastScheduled?.promise === operation) this.lastScheduled = undefined; });
    return operation;
  }

  async remove(id: string, action: () => Promise<void>) {
    this.removed.add(id);
    const operation = this.tail.then(action);
    this.tail = operation.catch(() => undefined);
    try { await operation; this.saved.delete(id); }
    catch (error) { this.removed.delete(id); throw error; }
  }
}
