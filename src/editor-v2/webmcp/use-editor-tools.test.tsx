import { act, createElement, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { projectRevision } from "../state/project-revision";
import type { EditorSession } from "../state/editor-session";
import { useEditorV2Tools } from "./use-editor-tools";
import { registerEditorV2Tools, type EditorToolBridge } from "./register-editor-tools";

vi.mock("./register-editor-tools", () => ({ registerEditorV2Tools: vi.fn() }));
vi.mock("./diagnostics", () => ({ reportWebMcpDiagnostics: vi.fn() }));
vi.mock("../persistence/project-library", () => ({ readProjectCheckpoint: vi.fn() }));

type Actions = Parameters<typeof useEditorV2Tools>[2];
type Registration = Awaited<ReturnType<typeof registerEditorV2Tools>>;

const makeProject = (id: string, revision: number) => emptyProject(id, `Project ${revision}`);
const makeSession = (project: EditorProject) => ({
  getState: () => ({ project: structuredClone(project) }),
  getViewState: () => ({ project }),
} as unknown as EditorSession);
const makeActions = (refresh: () => void): Actions => ({
  refresh,
  openPlace: () => true,
  focusObjects: () => true,
  clearFocus: () => undefined,
  getCheckpoints: () => [],
  createCheckpoint: async () => undefined,
  deleteCheckpoint: async () => true,
  showCheckpoint: () => true,
  getProjects: () => [],
  createProject: async () => undefined,
  openProject: async () => true,
  duplicateProject: async () => undefined,
  renameProject: async () => undefined,
  deleteProject: async () => true,
});

function Probe({ session, activePlaceId, actions, locale, onLayout }: { session: EditorSession | undefined; activePlaceId: string | undefined; actions: Actions; locale: "en" | "pl"; onLayout?: () => void }) {
  useEditorV2Tools(session, activePlaceId, actions, locale);
  useLayoutEffect(() => { onLayout?.(); }, [onLayout, session]);
  return null;
}

describe("useEditorV2Tools lifecycle", () => {
  let root: Root;
  let host: HTMLDivElement;
  let bridges: EditorToolBridge[];
  let registrations: Registration[];

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    bridges = []; registrations = [];
    vi.mocked(registerEditorV2Tools).mockReset();
    vi.mocked(registerEditorV2Tools).mockImplementation(async (bridge) => {
      const registration: Registration = { available: true, registered: 1, dispose: vi.fn() };
      bridges.push(bridge); registrations.push(registration); return registration;
    });
  });

  afterEach(() => { act(() => root.unmount()); host.remove(); vi.clearAllMocks(); });

  it("routes callbacks to the replacement session, place, locale, and actions", async () => {
    const projectA = makeProject("project-a", 1); const projectB = makeProject("project-b", 7);
    const sessionA = makeSession(projectA); const sessionB = makeSession(projectB);
    const refreshA = vi.fn(); const refreshB = vi.fn();
    const actionsA = makeActions(refreshA); const actionsB = makeActions(refreshB);
    let observedProject: EditorProject | undefined;
    const observeLayout = () => { const bridge = bridges[0]; if (bridge) observedProject = bridge.getProject(); };

    await act(async () => { root.render(createElement(Probe, { session: sessionA, activePlaceId: "place-a", actions: actionsA, locale: "en", onLayout: observeLayout })); await Promise.resolve(); });
    await act(async () => { root.render(createElement(Probe, { session: sessionB, activePlaceId: "place-b", actions: actionsB, locale: "pl", onLayout: observeLayout })); await Promise.resolve(); });

    expect(bridges).toHaveLength(1);
    const bridge = bridges[0];
    expect(observedProject).toBe(projectB);
    expect(bridge.getSession()).toBe(sessionB);
    expect(bridge.getProject()).toBe(projectB);
    expect(bridge.getProject().id).toBe("project-b"); expect(projectRevision(bridge.getProject())).toBe(projectRevision(projectB));
    expect(bridge.getActivePlaceId()).toBe("place-b");
    expect(bridge.getLocale?.()).toBe("pl");
    bridge.refresh();
    expect(refreshA).not.toHaveBeenCalled(); expect(refreshB).toHaveBeenCalledTimes(1);
  });

  it("disposes a late registration after the hook unmounts", async () => {
    let resolveRegistration: ((registration: Registration) => void) | undefined;
    vi.mocked(registerEditorV2Tools).mockImplementationOnce((bridge) => {
      bridges.push(bridge);
      return new Promise<Registration>((resolve) => { resolveRegistration = resolve; });
    });
    const lateDispose = vi.fn();
    const session = makeSession(makeProject("project", 1));

    await act(async () => { root.render(createElement(Probe, { session, activePlaceId: "place", actions: makeActions(vi.fn()), locale: "en" })); });
    expect(resolveRegistration).toBeDefined();
    act(() => root.unmount());
    await act(async () => { resolveRegistration!({ available: true, registered: 1, dispose: lateDispose }); await Promise.resolve(); });

    expect(lateDispose).toHaveBeenCalledTimes(1);
    expect(registrations).toHaveLength(0);
  });
});
