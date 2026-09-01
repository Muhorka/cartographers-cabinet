import { describe, expect, it } from "vitest";
import { serializeProjectRecovery } from "./project-file-browser";

describe("project recovery export", () => {
  it("preserves the raw record and its Dexie primary key", () => {
    const rawRecord = { id: "record-id", places: [{ malformed: true }], extra: "untouched" };
    const value = JSON.parse(serializeProjectRecovery({ primaryKey: "actual-primary-key", rawRecord, reason: "invalid" }, "2026-09-02T00:00:00.000Z"));
    expect(value).toEqual({ format: "cartographers-cabinet.project-recovery", fileVersion: 1, exportedAt: "2026-09-02T00:00:00.000Z", primaryKey: "actual-primary-key", rawRecord });
  });
});
