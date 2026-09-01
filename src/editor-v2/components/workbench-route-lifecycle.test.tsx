import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSheet } from "./map-sheet";
import type { EditorProject } from "../model/project-model";
import { createStarterProject } from "../model/starter-project";
import { findStoryRoutes } from "../story/routes/planner";
import { EditorWorkbench } from "./editor-workbench";

const fixture = vi.hoisted(() => ({ project: undefined as EditorProject | undefined, sheet: undefined as ComponentProps<typeof MapSheet> | undefined }));
vi.mock("../persistence/project-library", async (original) => ({
  ...await original<typeof import("../persistence/project-library")>(),
  scanProjectLibrary: async () => ({ projects: [fixture.project!], recoveryRecords: [] }), getPreference: async (key: string) => key === "locale" ? "pl" : key === "activePlaceId:p" ? "p:world" : undefined,
  setPreference: async () => {}, listProjectCheckpoints: async () => [], saveProject: async (project: EditorProject) => project,
}));
vi.mock("../webmcp/use-editor-tools", () => ({ useEditorV2Tools: vi.fn() }));
vi.mock("../story/routes/route-service", async (original) => {
  const routeServices = await original<typeof import("../story/routes/route-service")>();
  return { ...routeServices, createStoryRouteCalculationService: routeServices.createInlineStoryRouteCalculationService };
});
vi.mock("./map-sheet", () => ({ MapSheet: (props: ComponentProps<typeof MapSheet>) => { fixture.sheet = props; return <svg aria-label="Test canvas">{props.storyOverlay}</svg>; } }));

let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
const button = (name: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((element) => element.textContent === name)!;
const click = (name: string, scope: ParentNode = host) => act(() => {
  const control = [...scope.querySelectorAll<HTMLElement>("button, summary")].find((element) => element.textContent === name);
  expect(control, name).toBeDefined(); control!.click();
  // jsdom queues native details events; these tests use fake timers.
  if (control!.tagName === "SUMMARY") control!.parentElement!.dispatchEvent(new Event("toggle"));
});
const review = () => host.querySelector('section[aria-label="Sprawdź założenia sceny"]')!;
const select = (label: string, value: string, scope: ParentNode = host) => act(() => {
  const element = [...scope.querySelectorAll("label")].find((node) => node.firstChild?.textContent === label)!.querySelector("select")!;
  element.value = value; element.dispatchEvent(new Event("change", { bubbles: true }));
});
const routePath = () => host.querySelector("[data-story-routes] path");
async function showReviewRoute() { await act(async () => button("Sprawdź założenia", review()).click()); click("Pokaż obliczoną trasę", review()); expect(routePath()).not.toBeNull(); }

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.useFakeTimers();
  const project = createStarterProject("p", "Synthetic route lifecycle", "pl");
  project.story.world = [{ id: "anna", kind: "character", name: "Anna", tags: [], properties: {} }];
  project.story.scenarios = [{ id: "night", name: "Noc", patches: [], steps: [{ id: "alarm", name: "Alarm", patches: [] }] }];
  project.story.intentions = [{ id: "reach", kind: "reachability", text: "Dojście przez atlas", subject: { kind: "place", id: "p:world" }, target: { kind: "place", id: "p:world" }, status: "accepted" }];
  const query = { from: { placeId: "p:world", point: { x: 3, y: 3 } }, to: { placeId: "p:world", point: { x: 8, y: 3 } } };
  const result = findStoryRoutes(project, query);
  project.story.routes = ["saved", "other"].map((id) => ({ id, name: id, query, result, sourceRevision: result.sourceRevision }));
  fixture.project = project;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<EditorWorkbench/>)); click("Opowieść");
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("route evidence and point requests in the real workbench", () => {
  async function openReview() {
    select("Trasa", "saved"); click("Sprawdź założenia sceny");
    act(() => (review().querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    select("Trasa do sprawdzenia", "saved", review()); await showReviewRoute();
  }

  it("withdraws review evidence for actor and scenario changes without restoring a selected saved route", async () => {
    await openReview();
    select("Postać, frakcja lub grupa osób", "anna", review()); expect(routePath()).toBeNull();
    select("Postać, frakcja lub grupa osób", "", review()); expect(routePath()).toBeNull();
    await showReviewRoute();
    select("Scenariusz", "night"); expect(routePath()).toBeNull();
    select("Scenariusz", ""); expect(routePath()).toBeNull();
    expect(fixture.sheet!.project.story.routes).toHaveLength(2);
    expect(fixture.sheet!.project.story.intentions[0].status).toBe("accepted");
  });

  it("withdraws review evidence permanently on a step round trip and when closing the panel", async () => {
    select("Scenariusz", "night"); await openReview();
    select("Kroki", "alarm"); expect(routePath()).toBeNull();
    select("Kroki", ""); expect(routePath()).toBeNull();
    await showReviewRoute(); click("Wróć do księgi świata"); expect(routePath()).toBeNull();
    click("Sprawdź założenia sceny"); expect(routePath()).toBeNull();
  });

  it("ends point picking when review replaces the route editor", () => {
    click("Księga świata"); click("Trasy"); click("Wskaż na mapie");
    const abandoned = fixture.sheet!.pointPicker!; expect(abandoned).toBeDefined();
    click("Sprawdź założenia sceny");
    expect(fixture.sheet!.pointPicker).toBeUndefined(); expect(host.textContent).not.toContain("Wskaż początek trasy na mapie.");
    act(() => abandoned.onPick({ x: 40, y: 50 }));
    expect(fixture.sheet!.pointPicker).toBeUndefined(); expect(review()).not.toBeNull();
  });

  it("opens the already selected saved route explicitly without losing its valid map preview", async () => {
    await openReview(); click("Otwórz trasę", review());
    expect(review()).toBeNull(); expect(host.querySelector('section[aria-label="Planowanie tras"]')).not.toBeNull();
    expect(routePath()).not.toBeNull();
  });
});
