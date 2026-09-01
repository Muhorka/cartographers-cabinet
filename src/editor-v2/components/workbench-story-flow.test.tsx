import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSheet } from "./map-sheet";
import type { EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { effectiveProjectStoryObject } from "../story/project-effective";
import { evaluateProjectLens } from "../story/evaluation";
import { storyAccessDecision } from "../story/routes/access";
import { defaultStoryAccessPolicy } from "../story/types";
import type { EditorLiveContext, EditorStoryView, StoryViewUpdateResult } from "../webmcp/editor-context";
import { EditorWorkbench } from "./editor-workbench";

type WorkbenchAgentActions = { getEditorContext?(): EditorLiveContext; setStoryView?(view: EditorStoryView): StoryViewUpdateResult | void };
const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, saved: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined, actions: undefined as WorkbenchAgentActions | undefined }));
vi.mock("../persistence/project-library", async (original) => ({
  ...await original<typeof import("../persistence/project-library")>(),
  scanProjectLibrary: async () => ({ projects: [fixture.project!], recoveryRecords: [] }), getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:level" : undefined,
  setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: async (project: EditorProject) => { fixture.saved = structuredClone(project); return project; },
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn((_session: unknown, _activePlaceId: unknown, actions: WorkbenchAgentActions) => { fixture.actions = actions; }) }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas"/>; } }));

let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
const control = (name: string) => [...host.querySelectorAll<HTMLElement>("button, summary")].find((element) => element.textContent === name)!;
const click = (name: string) => act(() => control(name).click());
const state = () => fixture.sheet!.project;
const panel = () => host.querySelector('aside[aria-label="Opis i powiązania"]')!;
const inputText = (element: HTMLInputElement, value: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
const fieldset = (legend: string) => [...panel().querySelectorAll("fieldset")].find((element) => element.querySelector("legend")?.textContent === legend)!;
const check = (scope: Element, text: string) => act(() => { const label = [...scope.querySelectorAll("label")].find((element) => element.textContent?.trim() === text)!; (label.querySelector("input") as HTMLInputElement).click(); });
const roomRef = () => ({ kind: "room" as const, id: state().constructions[0].rooms[0].id, scopeId: "p:plan" });

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.useFakeTimers();
  fixture.project = createStarterProject("p", "Synthetic Story UI", "pl");
  fixture.project.story.world = [{ id: "anna", kind: "character", name: "Anna", tags: [], properties: {} }];
  fixture.project.story.lenses = [{ id: "owner", name: "Własność Anny", color: "#9e4439", expression: { kind: "predicate", predicate: { kind: "owner", entryId: "anna" } } }];
  fixture.project.story.scenarios = [{ id: "night", name: "Noc", patches: [], steps: [] }];
  fixture.project.constructions[0].openings = [{ id: "door", wallId: fixture.project.constructions[0].walls[0].id, kind: "door", position: .5, width: 1 }];
  fixture.project.story.objects = [{ ref: { kind: "opening", id: "door", scopeId: "p:plan" }, metadata: { access: { ...defaultStoryAccessPolicy(), lock: "locked", physicalState: "closed" } } }];
  fixture.saved = undefined; fixture.sheet = undefined; fixture.actions = undefined;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>)); click("Opowieść");
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Story works through the real editor shell, selection and session", () => {
  it("routes agent scenario and neutral views through the real mode bridge", () => {
    click("Kreślenie");
    expect(fixture.actions!.getEditorContext!()).toMatchObject({ mode: "drawing", view: {} });
    let result: StoryViewUpdateResult | void = undefined;
    act(() => { result = fixture.actions!.setStoryView!({ scenarioId: "night", editTarget: "scenario" }); });
    expect(result).toEqual({ status: "applied" });
    expect(fixture.actions!.getEditorContext!()).toMatchObject({ mode: "story", view: { scenarioId: "night", editTarget: "scenario" } });
    act(() => { result = fixture.actions!.setStoryView!({ scenarioId: undefined, stepId: undefined, lensId: undefined, routeId: undefined, editTarget: "base" }); });
    expect(result).toEqual({ status: "applied" });
    expect(fixture.actions!.getEditorContext!()).toMatchObject({ mode: "story", view: { editTarget: "base" } });
    expect(fixture.actions!.getEditorContext!().view.scenarioId).toBeUndefined();
  });

  it("defers an agent scenario view while a drawing draft needs a user decision", () => {
    click("Kreślenie");
    act(() => fixture.sheet!.onGestureDraftChange?.({ instrumentId: "polygon", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }));
    let result: StoryViewUpdateResult | void = undefined;
    act(() => { result = fixture.actions!.setStoryView!({ scenarioId: "night", editTarget: "scenario" }); });
    expect(result).toEqual({ status: "deferred", reason: "draft" });
    expect(fixture.actions!.getEditorContext!()).toMatchObject({ mode: "drawing", view: {} });
  });

  it("passes selection-only mode and saves a chosen owner used by the lens without a separate tag", () => {
    expect(fixture.sheet!.selectionOnly).toBe(true);
    const beforeWalls = structuredClone(state().constructions[0].walls);
    act(() => fixture.sheet!.onSelect?.({ kind: "room", id: roomRef().id }));
    expect(panel().textContent).toContain("Do kogo należy?");
    expect(host.querySelectorAll('input[readonly]')).toHaveLength(0);
    check(fieldset("Do kogo należy?"), "Anna"); click("Zapisz");
    expect(effectiveProjectStoryObject(state(), roomRef())?.metadata.owners).toEqual(["anna"]);
    expect(evaluateProjectLens(state(), state().story, "owner", roomRef())?.match).toBe(true);
    expect(state().story.objects.find(({ ref }) => ref.id === roomRef().id)?.metadata.tags).toBeUndefined();
    expect(state().constructions[0].walls).toEqual(beforeWalls);
    click("Cofnij"); expect(effectiveProjectStoryObject(state(), roomRef())?.metadata.owners ?? []).toEqual([]);
  });

  it("keeps mixed multi-selection and creates one shared trait for every selected object", () => {
    const room = roomRef(); act(() => fixture.sheet!.onSelect?.({ kind: "room", id: room.id }));
    act(() => fixture.sheet!.onSelect?.({ kind: "place", id: "p:building" }, true));
    expect(fixture.sheet!.selectedIds).toEqual([room.id, "p:building"]);
    expect(panel().textContent).toContain("Edytujesz: 2 obiektów");
    click("Nowa cecha…");
    inputText(panel().querySelector("form input") as HTMLInputElement, "Romantyczne"); click("Dodaj i przypisz");
    const definition = state().story.propertyDefinitions.find(({ name }) => name === "Romantyczne")!;
    expect(definition.type).toBe("boolean");
    for (const ref of [room, { kind: "place" as const, id: "p:building" }]) expect(effectiveProjectStoryObject(state(), ref)?.metadata.properties?.[definition.id]).toBe(true);
    click("Cofnij"); expect(state().story.propertyDefinitions).toHaveLength(0);
  });

  it("assigns a named door key through UI, updates Anna and preserves the real route policy", () => {
    const ref = { kind: "opening" as const, id: "door", scopeId: "p:plan" };
    expect(storyAccessDecision(state(), ref, { actorId: "anna" })).toMatchObject({ allowed: false });
    act(() => fixture.sheet!.onSelect?.({ kind: "opening", id: "door" }));
    expect(panel().textContent).toContain("Edytujesz: Drzwi 1");
    expect(panel().textContent).toContain("Kto ma klucz do tych drzwi?");
    const doors = panel().querySelector('section[aria-label="Klucze drzwi"]')!;
    act(() => (doors.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    click("Utwórz klucz i zapisz");
    const key = state().story.world.find(({ kind }) => kind === "key")!;
    expect(state().story.memberships).toContainEqual({ subjectId: "anna", groupId: key.id, kind: "holds-key", source: "manual" });
    expect(effectiveProjectStoryObject(state(), ref)?.metadata.access?.keyIds).toEqual([key.id]);
    expect(storyAccessDecision(state(), ref, { actorId: "anna" })).toMatchObject({ allowed: true, conditions: ["Unlock and open door."] });
    click("Księga świata");
    expect(host.textContent).toContain("Posiadane klucze otwierają");
    expect(host.textContent).toContain(key.name);
  });

  it("creates and assigns an owner inline as one undoable change", () => {
    act(() => fixture.sheet!.onSelect?.({ kind: "room", id: roomRef().id }));
    click("Nowy właściciel…"); inputText(panel().querySelector("form input") as HTMLInputElement, "Beata"); click("Dodaj i przypisz");
    const beata = state().story.world.find(({ name }) => name === "Beata")!;
    expect(beata.kind).toBe("character"); expect(effectiveProjectStoryObject(state(), roomRef())?.metadata.owners).toContain(beata.id);
    click("Cofnij"); expect(state().story.world.some(({ name }) => name === "Beata")).toBe(false);
  });
});
