import { z } from "zod";
import type { EditorProject } from "../model/project-model";
import { immutableSnapshot } from "../state/immutable-snapshot";
import { storyCollectionSchemas } from "../story/schema";
import { cloneImportedProject, editorProjectSchema, parseProjectFile } from "./project-file";
import { checkpointSummary, createProjectCheckpoint, type ProjectCheckpoint, type ProjectCheckpointSummary } from "./project-checkpoint";
import { ProjectLibraryDatabase } from "./project-library-database";
export { ProjectConflictError, ProjectLibraryDatabase } from "./project-library-database";

export type ProjectLibraryRecoveryRecord = {
  primaryKey: IDBValidKey;
  rawRecord: unknown;
  reason: string;
};

export type ProjectLibraryScan = {
  projects: EditorProject[];
  recoveryRecords: ProjectLibraryRecoveryRecord[];
};

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
  const projectsById = new Map(scan.projects.map((project) => [project.id, project]));
  const heads = new Map((await db().projectHeads.toArray()).map((head) => [head.id, head]));
  for (const [id, project] of projectsById) {
    const head = heads.get(id);
    if (head?.deleted) {
      scan.recoveryRecords.push({ primaryKey: id, rawRecord: structuredClone(project), reason: "Projekt ma znacznik usunięcia, ale jego dane nadal istnieją." });
      projectsById.delete(id);
    }
  }
  for (const record of await db().storyDocuments.toArray()) {
    const project = projectsById.get(record.projectId);
    const head = heads.get(record.projectId);
    if (!project || !head || head.deleted) {
      scan.recoveryRecords.push({ primaryKey: `storyDocuments:${record.projectId}`, rawRecord: structuredClone(record), reason: "Notatki nie mają aktywnego projektu bazowego." });
      continue;
    }
    if (record.revision !== head.revision) {
      scan.recoveryRecords.push({ primaryKey: `storyDocuments:${record.projectId}`, rawRecord: structuredClone(record), reason: "Notatki pochodzą z innej wersji projektu." });
      continue;
    }
    const documents = storyCollectionSchemas.documents.safeParse(record.documents);
    if (!documents.success) {
      scan.recoveryRecords.push({ primaryKey: `storyDocuments:${record.projectId}`, rawRecord: structuredClone(record), reason: parseFailureReason(documents.error) });
      continue;
    }
    projectsById.set(record.projectId, immutableSnapshot({
      ...project,
      updatedAt: record.updatedAt > project.updatedAt ? record.updatedAt : project.updatedAt,
      story: { ...project.story, documents: documents.data },
    }, project));
  }
  scan.projects = [...projectsById.values()].toSorted((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  for (const project of scan.projects) {
    const revision = heads.get(project.id)?.revision;
    if (revision !== undefined) {
      persistedRevisions.set(project, revision);
      projectRevisions.set(project.id, revision);
    }
  }
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

/** Persist only the validated notebook branch, using the same revision fence as a full save. */
export async function saveStoryDocuments(project: EditorProject, expectedRevision?: number) {
  const record = await db().saveStoryDocuments(project.id, project.story.documents, expectedRevision);
  const saved = immutableSnapshot({ ...project, updatedAt: record.updatedAt }, project);
  persistedRevisions.set(saved, record.revision);
  projectRevisions.set(saved.id, record.revision);
  return saved;
}

export async function importSavedProjectAsNew(source: string | unknown, createId: () => string = () => crypto.randomUUID()) {
  const { project } = parseProjectFile(source);
  return db().transaction("rw", db().projects, db().projectHeads, db().storyDocuments, async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = createId();
      if (!id.trim() || id === project.id || await db().projects.get(id) || await db().projectHeads.get(id) || await db().storyDocuments.get(id)) continue;
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
  const result = await db().removeProject(projectId, expectedRevision);
  projectRevisions.set(projectId, result.revision);
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

export async function removeProjectCheckpoint(checkpointId: string, projectId: string) {
  await db().transaction("rw", db().checkpoints, async () => {
    const checkpoint = await db().checkpoints.get(checkpointId);
    if (!checkpoint || checkpoint.projectId !== projectId) throw new Error("Checkpoint not found in this project.");
    await db().checkpoints.delete(checkpointId);
  });
}

export async function getPreference(key: string) {
  return (await db().preferences.get(key))?.value;
}

export async function setPreference(key: string, value: string) {
  await db().preferences.put({ key, value });
}
