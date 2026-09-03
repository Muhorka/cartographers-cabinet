import Dexie, { type EntityTable } from "dexie";
import { z } from "zod";
import type { EditorProject } from "../model/project-model";
import { cloneImportedProject, editorProjectSchema, parseProjectFile } from "./project-file";
import { checkpointSummary, createProjectCheckpoint, type ProjectCheckpoint, type ProjectCheckpointSummary } from "./project-checkpoint";

type Preference = { key: string; value: string };
export type ProjectHead = { id: string; revision: number; deleted: boolean };

export class ProjectConflictError extends Error {
  readonly code = "project-conflict" as const;
  constructor(readonly projectId: string, readonly actualRevision: number | undefined, readonly deleted = false) {
    super(deleted ? "The project was deleted in another tab." : "The project was changed in another tab.");
    this.name = "ProjectConflictError";
  }
}

export type ProjectLibraryRecoveryRecord = {
  primaryKey: IDBValidKey;
  rawRecord: unknown;
  reason: string;
};

export type ProjectLibraryScan = {
  projects: EditorProject[];
  recoveryRecords: ProjectLibraryRecoveryRecord[];
};

export class ProjectLibraryDatabase extends Dexie {
  projects!: EntityTable<EditorProject, "id">;
  preferences!: EntityTable<Preference, "key">;
  checkpoints!: EntityTable<ProjectCheckpoint, "id">;
  projectHeads!: EntityTable<ProjectHead, "id">;

  constructor(name = "cartographers-cabinet-v4") {
    super(name);
    this.version(1).stores({ projects: "id,updatedAt,name", preferences: "key" });
    this.version(2).stores({ projects: "id,updatedAt,name", preferences: "key", checkpoints: "id,projectId,createdAt,[projectId+createdAt]" });
    this.version(3).stores({ projects: "id,updatedAt,name", preferences: "key", checkpoints: "id,projectId,createdAt,[projectId+createdAt]", projectHeads: "id" }).upgrade(async (transaction) => {
      await transaction.table("projects").toCollection().each((project: EditorProject) => transaction.table("projectHeads").put({ id: project.id, revision: 1, deleted: false }));
    });
  }

  async readProjectHead(id: string) { return this.projectHeads.get(id); }

  async saveProject(project: EditorProject, expectedRevision?: number) {
    const candidate = editorProjectSchema.parse(structuredClone(project));
    return this.transaction("rw", this.projects, this.projectHeads, async () => {
      const [head, existing] = await Promise.all([this.projectHeads.get(candidate.id), this.projects.get(candidate.id)]);
      if (head?.deleted) throw new ProjectConflictError(candidate.id, head.revision, true);
      if (head ? head.revision !== expectedRevision : existing !== undefined || expectedRevision !== undefined) throw new ProjectConflictError(candidate.id, head?.revision);
      const revision = (head?.revision ?? 0) + 1;
      const saved = editorProjectSchema.parse({ ...candidate, updatedAt: new Date().toISOString() });
      await this.projects.put(saved);
      await this.projectHeads.put({ id: candidate.id, revision, deleted: false });
      return { project: saved, revision };
    });
  }

  async removeProject(projectId: string, expectedRevision?: number) {
    return this.transaction("rw", this.projects, this.projectHeads, this.checkpoints, async () => {
      const [head, existing] = await Promise.all([this.projectHeads.get(projectId), this.projects.get(projectId)]);
      if (head?.deleted) throw new ProjectConflictError(projectId, head.revision, true);
      if (head ? head.revision !== expectedRevision : existing !== undefined || expectedRevision !== undefined) throw new ProjectConflictError(projectId, head?.revision);
      const revision = (head?.revision ?? 0) + 1;
      await this.projects.delete(projectId);
      await this.checkpoints.where("projectId").equals(projectId).delete();
      await this.projectHeads.put({ id: projectId, revision, deleted: true });
    });
  }
}

let database: ProjectLibraryDatabase | undefined;
function db() { return database ??= new ProjectLibraryDatabase(); }
const persistedRevisions = new WeakMap<object, number>();
const projectRevisions = new Map<string, number>();

function parseFailureReason(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "projekt"}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : "Nieznany błąd walidacji projektu.";
}

export function scanProjectRecords(records: Iterable<{ primaryKey: IDBValidKey; rawRecord: unknown }>): ProjectLibraryScan {
  const projects: EditorProject[] = [];
  const recoveryRecords: ProjectLibraryRecoveryRecord[] = [];
  for (const { primaryKey, rawRecord } of records) {
    try {
      projects.push(editorProjectSchema.parse(rawRecord));
    } catch (error) {
      recoveryRecords.push({ primaryKey, rawRecord: structuredClone(rawRecord), reason: parseFailureReason(error) });
    }
  }
  projects.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  return { projects, recoveryRecords };
}

export async function scanProjectLibrary(): Promise<ProjectLibraryScan> {
  const records: { primaryKey: IDBValidKey; rawRecord: unknown }[] = [];
  await db().projects.toCollection().each((rawRecord, cursor) => {
    records.push({ primaryKey: cursor.primaryKey as IDBValidKey, rawRecord });
  });
  const scan = scanProjectRecords(records);
  const heads = await db().projectHeads.bulkGet(scan.projects.map(({ id }) => id));
  scan.projects.forEach((project, index) => { const revision = heads[index]?.revision; if (revision !== undefined) projectRevisions.set(project.id, revision); });
  return scan;
}

export function persistedProjectRevision(project: EditorProject) {
  return persistedRevisions.get(project);
}

export function persistedProjectRevisionForId(id: string) {
  return projectRevisions.get(id);
}

export async function saveProject(project: EditorProject, expectedRevision?: number) {
  const saved = await db().saveProject(project, expectedRevision);
  persistedRevisions.set(saved.project, saved.revision);
  projectRevisions.set(saved.project.id, saved.revision);
  return saved.project;
}

export async function importSavedProjectAsNew(source: string | unknown, createId: () => string = () => crypto.randomUUID()) {
  const { project } = parseProjectFile(source);
  return db().transaction("rw", db().projects, db().projectHeads, async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = createId();
      if (!id.trim() || id === project.id || await db().projects.get(id) || await db().projectHeads.get(id)) continue;
      const imported = cloneImportedProject(project, id);
      await db().projects.add(imported);
      await db().projectHeads.add({ id, revision: 1, deleted: false });
      persistedRevisions.set(imported, 1);
      projectRevisions.set(id, 1);
      return imported;
    }
    throw new Error("Could not allocate a fresh project identifier.");
  });
}

export async function removeProject(projectId: string, expectedRevision?: number) {
  await db().removeProject(projectId, expectedRevision);
}

export async function listProjectCheckpoints(projectId: string) {
  const items: ProjectCheckpointSummary[] = [];
  // Iterate instead of retaining every full snapshot; no schema/storage migration.
  await db().checkpoints.where("projectId").equals(projectId).each((item) => { items.push(checkpointSummary(item)); });
  return items.toSorted((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function loadProjectCheckpoint(id: string, projectId: string) {
  return (await readProjectCheckpoint(id, projectId)).snapshot;
}

export async function readProjectCheckpoint(id: string, projectId: string): Promise<ProjectCheckpoint> {
  const item = await db().checkpoints.get(id);
  if (!item || item.projectId !== projectId) throw new Error("Checkpoint not found in this project.");
  const snapshot = editorProjectSchema.parse(item.snapshot);
  if (snapshot.id !== projectId) throw new Error("Checkpoint does not belong to its project.");
  const baseSnapshot = item.baseSnapshot ? editorProjectSchema.parse(item.baseSnapshot) : undefined;
  if (baseSnapshot && baseSnapshot.id !== projectId) throw new Error("Proposal base belongs to another project.");
  return { ...item, snapshot, ...(baseSnapshot ? { baseSnapshot } : {}) };
}

export async function saveProjectCheckpoint(project: EditorProject, name: string, input: { id?: string; createdAt?: string; kind?: ProjectCheckpoint["kind"]; baseSnapshot?: EditorProject; summary?: string } = {}) {
  const checkpoint = createProjectCheckpoint(project, { ...input, id: input.id ?? crypto.randomUUID(), name });
  await db().checkpoints.add(checkpoint);
  return checkpoint;
}

export async function removeProjectCheckpoint(checkpointId: string) {
  await db().checkpoints.delete(checkpointId);
}

export async function getPreference(key: string) {
  return (await db().preferences.get(key))?.value;
}

export async function setPreference(key: string, value: string) {
  await db().preferences.put({ key, value });
}
