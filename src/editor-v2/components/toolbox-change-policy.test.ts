import { describe, expect, it } from "vitest";
import { chooseInstrument, createToolboxState } from "../toolbox/toolbox-state";
import { canContinueSemanticDraft } from "./toolbox-change-policy";

describe("tool changes during a semantic draft", () => {
  it("allows mixing a pencil with a straight line in one object", () => {
    const pencil = createToolboxState("boundaries");
    expect(canContinueSemanticDraft(pencil, chooseInstrument(pencil, "line"), false)).toBe(true);
  });

  it("still asks for a decision before abandoning an unfinished multi-click gesture", () => {
    const polygon = chooseInstrument(createToolboxState("boundaries"), "polygon");
    expect(canContinueSemanticDraft(polygon, chooseInstrument(polygon, "pencil"), true)).toBe(false);
  });

  it("does not silently carry a semantic draft into selection mode", () => {
    const pencil = createToolboxState("boundaries");
    expect(canContinueSemanticDraft(pencil, chooseInstrument(pencil, "select"), false)).toBe(false);
  });
});
