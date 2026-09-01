import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyProject } from "../../model/project-model";
import { emptyStoryData, type StoryObjectRef } from "../types";
import { StoryScenarioEditor } from "./story-scenario-editor";

function fixture(target: StoryObjectRef = { kind: "place", id: "hall" }) {
  const project = emptyProject("project", "Test project");
  project.places = [{ id: "hall", name: "Hall", kind: "location", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} }];
  project.story = { ...emptyStoryData(), world: [{ id: "anna", kind: "character", name: "Anna", tags: [], properties: {} }], objects: [{ ref: target, metadata: { narrativeDescription: "Day" } }], scenarios: [{ id: "night", name: "Noc", description: "Po zmroku", patches: [{ id: "night-hall", target, description: "Dark" }], steps: [{ id: "alarm", name: "Alarm", description: "Alarm rings", patches: [{ id: "alarm-hall", target, description: "Closed" }] }] }] };
  return project;
}

const props = (project: ReturnType<typeof fixture>, overrides: Partial<React.ComponentProps<typeof StoryScenarioEditor>> = {}) => ({ project, scenarioId: "night", locale: "pl" as const, onActivate: vi.fn(), onChange: vi.fn(), onInspect: vi.fn(), onRemoveEffect: vi.fn(), onAddSelection: vi.fn(), selectionCount: 0, ...overrides });

describe("StoryScenarioEditor", () => {
  it("switches between the whole scenario and a step", () => {
    const project = fixture();
    const html = renderToStaticMarkup(<StoryScenarioEditor {...props(project)} />);
    expect(html).toContain("Cały scenariusz"); expect(html).toContain("Alarm");
    expect(html).toContain('aria-pressed="false"');
  });

  it("activates a step and adds a selection through host callbacks", async () => {
    const project = fixture(); const onActivate = vi.fn(); const onAddSelection = vi.fn();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryScenarioEditor {...props(project, { onActivate, onAddSelection, selectionCount: 2 })} />));
    const alarm = [...host.querySelectorAll("button")].find((button) => button.textContent === "Alarm");
    await act(async () => alarm?.click());
    expect(onActivate).toHaveBeenCalledWith("alarm");
    const add = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Dodaj skutek"));
    await act(async () => add?.click());
    expect(onAddSelection).toHaveBeenCalledWith(undefined);
    await act(async () => root.unmount()); host.remove();
  });

  it("shows context-specific effects and keeps an explicit remove action for missing targets", () => {
    const missing: StoryObjectRef = { kind: "place", id: "missing" }; const project = fixture(missing);
    const html = renderToStaticMarkup(<StoryScenarioEditor {...props(project, { activeStepId: "alarm" })} />);
    expect(html).toContain("Obiekt nie jest już dostępny");
    expect(html).toContain("Usuń tylko ten skutek");
    expect(html).toContain('disabled=""');
  });

  it("removes only the selected scenario effect, leaving the host in control", async () => {
    const onRemoveEffect = vi.fn(); const project = fixture();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryScenarioEditor {...props(project, { onRemoveEffect })} />));
    const remove = [...host.querySelectorAll("button")].find((button) => button.textContent === "Usuń tylko ten skutek");
    await act(async () => remove?.click());
    expect(onRemoveEffect).toHaveBeenCalledWith("night-hall", undefined);
    await act(async () => root.unmount()); host.remove();
  });

  it("renders named owners and access fields instead of storage ids", () => {
    const project = fixture(); const scenario = project.story.scenarios[0]!;
    scenario.patches[0]!.metadata = { owners: ["anna"], access: { allow: ["anna"], deny: [], permission: "restricted", physicalState: "open", lock: "none", keyIds: [], guardIds: [], secretKnowledge: [] } };
    const html = renderToStaticMarkup(<StoryScenarioEditor {...props(project)} />);
    expect(html).toContain("Właściciele"); expect(html).toContain("Kto może wejść"); expect(html).toContain("Anna"); expect(html).toContain("Wybrane osoby i grupy"); expect(html).not.toContain(">anna<");
  });

  it("keeps unchanged authored overrides behind a collapsed count", () => {
    const project = fixture(); project.story.scenarios[0]!.patches[0]!.title = "Hall";
    const html = renderToStaticMarkup(<StoryScenarioEditor {...props(project)} />);
    expect(html).toContain("bez zmiany (1)"); expect(html).not.toContain("Wpisano: Hall");
  });

  it("keeps locked effects inspectable but disables editing and removal", () => {
    const project = fixture(); project.places[0]!.locked = true;
    const html = renderToStaticMarkup(<StoryScenarioEditor {...props(project)} />);
    expect(html).toMatch(/<button type="button"[^>]*>Pokaż obiekt<\/button>/);
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Edytuj skutek<\/button>/);
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Usuń tylko ten skutek<\/button>/);
  });

  it("does not leave a deleted step active when the host rejects the save", async () => {
    const onActivate = vi.fn(); const onChange = vi.fn(() => false); const project = fixture();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryScenarioEditor {...props(project, { activeStepId: "alarm", onActivate, onChange })} />));
    const remove = [...host.querySelectorAll("button")].find((button) => button.textContent === "Usuń krok");
    await act(async () => remove?.click());
    expect(onChange).toHaveBeenCalled(); expect(onActivate).not.toHaveBeenCalled();
    await act(async () => root.unmount()); host.remove();
  });

  it("reads the latest controlled scenario after a parent update before editing", async () => {
    const project = fixture(); const onChange = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryScenarioEditor {...props(project, { onChange })} />));
    const latest = structuredClone(project); latest.story.scenarios[0]!.patches.push({ id: "new-patch", target: { kind: "place", id: "hall" }, description: "New" });
    await act(async () => root.render(<StoryScenarioEditor {...props(latest, { onChange })} />));
    const input = host.querySelector('input[value="Noc"]') as HTMLInputElement; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setter?.call(input, "Wieczór"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ name: "Wieczór", patches: expect.arrayContaining([expect.objectContaining({ id: "new-patch" })]) });
    await act(async () => root.unmount()); host.remove();
  });
});
