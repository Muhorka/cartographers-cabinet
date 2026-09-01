import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import type { MapSheet } from "./map-sheet";
import { EditorWorkbench } from "./editor-workbench";

const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined }));
vi.mock("../persistence/project-library", async (original) => ({ ...await original<typeof import("../persistence/project-library")>(), scanProjectLibrary: async () => ({ projects: [fixture.project!], recoveryRecords: [] }), getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:level" : undefined, setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: async (project: EditorProject) => project }));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn() }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas"/>; } }));

let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
const panel = () => host.querySelector('aside[aria-label="Opis i powiązania"]')!;
const button = (name: string) => [...host.querySelectorAll("button")].find((element) => element.textContent === name || element.getAttribute("aria-label") === name)!;
const click = (name: string) => act(() => button(name).click());
const nameField = () => [...panel().querySelectorAll("label")].find((label) => label.textContent?.includes("Nazwa"))?.querySelector("input") as HTMLInputElement;
function setNative(element: HTMLInputElement, value: string) { act(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; element.focus(); setter?.call(element, value); element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })); element.dispatchEvent(new Event("change", { bubbles: true })); }); }

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const project = createStarterProject("p", "Inspector focus", "pl");
  fixture.project = { ...project, places: project.places.map((place) => place.kind === "building" ? { ...place, name: "Dom testowy" } : place.kind === "level" ? { ...place, name: "Parter" } : place) };
  fixture.sheet = undefined; host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("workbench inspected place flow", () => {
  it("edits a building while displaying its level, then switches the inspector without moving the map", () => {
    const project = fixture.sheet!.project; const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ kind }) => kind === "level")!;
    const initialViewport = structuredClone(fixture.sheet!.viewport); click(`Otwórz poziom mapy: ${building.name}`);

    expect(fixture.sheet!.activePlaceId).toBe(level.id); expect(fixture.sheet!.viewport).toEqual(initialViewport); expect(fixture.sheet!.selectedIds).toEqual([]);
    expect(host.querySelector('[aria-label="Kontekst inspektora"]')?.textContent).toContain(`Edytujesz budynek „${building.name}”`);
    expect(host.querySelector('[aria-label="Kontekst inspektora"]')?.textContent).toContain(`kondygnacja „${level.name}”`);
    const buildingItem = button(`Otwórz poziom mapy: ${building.name}`).closest('[role="treeitem"]')!;
    const levelItem = button(`Otwórz poziom mapy: ${level.name}`).closest('[role="treeitem"]')!;
    expect(buildingItem.getAttribute("aria-selected")).toBe("true"); expect(buildingItem.hasAttribute("aria-current")).toBe(false);
    expect(levelItem.getAttribute("aria-selected")).toBe("false"); expect(levelItem.getAttribute("aria-current")).toBe("page");
    expect(nameField().value).toBe(building.name);

    click(`Otwórz poziom mapy: ${level.name}`);
    expect(fixture.sheet!.activePlaceId).toBe(level.id); expect(fixture.sheet!.viewport).toEqual(initialViewport); expect(nameField().value).toBe(level.name);
    expect(host.querySelector('[aria-label="Kontekst inspektora"]')).toBeNull();
    click(`Otwórz poziom mapy: ${building.name}`); expect(nameField().value).toBe(building.name);

    setNative(nameField(), "Dwór po zmianie"); click("Zapisz");
    expect(fixture.sheet!.project.places.find(({ id }) => id === building.id)?.name).toBe("Dwór po zmianie");
    expect(fixture.sheet!.project.places.find(({ id }) => id === level.id)?.name).toBe(level.name);

    const viewport = structuredClone(fixture.sheet!.viewport); click("Edytuj kondygnację");
    expect(fixture.sheet!.activePlaceId).toBe(level.id); expect(fixture.sheet!.viewport).toEqual(viewport); expect(fixture.sheet!.selectedIds).toEqual([]);
    expect(nameField().value).toBe(level.name); expect(host.querySelector('[aria-label="Kontekst inspektora"]')).toBeNull();
  });

  it("gives an explicit map selection priority without losing the hierarchy focus", () => {
    const project = fixture.sheet!.project; const building = project.places.find(({ kind }) => kind === "building")!; const level = project.places.find(({ kind }) => kind === "level")!; const world = project.places.find(({ kind }) => kind === "world")!;
    click(`Otwórz poziom mapy: ${building.name}`); act(() => fixture.sheet!.onSelect?.({ kind: "place", id: world.id }));
    expect(nameField().value).toBe(world.name); expect(host.querySelector('[aria-label="Kontekst inspektora"]')).toBeNull();
    act(() => fixture.sheet!.onSelect?.({ kind: "place", id: level.id }, true));
    expect(panel().textContent).toContain("Edytujesz: 2 obiektów"); expect(host.querySelector('[aria-label="Kontekst inspektora"]')).toBeNull();
    act(() => fixture.sheet!.onClearSelection?.());
    expect(nameField().value).toBe(building.name); expect(host.querySelector('[aria-label="Kontekst inspektora"]')).toBeTruthy();
    click("Opowieść"); expect(nameField().value).toBe(building.name);
  });
});
