import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { defaultMeasureSettings } from "../model/project-model";
import { fallbackMeasurementCopy, ViewMeasureControls } from "./view-measure-controls";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("grid opacity control", () => {
  it.each([0, .13, .137, 1])("can represent the saved opacity %s without clamping or step mismatch", async (gridOpacity) => {
    const host = document.createElement("div"); const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(ViewMeasureControls, { settings: { ...defaultMeasureSettings(), gridOpacity }, copy: fallbackMeasurementCopy })));
      const range = host.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(range.valueAsNumber).toBe(gridOpacity);
      expect(range.validity.stepMismatch).toBe(false);
      expect(range.min).toBe("0"); expect(range.max).toBe("1"); expect(range.step).toBe("any");
    } finally { await act(async () => root.unmount()); }
  });
});
