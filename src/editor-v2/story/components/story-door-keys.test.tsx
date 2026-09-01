import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyProject, type EditorProject } from "../../model/project-model";
import { StoryDoorKeys } from "./story-door-keys";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ref = { kind: "opening" as const, id: "door", scopeId: "plan" };

function fixture(): EditorProject {
  const project = emptyProject("door-keys", "Door keys");
  project.story.world = [
    { id: "anna", kind: "character", name: "Anna", tags: [], properties: {} },
    { id: "wardens", kind: "faction", name: "Wardens", tags: [], properties: {} },
    { id: "access", kind: "access-group", name: "Staff", tags: [], properties: {} },
    { id: "brass", kind: "key", name: "Brass key", tags: [], properties: {} },
    { id: "iron", kind: "key", name: "Iron key", tags: [], properties: {} },
  ];
  project.constructions = [{ id: "plan", revision: 0, walls: [], rooms: [], openings: [{ id: "door", kind: "door", wallId: "wall", position: .5, width: 1 }], transitions: [] }];
  project.story.objects = [{ ref, metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "open", lock: "locked", keyIds: [], guardIds: [], secretKnowledge: [] } } }];
  return project;
}

function render(project: EditorProject, props: Partial<React.ComponentProps<typeof StoryDoorKeys>> = {}) {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  act(() => root.render(<StoryDoorKeys project={project} ref={ref} locale="pl" onAssign={vi.fn()} {...props}/>));
  return { host, root };
}

describe("StoryDoorKeys", () => {
  it("does not create a key until a named holder is selected", () => {
    const project = fixture(); const onAssign = vi.fn(); const { host, root } = render(project, { onAssign });
    expect(host.textContent).toContain("Kto ma klucz do tych drzwi?");
    expect(host.textContent).toContain("Anna");
    const save = [...host.querySelectorAll("button")].find((button) => button.textContent === "Utwórz klucz i zapisz") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const anna = [...host.querySelectorAll("label")].find((label) => label.textContent?.includes("Anna"))?.querySelector("input") as HTMLInputElement;
    act(() => { anna.click(); });
    expect(save.disabled).toBe(false);
    act(() => { save.click(); });
    expect(onAssign).toHaveBeenCalledWith({ holderIds: ["anna"], keyName: "Klucz: Drzwi 1" });
    act(() => root.unmount()); host.remove();
  });

  it("renders one independent section per attached key and keeps holder names human-readable", () => {
    const project = fixture(); project.story.objects[0]!.metadata.access!.keyIds = ["brass", "iron"]; project.story.memberships = [{ subjectId: "anna", groupId: "brass", kind: "holds-key", source: "manual" }, { subjectId: "wardens", groupId: "iron", kind: "holds-key", source: "manual" }];
    const onAssign = vi.fn(); const { host, root } = render(project, { onAssign });
    expect(host.querySelectorAll("fieldset")).toHaveLength(2);
    expect(host.textContent).toContain("Klucz: Brass key"); expect(host.textContent).toContain("Klucz: Iron key");
    const buttons = [...host.querySelectorAll("button")].filter((button) => button.textContent === "Zapisz posiadaczy");
    expect(buttons).toHaveLength(2);
    act(() => (buttons[0] as HTMLButtonElement).click());
    expect(onAssign).toHaveBeenCalledWith({ keyId: "brass", holderIds: ["anna"] });
    act(() => root.unmount()); host.remove();
  });

  it("shows scenario context and exposes the worldbook escape hatch", () => {
    const project = fixture(); project.story.world.push({ id: "night", kind: "key", name: "Night key", tags: [], properties: {} }); project.story.scenarios = [{ id: "scene", name: "Scene", patches: [{ id: "door", target: ref, metadata: { access: { allow: [], deny: [], permission: "open", physicalState: "open", lock: "locked", keyIds: ["night"], guardIds: [], secretKnowledge: [] } } }], steps: [] }];
    const onOpenWorldbook = vi.fn(); const { host, root } = render(project, { target: "scenario", context: { scenarioId: "scene" }, onOpenWorldbook });
    expect(host.textContent).toContain("Klucz na drzwiach jest edytowany w wybranym scenariuszu");
    expect(host.textContent).toContain("Klucz: Night key");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Otwórz Księgę świata")?.click());
    expect(onOpenWorldbook).toHaveBeenCalledTimes(1);
    act(() => root.unmount()); host.remove();
  });
});
