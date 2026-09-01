import { describe, expect, it, vi } from "vitest";
import { constructionClearCategoryForToolbox, constructionClearNotice } from "./construction-clear-notice";
import { chooseSubject, createToolboxState } from "../toolbox/toolbox-state";

describe("construction clear notice", () => {
  it("shows every clear category and the exact selected scope", () => {
    const onCategoryChange = vi.fn(); const onConfirm = vi.fn(); const onCancel = vi.fn();
    const notice = constructionClearNotice({ locale: "pl", place: "Parter", category: "platforms", confirmLabel: "Wyczyść", cancelLabel: "Anuluj", onCategoryChange, onConfirm, onCancel });
    expect(notice.message).toContain("podesty, tarasy, balkony, ganki, antresole i sceny");
    expect(notice.actions.map(({ label }) => label)).toEqual(["Ściany", "Schody i windy", "Podesty i balkony", "Drzwi", "Okna", "Bramy", "Przejścia", "Wyczyść", "Anuluj"]);
    expect(notice.actions.find(({ id }) => id === "clear-category-walls")?.primary).toBe(false);
    notice.actions.find(({ id }) => id === "clear-category-walls")!.onClick(); expect(onCategoryChange).toHaveBeenCalledWith("walls");
    notice.actions.find(({ id }) => id === "confirm-clear-construction")!.onClick(); expect(onConfirm).toHaveBeenCalledOnce();
    notice.actions.find(({ id }) => id === "cancel-clear-construction")!.onClick(); expect(onCancel).toHaveBeenCalledOnce();
  });

  it("describes wall side effects and supports an individual opening category", () => {
    const notice = constructionClearNotice({ locale: "pl", place: "Parter", category: "doors", confirmLabel: "Wyczyść", cancelLabel: "Anuluj", onCategoryChange: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() });
    expect(notice.message).toContain("drzwi");
    const wallNotice = constructionClearNotice({ locale: "pl", place: "Parter", category: "walls", confirmLabel: "Wyczyść", cancelLabel: "Anuluj", onCategoryChange: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() });
    expect(wallNotice.message).toContain("osadzone w usuniętych ścianach");
  });

  it("defaults to the currently selected opening kind", () => {
    const toolbox = chooseSubject(createToolboxState("openings"), "opening.window");
    expect(constructionClearCategoryForToolbox(toolbox)).toBe("windows");
  });
});
