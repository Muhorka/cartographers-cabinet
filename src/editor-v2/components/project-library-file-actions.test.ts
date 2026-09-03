// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { projectLibraryFileActions } from "./project-library-file-actions";

const fileExport = vi.hoisted(() => vi.fn());
vi.mock("../persistence/project-file-browser", () => ({ exportProjectFile: fileExport }));

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

  it("exports the live active project instead of its stale rendered snapshot", () => {
    const snapshot = createStarterProject("live", "Snapshot", "en");
    const live = structuredClone(snapshot); live.story.documents = [{ id: "note", title: "Latest", bodyMarkdown: "Current text", references: [] }];
    const actions = projectLibraryFileActions({
      snapshot: { project: snapshot, activePlaceId: snapshot.id, selection: [], boundaryEditing: false, toolbox: {} as never },
      projects: [snapshot], getActiveProject: () => live, locale: "en", onError: vi.fn(), onImport: vi.fn(),
    });
    actions.exportProject(live.id);
    expect(fileExport).toHaveBeenCalledWith(live);
  });
});
