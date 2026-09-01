import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSheet } from "./map-sheet";
import type { EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { addConstructionSurface, addElement, createLevelForBuilding, createPlace } from "../model/hierarchy-operations";
import { pointInRegion, regionArea } from "../geometry/region-constraints";
import { applyAffinePoint, relativePlaceMatrix } from "../geometry/affine-transform";
import { parseProjectFile, serializeProjectFile } from "../persistence/project-file";
import { EditorWorkbench } from "./editor-workbench";
import { toolboxCopy } from "../i18n/toolbox-copy";

const fixture = vi.hoisted(() => ({
  project: undefined as EditorProject | undefined,
  saved: undefined as EditorProject | undefined,
  sheet: undefined as ComponentProps<typeof MapSheet> | undefined,
  preferences: new Map<string, string>(),
}));

// Keep the actual workbench, toolbox, drawing hook, session and geometry.
// Only replace persistence/network adapters and inject completed canvas gestures.
vi.mock("../persistence/project-library", async (importOriginal) => ({
  ...await importOriginal<typeof import("../persistence/project-library")>(),
  listSavedProjects: async () => [fixture.saved ?? fixture.project!],
  getPreference: async (key: string) => fixture.preferences.get(key),
  setPreference: async (key: string, value: string) => { fixture.preferences.set(key, value); },
  listProjectCheckpoints: async () => [],
  saveProject: async (project: EditorProject) => { fixture.saved = structuredClone(project); return project; },
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn() }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas"/>; } }));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const button = (title: string) => [...container.querySelectorAll("button")].find((node) => node.title === title || node.getAttribute("aria-label") === title)!;
const click = (title: string) => act(() => { const node = button(title); expect(node, title).toBeDefined(); expect(node.disabled, title).toBe(false); node.click(); });
const choose = (role: string, label: string) => act(() => {
  const node = [...container.querySelectorAll<HTMLButtonElement>(`[role="${role}"]`)].find((candidate) => candidate.textContent === label)!;
  expect(node, label).toBeDefined(); expect(node.disabled).toBe(false); node.click();
});
const level = () => fixture.sheet!.project.places.find(({ id }) => id === "p:level")!;
const boundaryTitle = (editing = false) => (editing ? toolboxCopy.pl.stopEditingBoundaryFor : toolboxCopy.pl.editBoundaryFor)(level().name);

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  fixture.project = createStarterProject("p", "Synthetic cutout", "pl");
  let nextId = 0;
  fixture.project = createLevelForBuilding(fixture.project, { id: "upper", constructionId: "upper-plan", buildingId: "p:building", name: "Piętro" }, { createId: () => `upper-${++nextId}` });
  const shape = { kind: "rectangle" as const, x: -8, y: -8, width: 16, height: 16 };
  fixture.project = createPlace(fixture.project, { id: "area", parentId: "p:world", name: "Area", kind: "location", boundary: shape });
  for (const layerId of ["terrain", "equipment"] as const) fixture.project = addElement(fixture.project, { id: layerId, name: layerId, layerId, subjectId: layerId === "terrain" ? "terrain.forest" : "equipment.object", geometry: { kind: "region", shape }, visible: true, locked: false, tags: [], access: [], properties: {} }, "p:world");
  fixture.project = addConstructionSurface(fixture.project, { id: "platform", name: "Platform", kind: "platform", shape, attachment: "free", elevation: 0, visible: true, locked: false, tags: [], access: [], properties: {} }, "p:world");
  fixture.saved = undefined; fixture.sheet = undefined;
  fixture.preferences.clear(); fixture.preferences.set("locale", "pl"); fixture.preferences.set("activePlaceId:p", "p:level");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<EditorWorkbench/>); });
});

afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("editor flows through the real workbench", () => {
  it("rotates through the shared precise control and keeps preview out of the saved project", () => {
    act(() => fixture.sheet!.onOpenPlace?.("p:world"));
    choose("tab", "Teren"); click("Zaznacz i edytuj");
    act(() => fixture.sheet!.onSelectMany?.([{ kind: "element", id: "terrain" }]));
    const source = fixture.sheet!.project;
    expect(fixture.sheet!.rotationControl).toBeDefined();
    act(() => fixture.sheet!.rotationControl!.onPreview(37));
    expect(fixture.sheet!.project.elements.find(({ id }) => id === "terrain")?.geometry).not.toEqual(source.elements.find(({ id }) => id === "terrain")?.geometry);
    act(() => fixture.sheet!.rotationControl!.onCancel()); expect(fixture.sheet!.project).toEqual(source);
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Kąt obrotu w stopniach"]')!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "37"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    act(() => input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fixture.sheet!.project.elements.find(({ id }) => id === "terrain")?.geometry).not.toEqual(source.elements.find(({ id }) => id === "terrain")?.geometry);
    click("Cofnij"); expect(fixture.sheet!.project.elements).toEqual(source.elements);
  });

  it("persists pencil smoothing through the real EditorWorkbench wiring", () => {
    choose("tab", "Teren"); click("Ołówek");
    const slider = container.querySelector<HTMLInputElement>(`input[aria-label="${toolboxCopy.pl.pencilSmoothing}"]`)!;
    expect(slider.value).toBe("0.25");
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "0.8");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(slider.value).toBe("0.8");
    expect(fixture.sheet!.project.measureSettings.pencilSmoothing).toBeCloseTo(.8);
  });

  it("persists grid settings with the current project and restores them in a new session", async () => {
    const firstProjectId = fixture.sheet!.project.id;
    const nextSettings = { ...fixture.sheet!.project.measureSettings, gridVisible: true, showAxes: true, gridOpacity: .45, gridSpacingMeters: 2.5, snapToGrid: true, units: "imperial" as const };
    act(() => fixture.sheet!.onMeasureSettingsChange?.(nextSettings));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(fixture.saved?.id).toBe(firstProjectId);
    expect(fixture.saved?.measureSettings).toMatchObject(nextSettings);
    expect([...fixture.preferences.keys()].some((key) => key.includes("grid") || key.includes("measure"))).toBe(false);

    act(() => root.unmount());
    container.replaceChildren();
    root = createRoot(container);
    await act(async () => { root.render(<EditorWorkbench/>); });
    expect(fixture.sheet!.project.id).toBe(firstProjectId);
    expect(fixture.sheet!.project.measureSettings).toMatchObject(nextSettings);
  });

  it.each(["Teren", "Konstrukcja", "Obiekty", "Szkic", "Otwory"])("cuts a floor edge on %s without rejecting the outside part or switching tools", (layer) => {
    if (layer === "Otwory") choose("radio", layer); else choose("tab", layer);
    click(boundaryTitle()); click("Wytnij pustkę"); click("Prostokąt");
    act(() => fixture.sheet!.onGesture?.({ instrumentId: "rectangle", points: [{ x: 12, y: -3 }, { x: 22, y: 3 }] }));
    expect(pointInRegion({ x: 15, y: 0 }, level().boundary!)).toBe(false);
    expect(pointInRegion({ x: 10, y: 0 }, level().boundary!)).toBe(true);
    expect(fixture.sheet!.interaction?.instrumentId).toBe("rectangle");
    expect(button("Wytnij pustkę").getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).not.toContain("poza dozwolonym obszarem");
    click("Cofnij"); expect(pointInRegion({ x: 15, y: 0 }, level().boundary!)).toBe(true);
    click("Ponów"); expect(pointInRegion({ x: 15, y: 0 }, level().boundary!)).toBe(false);
    if (layer === "Otwory") {
      click("Wytnij pustkę");
      expect(fixture.sheet!.interaction?.instrumentId).toBe("place");
      expect(button("Prostokąt")).toBeUndefined();
    }
  });

  it.each([
    { kind: "place", id: "area", owner: "area" }, { kind: "place", id: "p:building", owner: "p:building" },
    { kind: "element", id: "terrain", owner: "p:world" }, { kind: "element", id: "equipment", owner: "p:world" },
    { kind: "surface", id: "platform", owner: "p:world" },
  ] as const)("edits $kind $id from the world regardless of the active creation layer", ({ kind, id, owner }) => {
    act(() => fixture.sheet!.onOpenPlace?.("p:world"));
    choose("tab", "Szkic");
    act(() => fixture.sheet!.onSelect?.({ kind, id }));
    click("Wytnij pustkę"); click("Prostokąt");
    const matrix = relativePlaceMatrix(fixture.sheet!.project, "p:world", owner);
    const points = [{ x: -2, y: -2 }, { x: 2, y: 2 }].map((point) => applyAffinePoint(matrix, point));
    const shape = () => {
      const project = fixture.sheet!.project;
      if (kind === "place") return project.places.find((place) => place.id === id)!.boundary!;
      if (kind === "surface") return project.surfaces.find((surface) => surface.id === id)!.shape;
      const geometry = project.elements.find((element) => element.id === id)!.geometry;
      if (geometry.kind !== "region") throw new Error("Expected area geometry");
      return geometry.shape;
    };
    const originalArea = regionArea(shape());
    act(() => fixture.sheet!.onGesture?.({ instrumentId: "rectangle", points }));
    expect(regionArea(shape())).toBeCloseTo(originalArea - 16);
    click("Dodaj do obrysu");
    act(() => fixture.sheet!.onGesture?.({ instrumentId: "rectangle", points }));
    expect(regionArea(shape())).toBeCloseTo(originalArea);
    if (id === "p:building") {
      for (const floorId of ["p:level", "upper"]) {
        expect(pointInRegion({ x: 0, y: 0 }, fixture.sheet!.project.places.find((place) => place.id === floorId)!.boundary!)).toBe(true);
      }
    }
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Szkic");
  });

  it("keeps both outline operations usable in the folded toolbox", () => {
    click(boundaryTitle()); click("Zwiń piórnik"); click("Wytnij pustkę"); click("Prostokąt");
    act(() => fixture.sheet!.onGesture?.({ instrumentId: "rectangle", points: [{ x: 12, y: -3 }, { x: 22, y: 3 }] }));
    expect(pointInRegion({ x: 15, y: 0 }, level().boundary!)).toBe(false);
    click("Dodaj do obrysu");
    expect(button("Dodaj do obrysu").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps outline permission after choosing cutout; repeats cuts, saves, undoes and preserves other floors", async () => {
    const originalUpper = fixture.sheet!.project.places.find(({ id }) => id === "upper")!;
    click(boundaryTitle()); click("Prostokąt"); click("Wytnij pustkę");
    expect(fixture.sheet!.outlineEditing).toBe(true);
    expect(button("Wytnij pustkę").disabled).toBe(false);
    expect(button("Wytnij pustkę").getAttribute("aria-pressed")).toBe("true");
    for (const x of [-6, 3]) {
      act(() => fixture.sheet!.onGesture?.({ instrumentId: "rectangle", points: [{ x, y: -2 }, { x: x + 2, y: 2 }] }));
      expect(pointInRegion({ x: x + 1, y: 0 }, level().boundary!)).toBe(false);
      expect(fixture.sheet!.interaction?.instrumentId).toBe("rectangle");
      expect(button("Wytnij pustkę").getAttribute("aria-pressed")).toBe("true");
    }
    expect(fixture.sheet!.project.places.find(({ id }) => id === "upper")).toEqual(originalUpper);
    expect(fixture.sheet!.project.constructions.find(({ id }) => id === level().constructionId)!.rooms).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    const restored = parseProjectFile(serializeProjectFile(fixture.saved!)).project;
    expect(pointInRegion({ x: -5, y: 0 }, restored.places.find(({ id }) => id === "p:level")!.boundary!)).toBe(false);
    click("Cofnij"); expect(pointInRegion({ x: 4, y: 0 }, level().boundary!)).toBe(true);
    expect(pointInRegion({ x: -5, y: 0 }, level().boundary!)).toBe(false);
    click("Ponów"); expect(pointInRegion({ x: 4, y: 0 }, level().boundary!)).toBe(false);
  });

  it("keeps the same target when adding a projection or switching from cut to add", () => {
    click(boundaryTitle()); click("Prostokąt"); click("Wytnij pustkę"); click("Dodaj do obrysu");
    expect(fixture.sheet!.outlineEditing).toBe(true);
    expect(button("Wytnij pustkę").getAttribute("aria-pressed")).toBe("false");
    expect(button("Dodaj do obrysu").getAttribute("aria-pressed")).toBe("true");
    act(() => fixture.sheet!.onGesture?.({ instrumentId: "rectangle", points: [{ x: 15, y: -2 }, { x: 19, y: 2 }] }));
    expect(pointInRegion({ x: 18, y: 0 }, level().boundary!)).toBe(true);
    expect(pointInRegion({ x: 18, y: 0 }, fixture.sheet!.project.places.find(({ id }) => id === "upper")!.boundary!)).toBe(false);
    click(boundaryTitle(true));
    expect(button("Wytnij pustkę").disabled).toBe(true);
    expect(button("Dodaj do obrysu").disabled).toBe(true);
  });
});
