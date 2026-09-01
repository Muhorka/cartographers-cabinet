import { describe, expect, it } from "vitest";
import { availableInstruments, getWorkLayer, workLayers } from "./toolbox-model";
import { activateLayer, chooseInstrument, outlineInstrumentFor, chooseSubject, createToolboxState } from "./toolbox-state";

describe("editor v2 toolbox contract", () => {
  it("gives every layer a valid remembered default", () => {
    const state = createToolboxState();
    for (const layer of workLayers) {
      expect(layer.subjects.some(({ id }) => id === state.byLayer[layer.id].subjectId)).toBe(true);
      expect(availableInstruments(layer.id, state.byLayer[layer.id].subjectId)).toContain(state.byLayer[layer.id].instrumentId);
    }
  });

  it("offers placement, selection and the same semantic eraser for doors and windows", () => {
    expect(getWorkLayer("openings").eraser).toBe("delete-object");
    expect(availableInstruments("openings", "opening.door")).toEqual(["select", "marquee", "place", "erase"]);
    expect(availableInstruments("openings", "opening.window")).not.toContain("pencil");
    expect(availableInstruments("openings", "opening.window")).toContain("erase");
  });

  it("carries a compatible hand tool between layers and retains layer memory otherwise", () => {
    let state = createToolboxState("terrain");
    state = chooseSubject(state, "terrain.forest");
    state = chooseInstrument(state, "ellipse");
    state = activateLayer(state, "construction");
    expect(state.byLayer.construction.instrumentId).toBe("ellipse");
    state = chooseSubject(state, "construction.wall");
    state = chooseInstrument(state, "line");
    state = activateLayer(state, "terrain");
    expect(state.byLayer.terrain).toMatchObject({ subjectId: "terrain.forest", instrumentId: "line", lastRegionInstrumentId: "ellipse" });
    expect(state.byLayer.construction).toMatchObject({ subjectId: "construction.wall", instrumentId: "line", lastRegionInstrumentId: "ellipse" });
  });

  it("changes an incompatible instrument when the subject changes", () => {
    let state = createToolboxState("equipment");
    state = chooseInstrument(state, "rectangle");
    state = chooseSubject(state, "equipment.marker");
    expect(state.byLayer.equipment).toMatchObject({ subjectId: "equipment.marker", instrumentId: "point", lastRegionInstrumentId: "rectangle" });
  });

  it("keeps the hand tool while changing opening kinds and falls back only when incompatible", () => {
    let state = activateLayer(createToolboxState(), "openings");
    state = chooseInstrument(state, "select");
    state = chooseSubject(state, "opening.stairs");
    expect(state.byLayer.openings).toEqual({ subjectId: "opening.stairs", instrumentId: "select" });
    state = chooseSubject(state, "opening.window");
    expect(state.byLayer.openings).toEqual({ subjectId: "opening.window", instrumentId: "select" });
  });

  it("keeps buildings and construction adjacent but semantically separate", () => {
    expect(getWorkLayer("buildings").subjects.every(({ meaning }) => meaning === "building-footprint")).toBe(true);
    expect(getWorkLayer("construction").subjects.every(({ meaning }) => meaning === "wall-network" || meaning === "construction-surface")).toBe(true);
  });

  it("offers the three-point arc wherever ordinary drawn geometry is valid", () => {
    for (const layerId of ["terrain", "boundaries", "buildings", "construction", "equipment", "sketch"] as const) {
      expect(availableInstruments(layerId, getWorkLayer(layerId).defaultSubjectId)).toContain("arc");
    }
    expect(availableInstruments("openings", "opening.door")).not.toContain("arc");
  });

  it("restores the selected outline shape after using the hand and retains it between operations", () => {
    let state = chooseInstrument(createToolboxState("terrain"), "rectangle");
    expect(outlineInstrumentFor(state)).toBe("rectangle");
    state = chooseInstrument(state, "select");
    expect(outlineInstrumentFor(state)).toBe("rectangle");
    expect(state.byLayer.terrain.instrumentId).toBe("select");
    expect(outlineInstrumentFor(state)).toBe("rectangle");
    state = activateLayer(state, "buildings");
    state = chooseInstrument(state, "select");
    expect(outlineInstrumentFor(state)).toBe("rectangle");
  });
});
