import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { ProjectConflictError, ProjectLibraryDatabase, scanProjectLibrary, scanProjectRecords } from "./project-library";
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
});
