import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { toolboxCopy } from "../i18n/toolbox-copy";
import { activateLayer, chooseInstrument, chooseSubject, createToolboxState } from "../toolbox/toolbox-state";
import { WorkbenchToolbox } from "./workbench-toolbox";

const actions = { onChange: vi.fn(), onBoundaryEditing: vi.fn(), onUndo: vi.fn(), onRedo: vi.fn(), onClearLayer: vi.fn(), onCollapsed: vi.fn(), onSketchVisible: vi.fn(), onSketchOpacity: vi.fn() };
const view = { sketchVisible: true, sketchOpacity: .75 };
const allLayers = new Set(["terrain", "boundaries", "buildings", "construction", "openings", "equipment", "sketch"] as const);

describe("editor v2 workbench toolbox", () => {
  it.each(["platform", "terrace", "balcony", "porch", "mezzanine", "stage", "custom"])("keeps selection available for %s with and without cutout", (kind) => {
    const state = chooseSubject(createToolboxState("construction"), `platform.${kind}`);
    for (const cutoutActive of [false, true]) {
      const html = renderToStaticMarkup(<WorkbenchToolbox state={state} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing cutoutActive={cutoutActive} canCutout collapsed={false} canUndo canRedo {...view} {...actions}/>);
      expect(html).toContain('title="Zaznacz i edytuj"');
      expect(html).toContain('title="Zaznacz obszarem"');
    }
  });
  it("renders all work layers in one persistent rail", () => {
    const html = renderToStaticMarkup(<WorkbenchToolbox state={createToolboxState()} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo={false} canRedo={false} {...view} {...actions}/>);
    for (const label of ["Teren", "Granice", "Zabudowa", "Konstrukcja", "Obiekty", "Szkic"]) expect(html).toContain(label);
  });

  it("shows only placement, selection and the shared eraser for doors and windows", () => {
    const state = activateLayer(createToolboxState(), "openings");
    const html = renderToStaticMarkup(<WorkbenchToolbox state={state} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo {...view} {...actions}/>);
    expect(html).toContain("Wstaw"); expect(html).toContain("Zaznacz i edytuj"); expect(html).toContain("Gumka");
    expect(html).not.toContain("Ołówek"); expect(html).not.toContain("Wielokąt");
  });

  it("shows the complete object catalogue in every context", () => {
    const state = activateLayer(createToolboxState(), "equipment");
    const html = renderToStaticMarkup(<WorkbenchToolbox state={state} copy={toolboxCopy.pl} availableLayerIds={allLayers} availableSubjectIds={new Set(["equipment.furniture", "equipment.object", "equipment.vegetation", "equipment.monument", "equipment.small-architecture", "equipment.bridge", "equipment.marker", "equipment.custom"])} boundaryEditing={false} collapsed={false} canUndo={false} canRedo={false} {...view} {...actions}/>);
    expect(html).toContain("Roślinność"); expect(html).toContain("Pomnik"); expect(html).toContain("Most"); expect(html).toContain("Mebel"); expect(html).toContain("Przedmiot");
  });

  it("keeps boundary editing and history controls outside the layer rail", () => {
    const html = renderToStaticMarkup(<WorkbenchToolbox state={createToolboxState()} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo {...view} {...actions}/>);
    expect(html.indexOf("Edytuj obrys")).toBeGreaterThan(html.indexOf("Przybory"));
    expect(html).toContain("Wyczyść bieżącą warstwę");
  });
  it.each([
    [toolboxCopy.pl, "Dziedziniec", "Edytuj obrys bieżącej mapy: Dziedziniec", "Zakończ edycję obrysu bieżącej mapy: Dziedziniec"],
    [toolboxCopy.en, "Courtyard", "Edit current map boundary: Courtyard", "Finish editing current map boundary: Courtyard"],
  ])("clarifies the current map in the boundary tooltip", (copy, name, editTitle, finishTitle) => {
    const edit = renderToStaticMarkup(<WorkbenchToolbox state={createToolboxState()} copy={copy} availableLayerIds={allLayers} boundaryName={name} boundaryEditing={false} collapsed={false} canUndo canRedo {...view} {...actions}/>);
    const finish = renderToStaticMarkup(<WorkbenchToolbox state={createToolboxState()} copy={copy} availableLayerIds={allLayers} boundaryName={name} boundaryEditing collapsed={false} canUndo canRedo {...view} {...actions}/>);
    expect(edit).toContain(`title="${editTitle}"`); expect(finish).toContain(`title="${finishTitle}"`);
  });

  it("shows visibility and opacity controls only while the sketch layer is open", () => {
    const state = activateLayer(createToolboxState(), "sketch");
    const html = renderToStaticMarkup(<WorkbenchToolbox state={state} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo {...view} {...actions}/>);
    expect(html).toContain("Pokaż warstwę szkicu"); expect(html).toContain("Przezroczystość szkicu");
  });
  it.each([
    [toolboxCopy.pl, "Napisz notatkę. Przeciągnij, aby wyznaczyć pole tekstowe"],
    [toolboxCopy.en, "Write note. Drag to draw the text box"],
  ])("explains that a note is drawn by dragging", (copy, hint) => {
    const state = chooseSubject(activateLayer(createToolboxState(), "sketch"), "sketch.note");
    const html = renderToStaticMarkup(<WorkbenchToolbox state={state} copy={copy} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo={false} canRedo={false} {...view} {...actions}/>);
    expect(html).toContain(`title="${hint}"`);
  });

  it("shows the remembered eraser size only while the eraser is selected", () => {
    const terrain = activateLayer(createToolboxState(), "terrain");
    const regular = renderToStaticMarkup(<WorkbenchToolbox state={terrain} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo {...view} {...actions}/>);
    const erasing = renderToStaticMarkup(<WorkbenchToolbox state={chooseInstrument(terrain, "erase")} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo eraserSize={17} {...view} {...actions}/>);
    expect(regular).not.toContain("Rozmiar gumki");
    expect(erasing).toContain("Rozmiar gumki"); expect(erasing).toContain('value="17"');
  });

  it("keeps gap closing beside the relevant drawing instruments", () => {
    const terrain = activateLayer(createToolboxState(), "terrain");
    const html = renderToStaticMarkup(<WorkbenchToolbox state={terrain} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo gapClosingEnabled gapClosingTolerance={18} {...view} {...actions}/>);
    expect(html).toContain(toolboxCopy.pl.closeGaps); expect(html).toContain(toolboxCopy.pl.closeGapsStrength); expect(html).toContain('aria-pressed="true"'); expect(html).toContain('value="18"');
  });

  it("restores the open wall-run instrument for construction", () => {
    const state = activateLayer(createToolboxState(), "construction");
    const html = renderToStaticMarkup(<WorkbenchToolbox state={state} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo {...view} {...actions}/>);
    expect(html).toContain(toolboxCopy.pl.instruments["wall-run"]);
  });

  it("can switch gap closing on from its engraved control", () => {
    const container = document.createElement("div"); const root = createRoot(container); const onGapClosingEnabled = vi.fn();
    act(() => root.render(<WorkbenchToolbox state={activateLayer(createToolboxState(), "terrain")} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo gapClosingEnabled={false} onGapClosingEnabled={onGapClosingEnabled} {...view} {...actions}/>));
    act(() => container.querySelector(`button[title="${toolboxCopy.pl.closeGaps}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onGapClosingEnabled).toHaveBeenCalledWith(true); act(() => root.unmount());
  });
  it("forwards pencil smoothing changes instead of leaving the controlled slider inert", () => {
    const container = document.createElement("div"); const root = createRoot(container); const onPencilSmoothing = vi.fn();
    act(() => root.render(<WorkbenchToolbox state={createToolboxState("terrain")} copy={toolboxCopy.pl} availableLayerIds={allLayers} boundaryEditing={false} collapsed={false} canUndo canRedo pencilSmoothing={.25} onPencilSmoothing={onPencilSmoothing} {...view} {...actions}/>));
    const slider = container.querySelector<HTMLInputElement>(`input[aria-label="${toolboxCopy.pl.pencilSmoothing}"]`)!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "0.8"); slider.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(onPencilSmoothing).toHaveBeenCalledWith(.8); act(() => root.unmount());
  });
});
