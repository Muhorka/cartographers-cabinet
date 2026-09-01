import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSheet } from "./map-sheet";
import { EditorWorkbench } from "./editor-workbench";
import type { EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { createPlace } from "../model/hierarchy-operations";
import { effectiveProjectStoryObject } from "../story/project-effective";
import { storyRefKey, type StoryObjectRef } from "../story/types";
import { applyProjectStoryMetadata } from "../story/project-commands";
import { resolveStoryOwnership } from "../story/ownership";
import { EditorSession } from "../state/editor-session";

const harness = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined }));
vi.mock("../persistence/project-library", async (original) => ({
  ...await original<typeof import("../persistence/project-library")>(),
  listSavedProjects: async () => [harness.project!], getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:level" : undefined,
  setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: async (project: EditorProject) => project,
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn() }));
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { harness.sheet = props; return <svg aria-label="Test canvas"/>; } }));

let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
const state = () => harness.sheet!.project;
const panel = () => host.querySelector('aside[aria-label="Opis i powiązania"]')!;
const button = (name: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((element) => element.textContent === name)!;
const click = (name: string, scope: ParentNode = host) => act(() => button(name, scope).click());
const chooseTab = (name: string) => act(() => { const tab = [...host.querySelectorAll('[role="tab"]')].find((item) => item.textContent === name); expect(tab, name).toBeDefined(); tab!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const openDetails = () => act(() => [...panel().querySelectorAll("summary")].find((item) => item.textContent === "Cechy i powiązania")?.click());
const ownerChoices = () => [...panel().querySelectorAll("fieldset")].find((item) => item.querySelector("legend")?.textContent === "Do kogo należy?")!;
const select = (ref: StoryObjectRef) => act(() => harness.sheet!.onSelect?.({ kind: ref.kind, id: ref.id }));

function projectFixture() {
  let project = createStarterProject("p", "Synthetic ownership regression", "pl");
  const roomPlace = project.places.find(({ kind }) => kind === "room")!;
  const parentRef: StoryObjectRef = { kind: "place", id: "p:world" };
  const roomRef: StoryObjectRef = { kind: "room", id: roomPlace.id, scopeId: "p:plan" };
  const room = project.constructions[0]!.rooms.find(({ id }) => id === roomPlace.id)!;
  project = createPlace(project, { id: "free", name: "Samotna lokacja", kind: "location", boundary: { kind: "rectangle", x: -20, y: -20, width: 5, height: 5 } });
  const freeRef: StoryObjectRef = { kind: "place", id: "free" };
  roomPlace.description = ""; room.description = "";
  project.story.propertyDefinitions = [{ id: "flag", name: "Flaga", type: "boolean", group: "Test" }, { id: "count", name: "Liczba", type: "number", group: "Test" }];
  project.story.world = [{ id: "anna", kind: "character", name: "Anna", tags: [], properties: {} }, { id: "adam", kind: "character", name: "Adam", tags: [], properties: {} }, { id: "ewa", kind: "character", name: "Ewa", tags: [], properties: {} }];
  project.story.objects = [{ ref: parentRef, metadata: { owners: ["anna"] } }, { ref: roomRef, metadata: { narrativeDescription: "", tags: ["keep"], properties: { flag: false, count: 0 } } }, { ref: freeRef, metadata: { owners: [] } }];
  return { project, roomRef, freeRef, wallRef: { kind: "wall", id: project.constructions[0]!.walls[0]!.id, scopeId: "p:plan" } as StoryObjectRef };
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.useFakeTimers();
  harness.project = projectFixture().project; harness.sheet = undefined; host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>)); click("Opowieść");
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("ownership through the real Story workbench", () => {
  it("uses an explicit empty local owner list to clear an inherited owner", () => {
    const { roomRef } = projectFixture(); select(roomRef); openDetails();
    const anna = [...ownerChoices().querySelectorAll("label")].find((item) => item.textContent === "Anna")!.querySelector("input") as HTMLInputElement;
    expect(anna.checked).toBe(true); act(() => anna.click()); click("Zapisz");
    const local = state().story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(roomRef));
    expect(local?.metadata.owners).toEqual([]);
    expect(effectiveProjectStoryObject(state(), roomRef)?.metadata.owners).toEqual([]);
  });

  it("lets the shared owner picker assign a character directly to an individual wall", () => {
    const { wallRef } = projectFixture(); select(wallRef); openDetails();
    const anna = [...ownerChoices().querySelectorAll("label")].find((item) => item.textContent === "Anna")!.querySelector("input") as HTMLInputElement;
    expect(anna.checked).toBe(true); expect(effectiveProjectStoryObject(state(), wallRef)?.metadata.owners).toEqual(["anna"]); expect(state().story.objects.some(({ ref }) => storyRefKey(ref) === storyRefKey(wallRef))).toBe(false);
    act(() => anna.click()); const ewa = [...ownerChoices().querySelectorAll("label")].find((item) => item.textContent === "Ewa")!.querySelector("input") as HTMLInputElement; act(() => ewa.click()); click("Zapisz");
    const wall = state().story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(wallRef));
    expect(wall?.metadata.owners).toEqual(["ewa"]);
  });

  it("clears an old drawing geometry-conflict notice on entering Story and does not resurrect it", () => {
    click("Kreślenie");
    chooseTab("Teren");
    act(() => harness.sheet!.onGesture?.({ instrumentId: "rectangle", points: [{ x: 1, y: 1 }, { x: 1, y: 1 }] }));
    expect(host.textContent).toContain("konflikt geometrii");
    click("Opowieść");
    expect(host.textContent).not.toContain("Ta zmiana tworzy konflikt geometrii i nie została zastosowana.");
    click("Kreślenie");
    expect(host.textContent).not.toContain("Ta zmiana tworzy konflikt geometrii i nie została zastosowana.");
  });
});

it("resolves the nearest parent as inherited source and lets a local multi-owner override it", () => {
  const { project, roomRef } = projectFixture();
  expect(resolveStoryOwnership(project, project.story, { ...roomRef, scopeId: "ambiguous-scope" })).toMatchObject({ mode: "no-owner", effectiveOwners: [], directPresent: false, inheritedPresent: false });
  project.story.objects.push({ ref: { kind: "place", id: "p:level" }, metadata: { owners: ["ewa"] } });
  expect(resolveStoryOwnership(project, project.story, roomRef)).toMatchObject({ mode: "inherited", effectiveOwners: ["ewa"], inheritedOwners: ["ewa"], inheritedSource: { kind: "inherited", ref: { kind: "place", id: "p:level" }, name: "Parter" } });
  project.story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(roomRef))!.metadata.owners = ["anna", "ewa"];
  expect(resolveStoryOwnership(project, project.story, roomRef)).toMatchObject({ mode: "custom", effectiveOwners: ["anna", "ewa"], directOwners: ["anna", "ewa"], directSource: { kind: "local" } });
});

it("treats group ownership as inherited and resets an explicit empty override", () => {
  const { project, roomRef, freeRef } = projectFixture();
  project.story.groups = [{ id: "keepers", name: "Strażnicy", memberRefs: [freeRef], entryIds: [], metadata: { owners: ["ewa"] } }, { id: "room-keepers", name: "Opiekunowie pokoju", memberRefs: [roomRef], entryIds: [], metadata: { owners: ["ewa"] } }];
  expect(resolveStoryOwnership(project, project.story, freeRef)).toMatchObject({ mode: "no-owner", effectiveOwners: [], directOwners: [], directPresent: true });
  expect(resolveStoryOwnership(project, project.story, roomRef)).toMatchObject({ mode: "inherited", effectiveOwners: ["anna", "ewa"], inheritedSource: { kind: "inherited", sources: expect.arrayContaining([expect.objectContaining({ kind: "local" }), expect.objectContaining({ kind: "zone", zoneId: "room-keepers" })]) } });
  const custom = applyProjectStoryMetadata(project, { refs: [roomRef], metadata: { owners: ["adam"] }, action: "replace" });
  expect(resolveStoryOwnership(custom, custom.story, roomRef)).toMatchObject({ mode: "custom", effectiveOwners: ["adam"] });
  const customReset = applyProjectStoryMetadata(custom, { refs: [roomRef], metadata: {}, action: "replace", resetOwnership: true });
  expect(resolveStoryOwnership(customReset, customReset.story, roomRef)).toMatchObject({ mode: "inherited", effectiveOwners: ["anna", "ewa"] });
  const reset = applyProjectStoryMetadata(project, { refs: [freeRef], metadata: {}, action: "replace", resetOwnership: true });
  expect(reset.story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(freeRef))?.metadata).not.toHaveProperty("owners");
  expect(resolveStoryOwnership(reset, reset.story, freeRef)).toMatchObject({ mode: "inherited", effectiveOwners: ["ewa"], inheritedSource: { kind: "zone", zoneId: "keepers", name: "Strażnicy" } });
});

it("applies scenario and step ownership overrides, then resets without losing other metadata", () => {
  const { project, roomRef } = projectFixture();
  project.story.scenarios = [{ id: "night", name: "Noc", patches: [{ id: "level-owner", target: { kind: "place", id: "p:level" }, metadata: { owners: ["ewa"] } }], steps: [{ id: "arrival", name: "Wejście", patches: [{ id: "room-owner", target: roomRef, metadata: { owners: ["anna", "ewa"] } }] }] }];
  expect(resolveStoryOwnership(project, project.story, roomRef, { scenarioId: "night" })).toMatchObject({ mode: "inherited", effectiveOwners: ["ewa"], source: { kind: "inherited" } });
  expect(resolveStoryOwnership(project, project.story, roomRef, { scenarioId: "night", stepId: "arrival" })).toMatchObject({ mode: "custom", effectiveOwners: ["anna", "ewa"], directSource: { kind: "step" } });
  const resetStep = applyProjectStoryMetadata(project, { refs: [roomRef], metadata: {}, action: "replace", resetOwnership: true, target: "scenario", context: { scenarioId: "night", stepId: "arrival" } });
  expect(resolveStoryOwnership(resetStep, resetStep.story, roomRef, { scenarioId: "night", stepId: "arrival" })).toMatchObject({ mode: "inherited", effectiveOwners: ["ewa"], inheritedSource: { kind: "inherited" } });
  const reset = applyProjectStoryMetadata(project, { refs: [roomRef], metadata: {}, action: "replace", resetOwnership: true });
  const room = reset.story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(roomRef));
  expect(room?.metadata).not.toHaveProperty("owners"); expect(room?.metadata).toMatchObject({ tags: ["keep"], properties: { flag: false, count: 0 } });
  expect(resolveStoryOwnership(reset, reset.story, roomRef)).toMatchObject({ mode: "inherited", effectiveOwners: ["anna"] });
});

it("uses the shared edit guard for ownership reset", () => {
  const { project, roomRef } = projectFixture();
  expect(() => applyProjectStoryMetadata(project, { refs: [{ kind: "place", id: "missing" }], metadata: {}, action: "replace", resetOwnership: true })).toThrow(/missing/);
  project.places.find(({ id }) => id === roomRef.id)!.locked = true;
  expect(() => applyProjectStoryMetadata(project, { refs: [roomRef], metadata: {}, action: "replace", resetOwnership: true })).toThrow(/locked/);
});

it("rejects ambiguous nested scenario context before changing ownership", () => {
  const { project, roomRef } = projectFixture();
  project.story.scenarios = [{ id: "night", name: "Noc", patches: [], steps: [{ id: "arrival", name: "Wejście", patches: [] }, { id: "arrival", name: "Drugie wejście", patches: [] }] }];
  expect(() => applyProjectStoryMetadata(project, { refs: [roomRef], metadata: { owners: ["ewa"] }, action: "replace", target: "scenario", context: { scenarioId: "night", stepId: "arrival" } })).toThrow(/duplicate step|ambiguous/);
});

it("applies add and remove owner edits against effective inherited owners", () => {
  const { project, roomRef } = projectFixture();
  project.story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey({ kind: "place", id: "p:world" }))!.metadata.owners = ["anna", "adam"];
  const removed = applyProjectStoryMetadata(project, { refs: [roomRef], metadata: { owners: ["anna"] }, action: "remove" });
  expect(removed.story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(roomRef))?.metadata.owners).toEqual(["adam"]);
  const added = applyProjectStoryMetadata(project, { refs: [roomRef], metadata: { owners: ["ewa"] }, action: "add" });
  expect(added.story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(roomRef))?.metadata.owners).toEqual(["anna", "adam", "ewa"]);
  const replaced = applyProjectStoryMetadata(project, { refs: [roomRef], metadata: { owners: ["ewa"] }, action: "replace" });
  expect(replaced.story.objects.find(({ ref }) => storyRefKey(ref) === storyRefKey(roomRef))?.metadata.owners).toEqual(["ewa"]);
});

it("does not turn a Story metadata transaction into a construction change", () => {
  const { project, roomRef } = projectFixture(); const session = new EditorSession(project, { initialPlaceId: "p:level" }); const walls = structuredClone(session.getState().project.constructions[0]!.walls);
  const next = applyProjectStoryMetadata(session.getState().project, { refs: [roomRef], metadata: { owners: ["anna"] }, action: "replace" });
  expect(session.executeTransaction({ id: "story-owner", apply: () => next })).toMatchObject({ code: "committed", changed: true });
  expect(session.getState().project.constructions[0]!.walls).toEqual(walls);
});
