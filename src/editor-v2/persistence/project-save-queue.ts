import type { EditorProject } from "../model/project-model";
import { autosaveProject, type AutosaveOutcome } from "./project-autosave";
import { persistedProjectRevisionForId } from "./project-library";

type ProjectSaveQueueOptions = {
  save?: (project: EditorProject, expectedRevision?: number) => Promise<AutosaveOutcome>;
  revisionForId?: (id: string) => number | undefined;
};

/** Serialize writes, including explicit deletion, without cloning on view changes. */
export class ProjectSaveQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastScheduled?: { source: EditorProject; promise: Promise<AutosaveOutcome> };
  private readonly saved = new Map<string, { source: EditorProject; stored: EditorProject }>();
  private readonly removed = new Set<string>();
  private readonly revisions = new Map<string, number | undefined>();
  private readonly knownRevisions = new Set<string>();
  private readonly conflicts = new Set<string>();
  private readonly saveProject: NonNullable<ProjectSaveQueueOptions["save"]>;
  private readonly revisionForId: NonNullable<ProjectSaveQueueOptions["revisionForId"]>;

  constructor(options: ProjectSaveQueueOptions = {}) {
    this.saveProject = options.save ?? autosaveProject;
    this.revisionForId = options.revisionForId ?? persistedProjectRevisionForId;
  }

  latest(id: string) { return this.saved.get(id)?.stored; }
  isRemoved(id: string) { return this.removed.has(id); }
  isConflicted(id: string) { return this.conflicts.has(id); }

  /** Bind the storage revision when a project first enters this editor session. */
  observe(id: string) {
    if (this.knownRevisions.has(id)) return;
    this.revisions.set(id, this.revisionForId(id));
    this.knownRevisions.add(id);
  }

  private expectedRevision(id: string) {
    this.observe(id);
    return this.revisions.get(id);
  }

  save(project: EditorProject): Promise<AutosaveOutcome> {
    if (this.removed.has(project.id)) return Promise.resolve({ state: "failed", error: { code: "storage", reason: "This project is being removed." } });
    if (this.conflicts.has(project.id)) return Promise.resolve({ state: "conflict" });
    // Only adjacent requests may coalesce: A → B → A must finish by writing A.
    if (this.lastScheduled?.source === project) return this.lastScheduled.promise;
    const operation = this.tail.then(async (): Promise<AutosaveOutcome> => {
      if (this.removed.has(project.id)) return { state: "failed", error: { code: "storage", reason: "This project is being removed." } };
      if (this.conflicts.has(project.id)) return { state: "conflict" };
      const existing = this.saved.get(project.id);
      if (existing?.source === project) return { state: "saved", project: existing.stored };
      const result = await this.saveProject(project, this.expectedRevision(project.id));
      if (result.state === "saved") {
        this.saved.set(project.id, { source: project, stored: result.project });
        if (result.revision !== undefined) this.revisions.set(project.id, result.revision);
      }
      if (result.state === "conflict") this.conflicts.add(project.id);
      return result;
    });
    this.lastScheduled = { source: project, promise: operation };
    this.tail = operation;
    void operation.finally(() => { if (this.lastScheduled?.promise === operation) this.lastScheduled = undefined; });
    return operation;
  }

  async remove(id: string, action: (expectedRevision?: number) => Promise<void>) {
    this.removed.add(id);
    const operation = this.tail.then(async () => action(this.expectedRevision(id)));
    this.tail = operation.catch(() => undefined);
    try { await operation; this.saved.delete(id); }
    catch (error) { this.removed.delete(id); throw error; }
  }
}
