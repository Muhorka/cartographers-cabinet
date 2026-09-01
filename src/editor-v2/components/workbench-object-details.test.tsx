import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSheet } from "./map-sheet";
import type { EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { defaultStoryAccessPolicy, type StoryObjectRef } from "../story/types";
import { effectiveProjectStoryObject } from "../story/project-effective";
import { evaluateProjectLens } from "../story/evaluation";
import { storyAccessDecision } from "../story/routes/access";
import { EditorWorkbench } from "./editor-workbench";
import { EditorSession } from "../state/editor-session";

const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined }));
vi.mock("../persistence/project-library", async (original) => ({ ...await original<typeof import("../persistence/project-library")>(), listSavedProjects: async () => [fixture.project!], getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:level" : undefined, setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: async (project: EditorProject) => project }));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn() }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas"/>; } }));

let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
const panel = () => host.querySelector('aside[aria-label="Opis i powiązania"]')!;
const state = () => fixture.sheet!.project;
const button = (name: string) => [...host.querySelectorAll("button")].find((element) => element.textContent === name || element.getAttribute("aria-label") === name || element.title === name)!;
const click = (name: string) => act(() => button(name).click());
const select = (ref: StoryObjectRef, additive = false) => act(() => fixture.sheet!.onSelect?.({ kind: ref.kind, id: ref.id }, additive));
const setNative = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => { const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set; element.focus(); setter?.call(element, value); element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })); element.dispatchEvent(new Event("change", { bubbles: true })); });
function storyField(part: string) { return [...panel().querySelectorAll("label")].find((label) => label.textContent?.includes(part))?.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement | undefined; }
function openDetails() { for (const summary of [...panel().querySelectorAll("summary")]) if (!summary.parentElement?.hasAttribute("open")) act(() => summary.click()); }
function saveDetails(name: string, description: string) { setNative(storyField("Nazwa")!, name); setNative(storyField("Opis")!, description); openDetails(); const trait = [...panel().querySelectorAll("label")].find((label) => label.textContent?.includes("Tajny"))?.querySelector("input") as HTMLInputElement | undefined; if (trait) act(() => { if (trait.checked) trait.click(); trait.click(); }); act(() => [...panel().querySelectorAll("button")].find((element) => element.textContent === "Zapisz")?.click()); }
function fixtureProject() {
  const project = createStarterProject("p", "Synthetic details", "pl"); const level = project.places.find(({ kind }) => kind === "level")!; const document = project.constructions.find(({ id }) => id === level.constructionId)!; const wallIds = document.walls.map(({ id }) => id);
  document.openings = (["door", "window", "gate", "passage"] as const).map((kind, index) => ({ id: kind, kind, wallId: wallIds[index % wallIds.length], position: .2 + index * .2, width: 1 }));
  document.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: -4, y: -3, width: 3, height: 3 }, sourceLevelId: level.id, sameLevelRise: true }];
  project.elements = [
    { id: "river", belongsToId: level.id, name: "River", layerId: "terrain", subjectId: "terrain.river", widthMeters: 3, geometry: { kind: "path", points: [{ x: -8, y: 0 }, { x: 8, y: 0 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} },
    { id: "painting", belongsToId: level.id, name: "Painting", layerId: "equipment", subjectId: "equipment.painting", geometry: { kind: "region", shape: { kind: "rectangle", x: 1, y: 1, width: 2, height: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
    { id: "road", belongsToId: level.id, name: "Road", layerId: "roads", subjectId: "road.paved", widthMeters: 4, geometry: { kind: "path", points: [{ x: -8, y: 5 }, { x: 8, y: 5 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} },
  ];
  project.surfaces = [{ id: "terrace", belongsToId: level.id, name: "Terrace", kind: "terrace", shape: { kind: "rectangle", x: 2, y: -6, width: 5, height: 2 }, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }];
  project.story.world = [{ id: "anna", kind: "character", name: "Anna", tags: [], properties: {} }]; project.story.propertyDefinitions = [{ id: "secret", name: "Tajny", type: "boolean" }];
  const openingRef = { kind: "opening" as const, id: "door", scopeId: document.id }; project.story.objects = [{ ref: openingRef, metadata: { owners: ["anna"], access: { ...defaultStoryAccessPolicy(), permission: "restricted", allow: ["anna"], lock: "locked", physicalState: "closed" } } }];
  project.story.lenses = [{ id: "anna-lens", name: "Anna", color: "#9e4439", expression: { kind: "predicate", predicate: { kind: "owner", entryId: "anna" } } }];
  project.story.scenarios = [{ id: "night", name: "Noc", patches: [{ id: "night-place", target: { kind: "place", id: `${project.id}:world` }, title: "Nocny świat" }], steps: [] }];
  return project;
}

beforeEach(async () => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); fixture.project = fixtureProject(); fixture.sheet = undefined; host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root.render(<EditorWorkbench/>)); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("drawing mode shared object details", () => {
  it("saves canonical name, description and boolean trait for every source kind", () => {
    const project = state(); const level = project.places.find(({ kind }) => kind === "level")!; const document = project.constructions.find(({ id }) => id === level.constructionId)!; const room = document.rooms[0];
    const selections: StoryObjectRef[] = [
      ...(["world", "place", "building", "level"] as const).map((id) => ({ kind: "place" as const, id: `p:${id}` })),
      { kind: "room", id: room.id, scopeId: document.id }, { kind: "element", id: "river" }, { kind: "element", id: "painting" }, { kind: "element", id: "road" }, { kind: "surface", id: "terrace" },
      { kind: "wall", id: document.walls[0].id, scopeId: document.id }, ...document.openings.map(({ id }) => ({ kind: "opening" as const, id, scopeId: document.id })), { kind: "transition", id: "stairs", scopeId: document.id },
    ];
    for (const [index, ref] of selections.entries()) { select(ref); saveDetails(`Nazwa ${index}`, `Opis ${index}`); const effective = effectiveProjectStoryObject(state(), ref)!; expect(effective.name).toBe(`Nazwa ${index}`); expect(effective.description).toBe(`Opis ${index}`); expect(effective.metadata.properties).toMatchObject({ secret: true }); }
  });

  it("keeps mixed drawing selection in the same common Story metadata model", () => {
    const level = state().places.find(({ kind }) => kind === "level")!; const room = state().constructions[0].rooms[0]; select({ kind: "room", id: room.id, scopeId: state().constructions[0].id }); select({ kind: "place", id: level.id }, true);
    expect(panel().textContent).toContain("Edytujesz: 2 obiektów"); openDetails(); const trait = [...panel().querySelectorAll("label")].find((label) => label.textContent?.includes("Tajny"))?.querySelector("input") as HTMLInputElement; act(() => trait.click()); click("Zapisz");
    expect(effectiveProjectStoryObject(state(), { kind: "room", id: room.id, scopeId: state().constructions[0].id })?.metadata.properties?.secret).toBe(true); expect(effectiveProjectStoryObject(state(), { kind: "place", id: level.id })?.metadata.properties?.secret).toBe(true);
  });

  it("keeps door geometry controls beside shared details and survives switching to Story", () => {
    const door = { kind: "opening" as const, id: "door", scopeId: state().constructions[0].id }; select(door); expect(panel().textContent).toContain("Edytujesz"); const width = [...host.querySelectorAll<HTMLInputElement>('input[type="number"]')].find((input) => input.value === "1") as HTMLInputElement; expect(width).toBeTruthy(); setNative(width, "1.5");
    saveDetails("Door story name", "Door story description"); expect(state().constructions[0].openings.find(({ id }) => id === "door")?.width).toBe(1.5); click("Opowieść"); expect((storyField("Nazwa") as HTMLInputElement).value).toBe("Door story name");
  });

  it("uses base target for drawing edits even when Story has a live scenario", async () => {
    const ref = { kind: "place" as const, id: "p:world" }; select(ref); const baseName = state().places.find(({ id }) => id === ref.id)!.name; click("Opowieść"); const scenario = [...host.querySelectorAll("label")].find((label) => label.textContent?.includes("Scenariusz"))?.querySelector("select") as HTMLSelectElement; await act(async () => { scenario.value = "night"; scenario.dispatchEvent(new Event("change", { bubbles: true })); }); expect((storyField("Nazwa") as HTMLInputElement).value).toBe("Nocny świat"); click("Stałe właściwości świata"); expect((storyField("Nazwa") as HTMLInputElement).value).toBe(baseName); click("Kreślenie"); select(ref); saveDetails("Permanent world", "Permanent description"); expect(state().story.scenarios[0].patches[0]?.title).toBe("Nocny świat"); expect(effectiveProjectStoryObject(state(), ref)?.name).toBe("Permanent world");
  });

  it("shows the open place fallback without inventing a drawing selection", () => {
    expect(fixture.sheet!.selectedIds ?? []).toEqual([]);
    expect(panel().textContent).toContain("Właściwości otwartej lokalizacji");
    expect(fixture.sheet!.selectedIds ?? []).toEqual([]);
  });

  it("creates a door key in one undoable drawing transaction and reflects inventory, lens and access", () => {
    const ref = { kind: "opening" as const, id: "door", scopeId: state().constructions[0].id }; select(ref); openDetails(); const doors = panel().querySelector('section[aria-label="Klucze drzwi"]')!; act(() => (doors.querySelector('input[type="checkbox"]') as HTMLInputElement).click()); click("Utwórz klucz i zapisz"); const key = state().story.world.find(({ kind }) => kind === "key")!;
    expect(key).toBeTruthy(); expect(evaluateProjectLens(state(), state().story, "anna-lens", ref)?.match).toBe(true); expect(storyAccessDecision(state(), ref, { actorId: "anna" })).toMatchObject({ allowed: true }); click("Cofnij"); expect(state().story.world.some(({ kind }) => kind === "key")).toBe(false);
  });

  it("keeps optional details folded initially and open after saving", async () => {
    const disclosure = () => panel().querySelector("details")!;
    expect(disclosure().open).toBe(false);
    await act(async () => { disclosure().querySelector("summary")!.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(disclosure().open).toBe(true);
    setNative(storyField("Opis")!, "Saved without collapsing"); click("Zapisz");
    expect(disclosure().open).toBe(true);
    expect(state().places.find(({ id }) => id === "p:level")?.description).toBe("Saved without collapsing");
  });

  it("describes the open room through the same canonical room record", () => {
    const room = state().constructions[0].rooms[0];
    click(`Otwórz poziom mapy: ${room.name}`);
    expect(fixture.sheet!.selectedIds ?? []).toEqual([]);
    expect(storyField("Nazwa")?.value).toBe(room.name);
    setNative(storyField("Opis")!, "Current room details"); click("Zapisz");
    expect(effectiveProjectStoryObject(state(), { kind: "room", id: room.id, scopeId: state().constructions[0].id })?.description).toBe("Current room details");
  });

  it("reports a refused transaction and preserves the unsaved fields", () => {
    const original = state().places.find(({ id }) => id === "p:level")!.name;
    setNative(storyField("Nazwa")!, "Pending change");
    vi.spyOn(EditorSession.prototype, "executeTransaction").mockReturnValueOnce({ code: "transaction-failed", changed: false, reason: "Synthetic rejection" });
    click("Zapisz");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Synthetic rejection");
    expect(state().places.find(({ id }) => id === "p:level")!.name).toBe(original);
    expect(storyField("Nazwa")?.value).toBe("Pending change");
    expect(panel().textContent).toContain("Niezapisane zmiany");
  });
});
