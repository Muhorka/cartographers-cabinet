import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSheet } from "./map-sheet";
import type { EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { defaultStoryAccessPolicy } from "../story/types";
import { EditorWorkbench } from "./editor-workbench";
import { selectionKey } from "../drawing/selection-reference";

const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined }));
vi.mock("../persistence/project-library", async (original) => ({
  ...await original<typeof import("../persistence/project-library")>(),
  scanProjectLibrary: async () => ({ projects: [fixture.project!], recoveryRecords: [] }), getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:world" : undefined,
  setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: async (project: EditorProject) => project,
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn() }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas"/>; } }));

let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
const button = (name: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((element) => element.textContent === name)!;
const click = (name: string, scope: ParentNode = host) => act(() => button(name, scope).click());
const state = () => fixture.sheet!.project;
const editor = () => host.querySelector('section[aria-label="Warsztat scenariusza"]')!;
const inputText = (element: HTMLInputElement, value: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.useFakeTimers();
  fixture.project = createStarterProject("p", "Synthetic scene flow", "pl");
  const target = { kind: "room" as const, id: fixture.project.constructions[0].rooms[0].id, scopeId: "p:plan" };
  fixture.project.story.world = [{ id: "anna", kind: "character", name: "Anna", tags: [], properties: {} }];
  fixture.project.story.objects = [{ ref: target, metadata: { access: { ...defaultStoryAccessPolicy(), permission: "restricted", allow: ["anna"] } } }];
  fixture.project.story.scenarios = [{ id: "night", name: "Noc", patches: [{ id: "whole", target, description: "Nocny pokój" }], steps: [{ id: "alarm", name: "Alarm", patches: [{ id: "step", target, description: "Pokój po alarmie" }] }] }];
  fixture.project.story.intentions = [{ id: "permission", kind: "access-rule", text: "Anna ma wstęp", subject: target, accessEntryId: "anna", status: "accepted" }];
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>)); click("Opowieść");
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("scenario workspace through the real editor session", () => {
  it("opens a scenario effect on its exact floor, resets just the step and supports Undo", () => {
    const walls = structuredClone(state().constructions[0].walls);
    click("Warsztat scenariusza");
    expect(editor().textContent).toContain("Nocny pokój");
    click("Alarm", editor());
    expect(editor().textContent).toContain("Pokój po alarmie");
    click("Edytuj skutek", editor());
    expect(fixture.sheet!.activePlaceId).toBe("p:level");
    expect(fixture.sheet!.selectedIds).toContain(selectionKey({ kind: "room", id: state().constructions[0].rooms[0].id, scopeId: "p:plan" }));
    expect(host.querySelector('aside[aria-label="Opis i powiązania"]')?.textContent).toContain("Pokój po alarmie");
    click("Usuń tylko ten skutek", editor());
    expect(state().story.scenarios[0].steps[0].patches).toEqual([]);
    expect(state().story.scenarios[0].patches[0].description).toBe("Nocny pokój");
    expect(state().constructions[0].walls).toEqual(walls);
    click("Cofnij");
    expect(state().story.scenarios[0].steps[0].patches[0].description).toBe("Pokój po alarmie");
    inputText(editor().querySelector("input")!, "Noc po zmianie");
    expect(state().story.scenarios[0].steps[0].patches[0].description).toBe("Pokój po alarmie");
    click("Cofnij"); expect(editor().querySelector("input")!.value).toBe("Noc");
  });

  it("adds a step and returns to whole-scene context when its creation is undone", () => {
    click("Warsztat scenariusza"); click("Dodaj krok", editor());
    expect(state().story.scenarios[0].steps).toHaveLength(2);
    click("Cofnij");
    expect(state().story.scenarios[0].steps).toHaveLength(1);
    expect(editor()).not.toBeNull(); expect(editor().textContent).toContain("Nocny pokój");
    click("Przywróć widok podstawowy");
    expect(state().story.scenarios[0].patches[0].description).toBe("Nocny pokój");
  });

  it("checks selected intentions without editing authored statuses or widening an empty selection", async () => {
    click("Sprawdź założenia sceny");
    const panel = host.querySelector('section[aria-label="Sprawdź założenia sceny"]')!;
    expect(panel.textContent).toContain("Intencje w zakresie (0)");
    expect(button("Sprawdź założenia", panel).disabled).toBe(true);
    act(() => (panel.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    await act(async () => button("Sprawdź założenia", panel).click());
    expect(panel.textContent).toContain("Reguły pozwalają na dostęp.");
    expect(panel.textContent).toContain("Fizyczną możliwość dotarcia do niego ocenia osobno trasa.");
    expect(state().story.intentions[0].status).toBe("accepted");
    expect(state().story.routes).toEqual([]);
    click("Edytuj założenia");
    expect(host.textContent).toContain("Rodzaj celu");
    expect(host.textContent).not.toContain("Jakiej strefy ma unikać?");
  });
});
