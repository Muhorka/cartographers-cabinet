import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../model/starter-project";
import type { EditorProject } from "../model/project-model";
import type { MapSheet } from "./map-sheet";
import { EditorWorkbench } from "./editor-workbench";
import type { useEditorV2Tools } from "../webmcp/use-editor-tools";

const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined, sheetRenders: 0, actions: undefined as Parameters<typeof useEditorV2Tools>[2] | undefined, save: vi.fn(), preference: vi.fn(), remove: vi.fn() }));
vi.mock("../persistence/project-library", async (original) => ({
  ...await original<typeof import("../persistence/project-library")>(),
  scanProjectLibrary: async () => ({ projects: [fixture.project!, createStarterProject("q", "Other project", "pl"), createStarterProject("r", "Third project", "pl")], recoveryRecords: [] }), getPreference: fixture.preference,
  setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: fixture.save, saveStoryDocuments: fixture.save, removeProject: fixture.remove,
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: (_session: unknown, _place: unknown, actions: Parameters<typeof useEditorV2Tools>[2]) => { fixture.actions = actions; } }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; fixture.sheetRenders += 1; return <svg/>; } }));
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.useFakeTimers();
  fixture.project = createStarterProject("p", "Autosave fixture", "pl"); fixture.project.story.documents = [{ id: "note", title: "Scena", bodyMarkdown: "Treść", references: [] }]; fixture.sheetRenders = 0; fixture.save.mockReset().mockImplementation(async (project) => project);
  fixture.preference.mockReset().mockImplementation(async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:level" : undefined); fixture.remove.mockReset().mockResolvedValue(undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>));
  await act(async () => vi.advanceTimersByTimeAsync(400)); fixture.save.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("autosave follows the document rather than view updates", () => {
  it("saves notebook text without repainting the map and reopens the live document", async () => {
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Opowieść")!.click());
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Otwórz notatnik autora"]')!.click());
    const title = host.querySelector<HTMLInputElement>('input[aria-label="Tytuł notatki"]')!;
    const rendersBeforeTyping = fixture.sheetRenders;
    act(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "Scena po zmianie"); title.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => vi.advanceTimersByTimeAsync(700));

    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(fixture.save.mock.calls[0][0].story.documents[0].title).toBe("Scena po zmianie");
    expect(fixture.sheetRenders).toBe(rendersBeforeTyping);

    await act(async () => { expect(await fixture.actions!.openProject("q")).toBe(true); expect(await fixture.actions!.openProject("p")).toBe(true); });
    expect(fixture.sheet!.project.story.documents[0].title).toBe("Scena po zmianie");
  });

  it("flushes an unfinished notebook edit when leaving Story mode", async () => {
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Opowieść")!.click());
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Otwórz notatnik autora"]')!.click());
    const title = host.querySelector<HTMLInputElement>('input[aria-label="Tytuł notatki"]')!;
    act(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "Ostatni znak"); title.dispatchEvent(new Event("input", { bubbles: true })); });
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Kreślenie")!.click());
    await act(async () => vi.runAllTimersAsync());

    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(fixture.save.mock.calls[0][0].story.documents[0].title).toBe("Ostatni znak");

    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Opowieść")!.click());
    expect(fixture.sheet!.project.story.documents[0].title).toBe("Ostatni znak");
  });

  it("flushes the current notebook draft before an immediate project switch", async () => {
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Opowieść")!.click());
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Otwórz notatnik autora"]')!.click());
    const title = host.querySelector<HTMLInputElement>('input[aria-label="Tytuł notatki"]')!;
    act(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(title, "Przed przełączeniem"); title.dispatchEvent(new Event("input", { bubbles: true })); });

    await act(async () => { expect(await fixture.actions!.openProject("q")).toBe(true); expect(await fixture.actions!.openProject("p")).toBe(true); });
    expect(fixture.sheet!.project.story.documents[0].title).toBe("Przed przełączeniem");
    expect(fixture.save.mock.calls.some(([project]) => project.id === "p" && project.story.documents[0].title === "Przed przełączeniem")).toBe(true);
  });

  it("keeps project identity and does not save for repeated selection, pan and navigation", async () => {
    const before = fixture.sheet!.project;
    for (let index = 0; index < 12; index += 1) {
      act(() => fixture.sheet!.onSelect?.({ kind: "place", id: "p:level" }));
      act(() => fixture.sheet!.onViewportChange?.({ ...fixture.sheet!.viewport, center: { x: index, y: index } }));
    }
    act(() => fixture.sheet!.onOpenPlace?.("p:building"));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(fixture.sheet!.project).toBe(before); expect(fixture.save).not.toHaveBeenCalled();
  });
  it("saves an actual change and the restored document after undo", async () => {
    const before = fixture.sheet!.project.measureSettings;
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridVisible: !before.gridVisible }));
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(fixture.save.mock.calls[0][0].measureSettings.gridVisible).toBe(!before.gridVisible);
    const undo = host.querySelector<HTMLButtonElement>('button[aria-label="Cofnij"]')!;
    act(() => undo.click()); await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(fixture.save).toHaveBeenCalledTimes(2);
    expect(fixture.save.mock.calls[1][0].measureSettings.gridVisible).toBe(before.gridVisible);
  });

  it("retries a failed write without requiring another document edit", async () => {
    fixture.save.mockRejectedValueOnce(new Error("temporary failure"));
    const before = fixture.sheet!.project.measureSettings;
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridVisible: !before.gridVisible }));
    await act(async () => vi.advanceTimersByTimeAsync(400));
    const retry = [...host.querySelectorAll("button")].find((button) => button.textContent === "Ponów zapis")!;
    expect(retry).toBeTruthy();
    await act(async () => retry.click()); await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(fixture.save).toHaveBeenCalledTimes(2); expect(host.textContent).not.toContain("Nie udało się zapisać");
  });

  it("flushes the latest document before switching through the library", async () => {
    const before = fixture.sheet!.project.measureSettings;
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridVisible: !before.gridVisible }));
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Biblioteka"))!.click();
      await vi.dynamicImportSettled();
    });
    const row = [...host.querySelectorAll('[role="dialog"] article')].find((row) => row.textContent?.includes("Other project"))!;
    await act(async () => [...row.querySelectorAll("button")].find((button) => button.textContent === "Otwórz")!.click());
    expect(fixture.sheet!.project.id).toBe("q");
    expect(fixture.save.mock.calls.some(([project]) => project.id === "p" && project.measureSettings.gridVisible === !before.gridVisible)).toBe(true);
    await act(async () => { await fixture.actions!.openProject("p"); });
    expect(fixture.sheet!.project.measureSettings.gridVisible).toBe(!before.gridVisible);
  });

  it("waits for an in-flight save and keeps it when returning to the project", async () => {
    let finish!: () => void;
    fixture.save.mockImplementationOnce((project) => new Promise((resolve) => { finish = () => resolve(project); }));
    const before = fixture.sheet!.project.measureSettings;
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridVisible: !before.gridVisible }));
    await act(async () => vi.advanceTimersByTimeAsync(350));
    let opening!: Promise<boolean>; act(() => { opening = fixture.actions!.openProject("q"); });
    expect(fixture.sheet!.project.id).toBe("p");
    await act(async () => { finish(); expect(await opening).toBe(true); });
    expect(fixture.sheet!.project.id).toBe("q");
    await act(async () => { await fixture.actions!.openProject("p"); });
    expect(fixture.sheet!.project.measureSettings.gridVisible).toBe(!before.gridVisible);
  });

  it("keeps the edited project open if the departure flush fails", async () => {
    fixture.save.mockRejectedValue(new Error("disk unavailable"));
    const before = fixture.sheet!.project.measureSettings;
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridVisible: !before.gridVisible }));
    await act(async () => { expect(await fixture.actions!.openProject("q")).toBe(false); });
    expect(fixture.sheet!.project.id).toBe("p"); expect(fixture.sheet!.project.measureSettings.gridVisible).toBe(!before.gridVisible);
    expect(host.textContent).toContain("Nie udało się zapisać");
  });

  it("serializes subsequent writes and records the newest revision last", async () => {
    let finish!: () => void;
    fixture.save.mockImplementationOnce((project) => new Promise((resolve) => { finish = () => resolve(project); }));
    const before = fixture.sheet!.project.measureSettings;
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridOpacity: .31 }));
    await act(async () => vi.advanceTimersByTimeAsync(350));
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridOpacity: .64 }));
    await act(async () => vi.advanceTimersByTimeAsync(350)); expect(fixture.save).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(fixture.save).toHaveBeenCalledTimes(2); expect(fixture.save.mock.calls[1][0].measureSettings.gridOpacity).toBe(.64);
  });

  it("does not resurrect a deleted project after an in-flight save", async () => {
    let finish!: () => void; const order: string[] = [];
    fixture.save.mockImplementationOnce((project) => new Promise((resolve) => { finish = () => { order.push("write-p"); resolve(project); }; }));
    fixture.remove.mockImplementation(async () => { order.push("delete-p"); });
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...fixture.sheet!.project.measureSettings, gridOpacity: .41 }));
    await act(async () => vi.advanceTimersByTimeAsync(350));
    let deletion!: Promise<boolean>; act(() => { deletion = fixture.actions!.deleteProject("p"); });
    expect(fixture.remove).not.toHaveBeenCalled();
    await act(async () => { finish(); expect(await deletion).toBe(true); });
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(order).toEqual(["write-p", "delete-p"]); expect(fixture.sheet!.project.id).not.toBe("p");
    expect(fixture.save.mock.calls.filter(([project]) => project.id === "p")).toHaveLength(1);
  });

  it("writes the restored A last when undo happens during queued A then B writes", async () => {
    let finish!: () => void;
    fixture.save.mockImplementationOnce((project) => new Promise((resolve) => { finish = () => resolve(project); }));
    const before = fixture.sheet!.project.measureSettings;
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridOpacity: .31 }));
    await act(async () => vi.advanceTimersByTimeAsync(350));
    act(() => fixture.sheet!.onMeasureSettingsChange?.({ ...before, gridOpacity: .64 }));
    await act(async () => vi.advanceTimersByTimeAsync(350));
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Cofnij"]')!.click());
    await act(async () => vi.advanceTimersByTimeAsync(350));
    await act(async () => finish());
    expect(fixture.save.mock.calls.map(([project]) => project.measureSettings.gridOpacity)).toEqual([.31, .64, .31]);
    expect(fixture.sheet!.project.measureSettings.gridOpacity).toBe(.31);
  });

  it("does not install a late project load over a newer choice", async () => {
    let finish!: () => void;
    fixture.preference.mockImplementation((key: string) => key === "activePlaceId:q" ? new Promise((resolve) => { finish = () => resolve(undefined); }) : Promise.resolve(undefined));
    let first!: Promise<boolean>; await act(async () => { first = fixture.actions!.openProject("q"); });
    await act(async () => { expect(await fixture.actions!.openProject("r")).toBe(true); });
    expect(fixture.sheet!.project.id).toBe("r");
    await act(async () => { finish(); expect(await first).toBe(false); });
    expect(fixture.sheet!.project.id).toBe("r");
  });
});
