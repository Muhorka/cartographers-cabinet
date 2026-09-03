import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import type { EditorProject } from "../model/project-model";
import { ProjectConflictError, ProjectLibraryDatabase, readProjectCheckpoint, removeProjectCheckpoint, saveProjectCheckpoint, scanProjectLibrary, scanProjectRecords } from "./project-library";
import type { AutosaveOutcome } from "./project-autosave";
import { ProjectSaveQueue } from "./project-save-queue";

const databaseName = "cartographers-cabinet-v4";

describe("project library recovery scan", () => {
  it("keeps healthy projects and each invalid raw record separately", () => {
    const healthy = createStarterProject("healthy", "Healthy", "en");
    const invalid = { ...structuredClone(healthy), id: "broken", name: 42 };
    const result = scanProjectRecords([
      { primaryKey: "healthy", rawRecord: healthy },
      { primaryKey: "dexie-broken", rawRecord: invalid },
    ]);
    expect(result.projects.map(({ id }) => id)).toEqual(["healthy"]);
    expect(result.recoveryRecords).toHaveLength(1);
    expect(result.recoveryRecords[0]).toMatchObject({ primaryKey: "dexie-broken", rawRecord: invalid });
    expect(result.recoveryRecords[0]!.rawRecord).not.toBe(invalid);
  });

  it("scans mixed records through real Dexie cursors without aborting", async () => {
    const healthy = createStarterProject("dexie-healthy", "Healthy", "en");
    const invalid = { ...structuredClone(healthy), id: "dexie-broken", places: [{ malformed: true }] };
    const seed = new Dexie(databaseName);
    seed.version(2).stores({ projects: "id,updatedAt,name", preferences: "key", checkpoints: "id,projectId,createdAt,[projectId+createdAt]" });
    await seed.open();
    await seed.table("projects").put(healthy);
    await seed.table("projects").put(invalid);
    const result = await scanProjectLibrary();
    expect(result.projects.map(({ id }) => id)).toContain("dexie-healthy");
    expect(result.recoveryRecords).toHaveLength(1);
    expect(result.recoveryRecords[0]).toMatchObject({ primaryKey: "dexie-broken", rawRecord: invalid });
  });
});

describe("project library cross-tab heads", () => {
  function queueFor(database: ProjectLibraryDatabase) {
    return new ProjectSaveQueue({
      revisionForId: () => 1,
      save: async (project, expectedRevision) => {
        try {
          const saved = await database.saveProject(project, expectedRevision);
          return { state: "saved" as const, project: saved.project, revision: saved.revision };
        } catch (error) {
          if (error instanceof ProjectConflictError) return { state: "conflict" as const, revision: error.actualRevision };
          return { state: "failed" as const, error: { code: "storage" as const, reason: "The change could not be saved to local storage." } };
        }
      },
    });
  }

  it("accepts one writer and rejects the other writer's stale revision", async () => {
    const name = `${databaseName}-write-race-${crypto.randomUUID()}`;
    const first = new ProjectLibraryDatabase(name); const second = new ProjectLibraryDatabase(name);
    try {
      await Promise.all([first.open(), second.open()]);
      const base = createStarterProject("race", "Race", "en");
      await first.saveProject(base);
      const firstQueue = queueFor(first); const secondQueue = queueFor(second);
      const outcomes = await Promise.all([
        firstQueue.save({ ...base, name: "First tab" }),
        secondQueue.save({ ...base, name: "Second tab" }),
      ]);
      expect(outcomes.filter(({ state }) => state === "saved")).toHaveLength(1);
      expect(outcomes.filter(({ state }) => state === "conflict")).toHaveLength(1);
      expect(["First tab", "Second tab"]).toContain((await first.projects.get("race"))?.name);
      expect((await first.projectHeads.get("race"))?.revision).toBe(2);
      expect(await secondQueue.save({ ...base, name: "Retrying stale write" })).toMatchObject({ state: "conflict" });
      expect((await first.projects.get("race"))?.name).not.toBe("Retrying stale write");
    } finally {
      first.close(); second.close(); await Dexie.delete(name);
    }
  });

  it("keeps a deleted project dead when another tab writes its stale snapshot", async () => {
    const name = `${databaseName}-delete-race-${crypto.randomUUID()}`;
    const first = new ProjectLibraryDatabase(name); const second = new ProjectLibraryDatabase(name);
    try {
      await Promise.all([first.open(), second.open()]);
      const base = createStarterProject("deleted", "Deleted", "en");
      await first.saveProject(base);
      const firstQueue = queueFor(first); const secondQueue = queueFor(second);
      await firstQueue.remove("deleted", (expectedRevision) => first.removeProject("deleted", expectedRevision));
      expect(await secondQueue.save({ ...base, name: "Stale resurrection" })).toMatchObject({ state: "conflict" });
      expect(await first.projects.get("deleted")).toBeUndefined();
      expect(await first.projectHeads.get("deleted")).toEqual({ id: "deleted", revision: 2, deleted: true });
    } finally {
      first.close(); second.close(); await Dexie.delete(name);
    }
  });

  it("uses the same revision fence for notebook and full-project saves", async () => {
    const name = `${databaseName}-notebook-race-${crypto.randomUUID()}`;
    const first = new ProjectLibraryDatabase(name); const second = new ProjectLibraryDatabase(name);
    try {
      await Promise.all([first.open(), second.open()]);
      const base = createStarterProject("notebook-race", "Notebook race", "en");
      await first.saveProject(base);
      const firstDocuments = [{ id: "note", title: "First", bodyMarkdown: "One", references: [] }];
      const secondDocuments = [{ id: "note", title: "Second", bodyMarkdown: "Two", references: [] }];

      await first.saveStoryDocuments(base.id, firstDocuments, 1);
      await expect(second.saveStoryDocuments(base.id, secondDocuments, 1)).rejects.toMatchObject({ code: "project-conflict", actualRevision: 2 });
      await expect(second.saveProject({ ...base, name: "Stale full save" }, 1)).rejects.toMatchObject({ code: "project-conflict", actualRevision: 2 });
      expect((await first.projects.get(base.id))?.story.documents).toEqual([]);
      expect((await first.storyDocuments.get(base.id))?.documents).toEqual(firstDocuments);

      const promoted = await first.saveProject({ ...base, story: { ...base.story, documents: firstDocuments } }, 2);
      expect(promoted.revision).toBe(3);
      expect(await first.storyDocuments.get(base.id)).toBeUndefined();
      expect((await first.projects.get(base.id))?.story.documents).toEqual(firstDocuments);
    } finally {
      first.close(); second.close(); await Dexie.delete(name);
    }
  });

  it("prevents both notebook and full saves from resurrecting a deleted project", async () => {
    const name = `${databaseName}-notebook-delete-${crypto.randomUUID()}`;
    const database = new ProjectLibraryDatabase(name);
    try {
      await database.open();
      const base = createStarterProject("notebook-deleted", "Notebook deleted", "en");
      await database.saveProject(base);
      await database.removeProject(base.id, 1);
      await expect(database.saveStoryDocuments(base.id, [], 1)).rejects.toMatchObject({ code: "project-conflict", deleted: true });
      await expect(database.saveProject(base, 1)).rejects.toMatchObject({ code: "project-conflict", deleted: true });
      expect(await database.projects.get(base.id)).toBeUndefined();
      expect(await database.storyDocuments.get(base.id)).toBeUndefined();
    } finally {
      database.close(); await Dexie.delete(name);
    }
  });
});

describe("project checkpoint ownership", () => {
  it("rejects deleting a checkpoint through another project and preserves it", async () => {
    const owner = createStarterProject(`checkpoint-owner-${crypto.randomUUID()}`, "Owner", "en");
    const otherProjectId = `checkpoint-other-${crypto.randomUUID()}`;
    const checkpoint = await saveProjectCheckpoint(owner, "Keep me", { id: `checkpoint-${crypto.randomUUID()}` });

    await expect(removeProjectCheckpoint(checkpoint.id, otherProjectId)).rejects.toThrow(/not found in this project/i);
    await expect(readProjectCheckpoint(checkpoint.id, owner.id)).resolves.toMatchObject({ id: checkpoint.id, projectId: owner.id });
    await removeProjectCheckpoint(checkpoint.id, owner.id);
  });
});

describe("project library notebook migration", () => {
  it("adds notebook storage without changing existing project-head revisions", async () => {
    const name = `${databaseName}-heads-v3-${crypto.randomUUID()}`;
    const base = createStarterProject("migrated-head", "Migrated head", "en");
    const legacy = new Dexie(name);
    legacy.version(3).stores({ projects: "id,updatedAt,name", preferences: "key", checkpoints: "id,projectId,createdAt,[projectId+createdAt]", projectHeads: "id" });
    await legacy.open(); await legacy.table("projects").put(base); await legacy.table("projectHeads").put({ id: base.id, revision: 7, deleted: false }); legacy.close();
    const upgraded = new ProjectLibraryDatabase(name, { captureAlternateVersionThree: true });
    try {
      await upgraded.open();
      expect(await upgraded.projectHeads.get(base.id)).toEqual({ id: base.id, revision: 7, deleted: false });
      expect(upgraded.tables.map(({ name }) => name)).toContain("storyDocuments");
    } finally {
      upgraded.close(); await Dexie.delete(name);
    }
  });

  it("adopts a legacy notebook overlay into the shared revision stream", async () => {
    const name = `${databaseName}-documents-v3-${crypto.randomUUID()}`;
    const base = createStarterProject("migrated-note", "Migrated note", "en");
    const documents = [{ id: "legacy-note", title: "Legacy", bodyMarkdown: "Preserved", references: [] }];
    const legacy = new Dexie(name);
    legacy.version(3).stores({ projects: "id,updatedAt,name", preferences: "key", checkpoints: "id,projectId,createdAt,[projectId+createdAt]", storyDocuments: "projectId,updatedAt" });
    await legacy.open(); await legacy.table("projects").put(base); await legacy.table("storyDocuments").put({ projectId: base.id, documents, updatedAt: base.updatedAt }); legacy.close();
    const upgraded = new ProjectLibraryDatabase(name, { captureAlternateVersionThree: true });
    try {
      await upgraded.open();
      expect(await upgraded.projectHeads.get(base.id)).toEqual({ id: base.id, revision: 2, deleted: false });
      expect(await upgraded.storyDocuments.get(base.id)).toMatchObject({ documents, revision: 2 });
    } finally {
      upgraded.close(); await Dexie.delete(name);
    }
  });
});

describe("project save queue notebook ordering", () => {
  it("does not run a queued notebook save after deletion has started", async () => {
    const project = createStarterProject("queued-delete", "Queued delete", "en");
    let finishFullSave!: () => void;
    const save = vi.fn((candidate: EditorProject) => new Promise<AutosaveOutcome>((resolve) => {
      finishFullSave = () => resolve({ state: "saved", project: candidate, revision: 2 });
    }));
    const saveDocuments = vi.fn(async (candidate: typeof project) => ({ state: "saved" as const, project: candidate, revision: 3 }));
    const remove = vi.fn(async () => undefined);
    const queue = new ProjectSaveQueue({ revisionForId: () => 1, save, saveDocuments });
    const full = queue.save(project);
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    const notebook = queue.saveStoryDocuments({ ...project, story: { ...project.story, documents: [{ id: "note", title: "Note", bodyMarkdown: "Text", references: [] }] } });
    const deletion = queue.remove(project.id, remove);
    finishFullSave();

    await expect(full).resolves.toMatchObject({ state: "saved", revision: 2 });
    await expect(notebook).resolves.toMatchObject({ state: "failed" });
    await deletion;
    expect(saveDocuments).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(2);
  });
});
