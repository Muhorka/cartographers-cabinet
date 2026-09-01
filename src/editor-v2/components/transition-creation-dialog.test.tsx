import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workbenchCopy } from "../i18n/workbench-copy";
import { createLevelForBuilding } from "../model/hierarchy-operations";
import { createStarterProject } from "../model/starter-project";
import { TransitionCreationDialog } from "./transition-creation-dialog";

const identity = { createId: () => crypto.randomUUID() };

describe("transition creation dialog", () => {
  it("lists the exact basement and upper levels instead of guessing a neighbour", () => {
    let project = createStarterProject("p", "Atlas", "pl");
    project = createLevelForBuilding(project, { id: "basement", constructionId: "basement-plan", buildingId: "p:building", name: "Piwnica", position: "below" }, identity);
    project = createLevelForBuilding(project, { id: "upper", constructionId: "upper-plan", buildingId: "p:building", name: "Piętro 1", position: "above" }, identity);
    const html = renderToStaticMarkup(createElement(TransitionCreationDialog, { project, activePlaceId: "p:level", kind: "stairs", copy: workbenchCopy.pl, onConfirm: vi.fn(), onCancel: vi.fn() }));
    expect(html).toContain("Piwnica"); expect(html).toContain("Piętro 1"); expect(html).toContain("w kształcie U");
  });

  it("resolves the automatic floor when a one-level building is open", () => {
    const project = createStarterProject("p", "Atlas", "pl");
    const html = renderToStaticMarkup(createElement(TransitionCreationDialog, { project, activePlaceId: "p:building", kind: "stairs", copy: workbenchCopy.pl, onConfirm: vi.fn(), onCancel: vi.fn() }));
    expect(html).toContain(workbenchCopy.pl.sameLevelRise);
  });

  it("keeps a clicked destination level and confirms the exact connection", () => {
    let project = createStarterProject("p", "Atlas", "pl");
    project = createLevelForBuilding(project, { id: "basement", constructionId: "basement-plan", buildingId: "p:building", name: "Piwnica", position: "below" }, identity);
    const onConfirm = vi.fn(); const container = document.createElement("div"); const root = createRoot(container);
    act(() => root.render(<TransitionCreationDialog project={project} activePlaceId="p:level" kind="stairs" copy={workbenchCopy.pl} onConfirm={onConfirm} onCancel={vi.fn()}/>));
    const destination = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => destination.click());
    expect(destination.checked).toBe(true);
    const buttons = container.querySelectorAll("button");
    act(() => (buttons[buttons.length - 1] as HTMLButtonElement).click());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ sourceLevelId: "p:level", targetLevelId: "basement", connectedLevelIds: ["p:level", "basement"] }));
    act(() => root.unmount());
  });
});
