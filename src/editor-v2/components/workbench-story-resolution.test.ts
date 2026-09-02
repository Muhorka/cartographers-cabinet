import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { allStoryObjectRefs } from "../story/project-adapter";

const resolverCalls = vi.hoisted(() => [] as string[]);

vi.mock("../story/project-effective", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../story/project-effective")>();
  return {
    ...actual,
    createProjectStoryObjectResolver: (...args: Parameters<typeof actual.createProjectStoryObjectResolver>) => {
      const resolve = actual.createProjectStoryObjectResolver(...args);
      return (ref: Parameters<typeof resolve>[0]) => {
        resolverCalls.push(`${ref.kind}:${ref.scopeId ?? ""}:${ref.id}`);
        return resolve(ref);
      };
    },
  };
});

import { createWorkbenchStoryResolution, storyInspectorNeedsObjectCatalog } from "./workbench-story-resolution";
import { useWorkbenchStory } from "./use-workbench-story";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function projectSnapshot() {
  const project = emptyProject("lazy-story", "Lazy Story");
  project.places.push({ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
  project.elements.push(
    { id: "table", belongsToId: "world", name: "Table", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "point", at: { x: 1, y: 1 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
    { id: "tree", belongsToId: "world", name: "Tree", layerId: "terrain", subjectId: "terrain.vegetation", geometry: { kind: "point", at: { x: 2, y: 2 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
  );
  return new EditorSession(project, { initialPlaceId: "world" }).getViewState().project;
}

function largeSession(withEntityProperty = false) {
  const project = structuredClone(projectSnapshot());
  for (let index = 0; index < 100; index += 1) {
    project.elements.push({ id: `fixture-${index}`, belongsToId: "world", name: `Fixture ${index}`, layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "point", at: { x: index, y: index } }, visible: true, locked: false, tags: [], access: [], properties: {} });
  }
  if (withEntityProperty) project.story.propertyDefinitions = [{ id: "related", name: "Related object", type: "entity" }];
  return new EditorSession(project, { initialPlaceId: "world" });
}

function StoryHarness({ session, mode }: { session: EditorSession; mode: "drawing" | "story" }) {
  const snapshot = session.getViewState();
  const workbench = useWorkbenchStory({ session, snapshot, selections: [], inspectedPlaceId: "world", locale: "en", mode, refresh: vi.fn(), zoom: 1, onSelect: vi.fn(), onFocus: vi.fn(() => false), onOpenPlace: vi.fn(), onOpenWorldbook: vi.fn() });
  return createElement("div", null, workbench.inspector);
}

function openInspectorDetails(host: HTMLElement) {
  const details = host.querySelector("details")!;
  act(() => {
    details.open = true;
    details.dispatchEvent(new Event("toggle", { bubbles: true }));
  });
}

describe("lazy workbench Story resolution", () => {
  beforeEach(() => resolverCalls.splice(0));
  afterEach(() => vi.restoreAllMocks());

  it("hydrates only the requested selection until a complete catalog is needed", () => {
    const project = projectSnapshot();
    const refs = allStoryObjectRefs(project);
    const resolution = createWorkbenchStoryResolution(project, {}, {}, "en");

    expect(resolverCalls).toHaveLength(0);
    expect(resolution.resolve({ kind: "place", id: "world" })?.name).toBe("World");
    expect(resolverCalls).toHaveLength(1);

    const catalog = resolution.resolveObjects();
    expect(catalog).toHaveLength(refs.length);
    expect(resolverCalls).toHaveLength(1 + refs.length);
    expect(resolution.resolveObjects()).toBe(catalog);
    expect(resolution.resolveInspectorObjects()).toBe(catalog);
    expect(resolverCalls).toHaveLength(1 + refs.length);
  });

  it("does not hydrate every map object after a drawing transaction", () => {
    const session = largeSession();
    function Harness({ mode }: { mode: "drawing" | "story" }) {
      const snapshot = session.getViewState();
      useWorkbenchStory({ session, snapshot, selections: [], inspectedPlaceId: "world", locale: "en", mode, refresh: vi.fn(), zoom: 1, onSelect: vi.fn(), onFocus: vi.fn(() => false), onOpenPlace: vi.fn(), onOpenWorldbook: vi.fn() });
      return createElement("output", null, "ready");
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(createElement(Harness, { mode: "drawing" })));
      expect(resolverCalls).toHaveLength(1);

      session.executeTransaction({ id: "draw", apply: (current) => ({ ...current, elements: [...current.elements, { id: "drawn", belongsToId: "world", name: "Drawn", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "point", at: { x: 8, y: 8 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] }) });
      act(() => root.render(createElement(Harness, { mode: "drawing" })));
      expect(resolverCalls).toHaveLength(2);

      const refs = allStoryObjectRefs(session.getViewState().project);
      const beforeStory = resolverCalls.length;
      act(() => root.render(createElement(Harness, { mode: "story" })));
      expect(resolverCalls.length - beforeStory).toBeGreaterThanOrEqual(refs.length);
      expect(resolverCalls.length - beforeStory).toBeLessThanOrEqual(refs.length + 3);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps an open non-entity inspector lazy after returning to drawing", () => {
    const session = largeSession();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(createElement(StoryHarness, { session, mode: "story" })));
      openInspectorDetails(host);
      expect(host.querySelector("details")?.open).toBe(true);
      act(() => root.render(createElement(StoryHarness, { session, mode: "drawing" })));

      session.executeTransaction({ id: "draw-after-story", apply: (current) => ({ ...current, elements: [...current.elements, { id: "drawn-after-story", belongsToId: "world", name: "Drawn after Story", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "point", at: { x: 8, y: 8 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] }) });
      const beforeDrawingRender = resolverCalls.length;
      act(() => root.render(createElement(StoryHarness, { session, mode: "drawing" })));
      expect(resolverCalls.length - beforeDrawingRender).toBe(1);
      expect(host.querySelector("details")?.open).toBe(true);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("hydrates the catalog for an open entity inspector after returning to drawing", () => {
    const session = largeSession(true);
    expect(storyInspectorNeedsObjectCatalog(session.getViewState().project.story.propertyDefinitions, [{ kind: "place", id: "world" }])).toBe(true);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(createElement(StoryHarness, { session, mode: "story" })));
      openInspectorDetails(host);
      expect(host.querySelector("details")?.open).toBe(true);
      act(() => root.render(createElement(StoryHarness, { session, mode: "drawing" })));
      expect(host.querySelector("details")?.open).toBe(true);

      session.executeTransaction({ id: "draw-with-entity", apply: (current) => ({ ...current, elements: [...current.elements, { id: "drawn-with-entity", belongsToId: "world", name: "Drawn with entity", layerId: "equipment", subjectId: "equipment.furniture", geometry: { kind: "point", at: { x: 9, y: 9 } }, visible: true, locked: false, tags: [], access: [], properties: {} }] }) });
      const refs = allStoryObjectRefs(session.getViewState().project);
      const beforeDrawingRender = resolverCalls.length;
      act(() => root.render(createElement(StoryHarness, { session, mode: "drawing" })));
      expect(resolverCalls.length - beforeDrawingRender).toBe(refs.length + 1);
      expect(host.querySelector("details")?.open).toBe(true);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
