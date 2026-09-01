import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import type { EditorProject } from "../model/project-model";
import type { MapSheet } from "./map-sheet";
import { EditorWorkbench } from "./editor-workbench";
import styles from "./editor-workbench.module.css";

const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, saved: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined }));
vi.mock("../persistence/project-library", async (original) => ({
  ...await original<typeof import("../persistence/project-library")>(),
  listSavedProjects: async () => [fixture.project!], getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:level" : undefined,
  setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: async (project: EditorProject) => { fixture.saved = structuredClone(project); return project; },
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn() }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas">{props.storyOverlay}</svg>; } }));
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
const state = () => fixture.sheet!.project;
const click = (name: string) => act(() => {
  const control = [...host.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent === name);
  expect(control, name).toBeTruthy(); control!.click();
});
const type = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const zonePanel = () => host.querySelector<HTMLElement>('section[aria-label^="Strefy: "]')!;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.useFakeTimers();
  fixture.project = createStarterProject("p", "Synthetic zone UI", "pl");
  fixture.sheet = undefined; fixture.saved = undefined;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("zones through the shared editor session", () => {
  it.each(["drawing", "story"])("keeps one book heading and the sheet title inside the canvas frame in %s", (mode) => {
    if (mode === "story") click("Opowieść");
    const book = host.querySelector(`.${styles.leftBook}`)!;
    const heading = book.querySelector("header")!;
    expect(heading.querySelectorAll("h2")).toHaveLength(1);
    expect(heading.textContent).toBe(mode === "story" ? "Opowieść" : "Atlas");
    const frame = host.querySelector(`.${styles.sheetFrame}`)!;
    expect(frame.querySelector(`.${styles.sheetTitle}`)).not.toBeNull();
    expect(host.querySelector(`.${styles.center} > .${styles.sheetTitle}`)).toBeNull();
  });
  it.each(["drawing", "story"])("folds the intended book without losing a zone draft or selection in %s", (mode) => {
    if (mode === "story") click("Opowieść");
    const room = state().constructions[0].rooms[0];
    act(() => fixture.sheet!.onSelect?.({ kind: "room", id: room.id }));
    click("Utwórz strefę z zaznaczenia");
    const name = host.querySelector<HTMLInputElement>('section[aria-label="Strefy"] form input')!;
    type(name, "Niedokończony apartament");
    const desk = host.querySelector(`.${styles.desk}`)!;
    const map = host.querySelector(`.${styles.center}`)!;
    const before = structuredClone(state());
    const fold = (label: string) => act(() => {
      const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(button, label).toBeTruthy(); button!.click();
    });
    fold("Zwiń lewą księgę");
    expect(desk.classList.contains(styles.leftClosed)).toBe(true);
    expect(desk.classList.contains(styles.rightClosed)).toBe(false);
    fold("Zwiń prawą księgę");
    expect(desk.classList.contains(styles.leftClosed)).toBe(true);
    expect(desk.classList.contains(styles.rightClosed)).toBe(true);
    fold("Rozwiń lewą księgę");
    expect(desk.classList.contains(styles.leftClosed)).toBe(false);
    expect(desk.classList.contains(styles.rightClosed)).toBe(true);
    fold("Rozwiń prawą księgę");
    expect(desk.classList.contains(styles.rightClosed)).toBe(false);
    expect(host.querySelector(`.${styles.center}`)).toBe(map);
    expect(host.querySelector('section[aria-label="Strefy"] form input')).toBe(name);
    expect(name.value).toBe("Niedokończony apartament");
    expect(fixture.sheet!.selectedIds).toContain(room.id);
    expect(state()).toEqual(before);
  });

  it("creates a zone from mixed selection in drawing, edits on the right, and undoes/redoes in story", async () => {
    const before = structuredClone(state()); const room = before.constructions[0].rooms[0]; const wall = before.constructions[0].walls[0];
    act(() => fixture.sheet!.onSelect?.({ kind: "room", id: room.id }));
    act(() => fixture.sheet!.onSelect?.({ kind: "place", id: "p:building" }, true));
    act(() => fixture.sheet!.onSelect?.({ kind: "wall", id: wall.id }, true));
    click("Utwórz strefę z zaznaczenia");
    const list = host.querySelector<HTMLElement>('section[aria-label="Strefy"]')!;
    expect(list.textContent).toContain("Obiekty w zaznaczeniu: 2");
    expect(list.textContent).toContain("Odcinki ścian nie są osobnymi członkami strefy.");
    type(list.querySelector("input")!, "Apartament testowy"); click("Utwórz strefę");
    expect(state().story.zones[0].members.map(({ ref }) => ref.id)).toEqual([room.id, "p:building"]);
    expect(zonePanel()?.closest("aside")).toBeTruthy();
    expect(host.querySelector('[data-zone-overlay]')).toBeTruthy();
    const name = zonePanel().querySelector<HTMLInputElement>('input:not([type="color"])')!;
    type(name, "Apartament po zmianie");
    expect(state().story.zones[0].name).toBe("Apartament po zmianie");
    expect(state().places).toEqual(before.places);
    expect(state().constructions).toEqual(before.constructions);
    click("Opowieść"); click("Cofnij");
    expect(state().story.zones[0].name).toBe("Apartament testowy");
    click("Cofnij"); expect(state().story.zones).toHaveLength(0);
    click("Ponów"); expect(state().story.zones[0].members).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fixture.saved?.story.zones[0].name).toBe("Apartament testowy");
  });

  it("shows inverse membership, filters technical segments, and keeps independent book sections", () => {
    const room = state().constructions[0].rooms[0];
    act(() => fixture.sheet!.onSelect?.({ kind: "room", id: room.id }));
    click("Utwórz strefę z zaznaczenia");
    type(host.querySelector<HTMLFormElement>('section[aria-label="Strefy"] form')!.querySelector("input")!, "Strefa pokoju");
    click("Utwórz strefę");
    expect(zonePanel().textContent).not.toContain("Ściana 1");
    click("Wróć do właściwości obiektu");
    expect(host.querySelector('section[aria-label="Należy do stref"]')?.textContent).toContain("Strefa pokoju");
    click("Opowieść");
    const summaries = [...host.querySelectorAll("summary")];
    const book = summaries.find((element) => element.textContent?.includes("Księga świata"))!;
    act(() => book.click());
    const tree = summaries.find((element) => element.textContent?.includes("Drzewo projektu"))!;
    expect(tree.parentElement?.hasAttribute("open")).toBe(true);
    expect(book.parentElement?.hasAttribute("open")).toBe(true);
    expect(host.querySelector('[data-zone-overlay]')).toBeTruthy();
  });
});
