import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { scanProjectLibrary, scanProjectRecords } from "./project-library";

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
