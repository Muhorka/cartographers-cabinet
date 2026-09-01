import Dexie, { type EntityTable } from "dexie";
import type { EditorProject } from "../model/project-model";
import { cloneImportedProject, editorProjectSchema, parseProjectFile } from "./project-file";
import { checkpointSummary, createProjectCheckpoint, type ProjectCheckpoint, type ProjectCheckpointSummary } from "./project-checkpoint";

type Preference = { key: string; value: string };

class ProjectLibraryDatabase extends Dexie {
  projects!: EntityTable<EditorProject, "id">;
  preferences!: EntityTable<Preference, "key">;
  checkpoints!: EntityTable<ProjectCheckpoint, "id">;

  constructor() {
    super("cartographers-cabinet-v4");
    this.version(1).stores({ projects: "id,updatedAt,name", preferences: "key" });
    this.version(2).stores({ projects: "id,updatedAt,name", preferences: "key", checkpoints: "id,projectId,createdAt,[projectId+createdAt]" });
  }
}

let database: ProjectLibraryDatabase | undefined;
function db() { return database ??= new ProjectLibraryDatabase(); }

export async function listSavedProjects() {
  return (await db().projects.toArray()).map((project) => editorProjectSchema.parse(project)).toSorted((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export async function saveProject(project: EditorProject) {
  const saved = editorProjectSchema.parse({ ...structuredClone(project), updatedAt: new Date().toISOString() });
  await db().projects.put(saved); return saved;
}

export async function importSavedProjectAsNew(source: string | unknown, createId: () => string = () => crypto.randomUUID()) {
  const { project } = parseProjectFile(source);
  return db().transaction("rw", db().projects, async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = createId();
      if (!id.trim() || id === project.id || await db().projects.get(id)) continue;
      const imported = cloneImportedProject(project, id);
      await db().projects.add(imported);
      return imported;
    }
    throw new Error("Could not allocate a fresh project identifier.");
  });
}

export async function removeProject(projectId: string) {
  await db().transaction("rw", db().projects, db().checkpoints, async () => {
    await db().projects.delete(projectId);
    await db().checkpoints.where("projectId").equals(projectId).delete();
  });
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
