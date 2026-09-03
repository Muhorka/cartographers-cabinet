import "fake-indexeddb/auto";
import Dexie from "dexie";
import { act, createRef, forwardRef, type ReactNode, useImperativeHandle } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import type { EditorProject } from "../model/project-model";
import { ProjectLibraryDatabase } from "../persistence/project-library-database";
import { useProjectAutosave } from "./use-project-autosave";

const fixture = vi.hoisted(() => ({
  database: undefined as ProjectLibraryDatabase | undefined,
  revisions: new Map<string, number>(),
  saveProject: vi.fn(),
  saveStoryDocuments: vi.fn(),
}));

vi.mock("../persistence/project-library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../persistence/project-library")>();
  return {
    ...actual,
    saveProject: fixture.saveProject,
    saveStoryDocuments: fixture.saveStoryDocuments,
    persistedProjectRevision: (project: EditorProject) => fixture.revisions.get(project.id),
    persistedProjectRevisionForId: (id: string) => fixture.revisions.get(id),
  };
});

type HarnessControls = Pick<ReturnType<typeof useProjectAutosave>, "flush" | "saveStoryDocuments">;

const Harness = forwardRef<HarnessControls, { project: EditorProject }>(function Harness({ project }, ref): ReactNode {
  const controls = useProjectAutosave(project, vi.fn());
  useImperativeHandle(ref, () => ({ flush: controls.flush, saveStoryDocuments: controls.saveStoryDocuments }), [controls.flush, controls.saveStoryDocuments]);
  return null;
});

describe("useProjectAutosave notebook promotion", () => {
  let databaseName: string;
  let project: EditorProject;
  let host: HTMLDivElement;
  let root: Root;
  let controlsRef: ReturnType<typeof createRef<HarnessControls>>;

  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    databaseName = `cartographers-cabinet-autosave-${crypto.randomUUID()}`;
    fixture.database = new ProjectLibraryDatabase(databaseName, { captureAlternateVersionThree: false });
    await fixture.database.open();
    project = createStarterProject("pending-full", "Pending full", "en");
    const initial = await fixture.database.saveProject(project);
    fixture.revisions.clear(); fixture.revisions.set(project.id, initial.revision);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fixture.saveProject.mockReset().mockImplementation(async (candidate: EditorProject, expectedRevision?: number) => {
      const result = await fixture.database!.saveProject(candidate, expectedRevision);
      fixture.revisions.set(candidate.id, result.revision);
      return result.project;
    });
    fixture.saveStoryDocuments.mockReset().mockImplementation(async (candidate: EditorProject, expectedRevision?: number) => {
      const result = await fixture.database!.saveStoryDocuments(candidate.id, candidate.story.documents, expectedRevision);
      fixture.revisions.set(candidate.id, result.revision);
      return { ...candidate, updatedAt: result.updatedAt };
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    controlsRef = createRef<HarnessControls>();
    await act(async () => root.render(<Harness ref={controlsRef} project={project}/>));
    await act(async () => vi.advanceTimersByTimeAsync(400));
    fixture.saveProject.mockClear(); fixture.saveStoryDocuments.mockClear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (root) act(() => root.unmount()); if (host) host.remove();
    fixture.database?.close(); fixture.database = undefined;
    await Dexie.delete(databaseName);
    vi.unstubAllGlobals();
  });

  it("promotes a pending full save when the notebook changes", async () => {
    const mapChanged = { ...project, places: project.places.map((place, index) => index === 0 ? { ...place, name: "Changed map" } : place) };
    const documents = [{ id: "note", title: "Worldbook note", bodyMarkdown: "Current", references: [] }];
    const withDocuments = { ...mapChanged, story: { ...mapChanged.story, documents } };
    await act(async () => root.render(<Harness ref={controlsRef} project={mapChanged}/>));

    let outcome!: Awaited<ReturnType<HarnessControls["saveStoryDocuments"]>>;
    await act(async () => { outcome = await controlsRef.current!.saveStoryDocuments(withDocuments); });

    expect(outcome.state).toBe("saved");
    expect(fixture.saveProject).toHaveBeenCalledOnce();
    expect(fixture.saveStoryDocuments).not.toHaveBeenCalled();
    expect((await fixture.database!.projects.get(project.id))?.places[0]?.name).toBe("Changed map");
    expect((await fixture.database!.projects.get(project.id))?.story.documents).toEqual(documents);
    expect(await fixture.database!.storyDocuments.get(project.id)).toBeUndefined();
  });

  it("uses documents-only after the full-save timer has already fired", async () => {
    const mapChanged = { ...project, places: project.places.map((place, index) => index === 0 ? { ...place, name: "Changed map" } : place) };
    const documents = [{ id: "note", title: "Notebook only", bodyMarkdown: "Later", references: [] }];
    await act(async () => root.render(<Harness ref={controlsRef} project={mapChanged}/>));
    await act(async () => vi.advanceTimersByTimeAsync(350));
    await act(async () => { await controlsRef.current!.flush(mapChanged); });
    fixture.saveProject.mockClear(); fixture.saveStoryDocuments.mockClear();

    await act(async () => controlsRef.current!.saveStoryDocuments({ ...mapChanged, story: { ...mapChanged.story, documents } }));

    expect(fixture.saveProject).not.toHaveBeenCalled();
    expect(fixture.saveStoryDocuments).toHaveBeenCalledOnce();
    expect(await fixture.database!.storyDocuments.get(project.id)).toMatchObject({ documents });
  });
});
