import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSheet } from "./map-sheet";
import { EditorWorkbench } from "./editor-workbench";
import { createStarterProject } from "../model/starter-project";
import { defaultStoryAccessPolicy, type StoryObjectRef } from "../story/types";
import { createProjectCheckpoint, type ProjectCheckpoint } from "../persistence/project-checkpoint";
import type { EditorProject } from "../model/project-model";
import type { EditorSession } from "../state/editor-session";
import type { CommandBridge } from "../webmcp/editor-command-coordinator";
import { EditorCommandCoordinator } from "../webmcp/editor-command-coordinator";

type CapturedActions = { preserveAgentChange?: CommandBridge["preserveAgentChange"]; reportAgentChange?: CommandBridge["reportAgentChange"] };
const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, session: undefined as EditorSession | undefined, actions: undefined as CapturedActions | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined, checkpoint: undefined as ProjectCheckpoint | undefined, save: vi.fn() }));

vi.mock("../persistence/project-library", async (original) => ({
  ...await original<typeof import("../persistence/project-library")>(),
  scanProjectLibrary: async () => ({ projects: fixture.project ? [fixture.project] : [], recoveryRecords: [] }),
  getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:proposal-ui" ? "proposal-ui:level" : undefined,
  setPreference: async () => {},
  listProjectCheckpoints: async () => [],
  readProjectCheckpoint: async (id: string) => fixture.checkpoint?.id === id ? fixture.checkpoint : undefined,
  saveProjectCheckpoint: fixture.save,
  saveProject: async (project: EditorProject) => project,
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn((session: EditorSession, _activePlaceId: string | undefined, actions: CapturedActions) => { fixture.session = session; fixture.actions = actions; }) }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas"/>; } }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function projectFixture() {
  const project = createStarterProject("proposal-ui", "Synthetic proposal UI", "pl");
  const ref: StoryObjectRef = { kind: "room", id: project.constructions[0]!.rooms[0]!.id, scopeId: project.constructions[0]!.id };
  project.story.world = [
    { id: "alice", kind: "character", name: "Alice", tags: [], properties: {} },
    { id: "bob", kind: "character", name: "Bob", tags: [], properties: {} },
  ];
  project.story.objects = [{ ref, metadata: { owners: ["alice"], access: { ...defaultStoryAccessPolicy(), lock: "none" } } }];
  project.story.scenarios = [{ id: "night", name: "Night", patches: [], steps: [{ id: "lock", name: "Lock", patches: [{ id: "room-lock", target: ref, metadata: { owners: ["alice"], access: { ...defaultStoryAccessPolicy(), lock: "none" } } }] }] }];
  return project;
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.project = projectFixture(); fixture.session = undefined; fixture.actions = undefined; fixture.sheet = undefined; fixture.checkpoint = undefined; fixture.save.mockReset();
  fixture.save.mockImplementation(async (project: EditorProject, name: string, input: { kind?: ProjectCheckpoint["kind"]; baseSnapshot?: EditorProject; summary?: string } = {}) => {
    const checkpoint = createProjectCheckpoint(project, { id: "proposal-ui-checkpoint", name, kind: input.kind, baseSnapshot: input.baseSnapshot, summary: input.summary });
    fixture.checkpoint = checkpoint;
    return checkpoint;
  });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>));
});

afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("proposal review in the real editor shell", () => {
  it("shows named before/proposed values while preserving the live project and history", async () => {
    expect(fixture.session).toBeDefined(); expect(fixture.actions?.preserveAgentChange).toBeTypeOf("function");
    const session = fixture.session!; const before = structuredClone(session.getState().project); const history = session.getHistoryState();
    const after = structuredClone(before);
    after.story.objects[0]!.metadata.owners = ["bob"];
    after.story.scenarios[0]!.steps[0]!.patches[0]!.metadata = { owners: ["alice"], access: { ...defaultStoryAccessPolicy(), lock: "locked" } };
    const coordinator = new EditorCommandCoordinator({ getSession: () => session, refresh: vi.fn(), preserveAgentChange: fixture.actions!.preserveAgentChange, reportAgentChange: fixture.actions!.reportAgentChange });
    const prepared = coordinator.prepare("proposal-ui-change", () => ({ project: after, summary: "Propose owner and lock" }));
    expect(prepared.status).toBe("prepared");
    if (prepared.status !== "prepared") return;
    let result: Awaited<ReturnType<EditorCommandCoordinator["propose"]>> | undefined;
    await act(async () => { result = await coordinator.propose(prepared.token); });
    expect(result?.status).toBe("proposed"); expect(fixture.checkpoint?.kind).toBe("proposal");
    if (result?.status !== "proposed" || result.semanticChanges?.status !== "ready") return;
    expect(session.getViewState().project).toEqual(before); expect(session.getHistoryState()).toEqual(history);
    const notice = host.querySelector('section[aria-label="Zmiana agenta"]');
    expect(notice).not.toBeNull(); expect(notice?.textContent).toContain("Propose owner and lock");
    const domRows = [...(notice?.querySelectorAll("[data-change-field]") ?? [])];
    expect(domRows).toHaveLength(result.semanticChanges.rows.length);
    for (const domRow of domRows) {
      const expected = result.semanticChanges.rows.find(({ fieldKey }) => fieldKey === domRow.getAttribute("data-change-field"));
      expect(expected).toBeDefined();
      if (!expected) continue;
      const text = domRow.textContent ?? ""; const display = expected.display.pl;
      expect(text).toContain(display.field);
      const values = [...domRow.querySelectorAll("dd")].map((value) => value.textContent ?? "");
      expect(values[0]).toContain(display.authoredBefore); expect(values[0]).toContain(display.authoredAfter);
      expect(values[1]).toContain(display.effectiveBefore); expect(values[1]).toContain(display.effectiveAfter);
    }
  });
});
