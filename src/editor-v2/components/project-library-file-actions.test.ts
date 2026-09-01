// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { projectLibraryFileActions } from "./project-library-file-actions";

describe("project library view export errors", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("handles the missing embedded font in Polish without rejecting the handler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const project = createStarterProject("pdf", "Łąka", "pl"); const original = structuredClone(project); const onError = vi.fn();
    const actions = projectLibraryFileActions({ projects: [project], locale: "pl", onError, onImport: vi.fn() });
    await expect(actions.exportView(project.id, "pdf")).resolves.toBeUndefined();
    const message = onError.mock.calls.at(-1)?.[0];
    expect(message).toContain("wczytać czcionki");
    expect(message).toContain("Projekt nie został zmieniony");
    expect(project).toEqual(original);
  });
});
