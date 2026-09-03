import Dexie, { type EntityTable, type PromiseExtended } from "dexie";
import type { EditorProject } from "../model/project-model";
import { storyCollectionSchemas } from "../story/schema";
import { editorProjectSchema } from "./project-file";
import type { ProjectCheckpoint } from "./project-checkpoint";

export type Preference = { key: string; value: string };
export type ProjectHead = { id: string; revision: number; deleted: boolean };
export type StoryDocumentsRecord = {
  projectId: string;
  documents: EditorProject["story"]["documents"];
  updatedAt: string;
  revision: number;
};

export class ProjectConflictError extends Error {
  readonly code = "project-conflict" as const;

  constructor(readonly projectId: string, readonly actualRevision: number | undefined, readonly deleted = false) {
    super(deleted ? "The project was deleted in another tab." : "The project was changed in another tab.");
    this.name = "ProjectConflictError";
  }
}

const stores = {
  projects: "id,updatedAt,name",
  preferences: "key",
  checkpoints: "id,projectId,createdAt,[projectId+createdAt]",
  projectHeads: "id",
  storyDocuments: "projectId,updatedAt",
};

type LegacyStoryDocumentsRecord = Omit<StoryDocumentsRecord, "revision"> & { revision?: number };

async function captureAlternateVersionThreeDocuments(name: string): Promise<LegacyStoryDocumentsRecord[]> {
  if (!await Dexie.exists(name)) return [];
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const source = request.result;
      if (!source.objectStoreNames.contains("storyDocuments") || source.objectStoreNames.contains("projectHeads")) {
        source.close(); resolve([]); return;
      }
      const transaction = source.transaction("storyDocuments", "readonly");
      const records = transaction.objectStore("storyDocuments").getAll();
      records.onerror = () => { source.close(); reject(records.error); };
      records.onsuccess = () => { source.close(); resolve(records.result as LegacyStoryDocumentsRecord[]); };
    };
  });
}

/** IndexedDB schema and atomic compare-and-swap writes shared by full and notebook saves. */
export class ProjectLibraryDatabase extends Dexie {
  projects!: EntityTable<EditorProject, "id">;
  preferences!: EntityTable<Preference, "key">;
  checkpoints!: EntityTable<ProjectCheckpoint, "id">;
  projectHeads!: EntityTable<ProjectHead, "id">;
  storyDocuments!: EntityTable<StoryDocumentsRecord, "projectId">;
  private readonly alternateV3Documents: Promise<LegacyStoryDocumentsRecord[]>;
  private alternateRestore?: Promise<void>;

  constructor(name = "cartographers-cabinet-v4", options: { captureAlternateVersionThree?: boolean } = {}) {
    super(name);
    // One unpublished notebook preview used a different v3 table set under the
    // same database name. Capture it before Dexie reconciles that old schema.
    this.alternateV3Documents = options.captureAlternateVersionThree ?? name === "cartographers-cabinet-v4"
      ? captureAlternateVersionThreeDocuments(name)
      : Promise.resolve([]);
    this.version(1).stores({ projects: stores.projects, preferences: stores.preferences });
    this.version(2).stores({ projects: stores.projects, preferences: stores.preferences, checkpoints: stores.checkpoints });
    this.version(3).stores({ projects: stores.projects, preferences: stores.preferences, checkpoints: stores.checkpoints, projectHeads: stores.projectHeads }).upgrade(async (transaction) => {
      await transaction.table("projects").toCollection().each((project: EditorProject) => transaction.table("projectHeads").put({ id: project.id, revision: 1, deleted: false }));
    });
    this.version(4).stores(stores).upgrade(async (transaction) => {
      const projects = await transaction.table("projects").toArray() as EditorProject[];
      const heads = transaction.table("projectHeads");
      const documents = transaction.table("storyDocuments");
      for (const project of projects) {
        const head = await heads.get(project.id) as ProjectHead | undefined;
        const overlay = await documents.get(project.id) as Partial<StoryDocumentsRecord> | undefined;
        const baseRevision = head?.revision ?? 1;
        if (overlay && typeof overlay.revision !== "number") {
          const revision = baseRevision + 1;
          await documents.put({ ...overlay, projectId: project.id, revision });
          await heads.put({ id: project.id, revision, deleted: false });
        } else if (!head) {
          await heads.put({ id: project.id, revision: overlay?.revision ?? 1, deleted: false });
        }
      }
    });
  }

  override open(): PromiseExtended<Dexie> {
    return Dexie.Promise.resolve(this.alternateV3Documents).then((legacyDocuments) => super.open().then((opened) => {
      if (!this.alternateRestore) this.alternateRestore = this.restoreAlternateV3Documents(legacyDocuments);
      return Dexie.Promise.resolve(this.alternateRestore).then(() => opened);
    }));
  }

  private async restoreAlternateV3Documents(legacyDocuments: LegacyStoryDocumentsRecord[]) {
    if (!legacyDocuments.length) return;
    await this.transaction("rw", this.projects, this.projectHeads, this.storyDocuments, async () => {
      for (const legacy of legacyDocuments) {
        const [project, head] = await Promise.all([this.projects.get(legacy.projectId), this.projectHeads.get(legacy.projectId)]);
        if (!project) {
          await this.storyDocuments.put({ ...legacy, revision: legacy.revision ?? 1 });
          continue;
        }
        if (head?.deleted) continue;
        const revision = (head?.revision ?? 1) + 1;
        await this.storyDocuments.put({ ...legacy, revision });
        await this.projectHeads.put({ id: legacy.projectId, revision, deleted: false });
      }
    });
  }

  async readProjectHead(id: string) { return this.projectHeads.get(id); }

  async saveProject(project: EditorProject, expectedRevision?: number) {
    const candidate = editorProjectSchema.parse(structuredClone(project));
    return this.transaction("rw", this.projects, this.projectHeads, this.storyDocuments, async () => {
      const [head, existing] = await Promise.all([this.projectHeads.get(candidate.id), this.projects.get(candidate.id)]);
      if (head?.deleted) throw new ProjectConflictError(candidate.id, head.revision, true);
      if (head ? head.revision !== expectedRevision : existing !== undefined || expectedRevision !== undefined) {
        throw new ProjectConflictError(candidate.id, head?.revision);
      }
      const revision = (head?.revision ?? 0) + 1;
      const saved = editorProjectSchema.parse({ ...candidate, updatedAt: new Date().toISOString() });
      await this.projects.put(saved);
      await this.storyDocuments.delete(saved.id);
      await this.projectHeads.put({ id: candidate.id, revision, deleted: false });
      return { project: saved, revision };
    });
  }

  async saveStoryDocuments(projectId: string, input: EditorProject["story"]["documents"], expectedRevision?: number) {
    const documents = storyCollectionSchemas.documents.parse(structuredClone(input));
    return this.transaction("rw", this.projects, this.projectHeads, this.storyDocuments, async () => {
      const [head, existing] = await Promise.all([this.projectHeads.get(projectId), this.projects.get(projectId)]);
      if (head?.deleted) throw new ProjectConflictError(projectId, head.revision, true);
      if (!existing || !head || head.revision !== expectedRevision) throw new ProjectConflictError(projectId, head?.revision, head?.deleted);
      const revision = head.revision + 1;
      const record: StoryDocumentsRecord = { projectId, documents, updatedAt: new Date().toISOString(), revision };
      await this.storyDocuments.put(record);
      await this.projectHeads.put({ id: projectId, revision, deleted: false });
      return record;
    });
  }

  async removeProject(projectId: string, expectedRevision?: number) {
    return this.transaction("rw", this.projects, this.projectHeads, this.checkpoints, this.storyDocuments, async () => {
      const [head, existing] = await Promise.all([this.projectHeads.get(projectId), this.projects.get(projectId)]);
      if (head?.deleted) throw new ProjectConflictError(projectId, head.revision, true);
      if (head ? head.revision !== expectedRevision : existing !== undefined || expectedRevision !== undefined) {
        throw new ProjectConflictError(projectId, head?.revision);
      }
      const revision = (head?.revision ?? 0) + 1;
      await this.projects.delete(projectId);
      await this.checkpoints.where("projectId").equals(projectId).delete();
      await this.storyDocuments.delete(projectId);
      await this.projectHeads.put({ id: projectId, revision, deleted: true });
      return { revision };
    });
  }
}
