import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyProject } from "../../model/project-model";
import { StoryRoutePanel } from "./story-route-panel";
import { findStoryRoutes, storyRouteRevision } from "../routes/planner";
import type { RouteCalculationOutcome, StoryRouteCalculationService } from "../routes/route-service";
import { createInlineStoryRouteCalculationService } from "../routes/route-service";
import type { StoryRouteAlternative, StoryRouteRecord } from "../routes/types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const routeService = createInlineStoryRouteCalculationService();

function project() {
  const value = emptyProject("routes", "Routes");
  value.places.push({ id: "grounds", name: "Grounds", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 10, y: 20, width: 4, height: 6 }, tags: [], access: [], properties: {} });
  return value;
}

describe("story route panel", () => {
  it("requests one route first and another variant only after the user asks", async () => {
    const value = project();
    let attemptId = 0;
    const calculate: StoryRouteCalculationService["calculate"] = vi.fn(async (_project, request): Promise<RouteCalculationOutcome> => {
      const first = findStoryRoutes(value, request); const count = request.alternativeLimit ?? 1;
      const routes = count > 1 && first.route ? [first.route, { ...first.route, id: "second-route", distance: first.route.distance + 1 }] : first.routes;
      return { status: "ready", result: { ...first, routes }, attemptId: ++attemptId };
    });
    const service: StoryRouteCalculationService = { calculate, cancel: vi.fn(), dispose: vi.fn() };
    const onPreview = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} activePlaceId="grounds" locale="en" context={{}} routeService={service} onPreview={onPreview} onSave={vi.fn()}/>));
    const click = async (text: string) => act(async () => { [...host.querySelectorAll("button")].find((button) => button.textContent === text)!.click(); await Promise.resolve(); });
    await click("Find route");
    expect(vi.mocked(calculate).mock.calls[0]?.[1].alternativeLimit).toBe(1); expect(host.querySelectorAll('[role="status"] details')).toHaveLength(1);
    await click("Find another route");
    expect(vi.mocked(calculate).mock.calls[1]?.[1].alternativeLimit).toBe(2); expect(host.querySelectorAll('[role="status"] details')).toHaveLength(2);
    expect(onPreview.mock.lastCall?.[0]).toMatchObject({ result: { status: "ready" } });
    await click("Hide preview"); expect(onPreview.mock.lastCall?.[0]).toBeUndefined();
    act(() => root.unmount()); host.remove();
  });

  it("opens, recalculates and saves an existing route under the same identity", async () => {
    const value = project(); const query = { from: { placeId: "grounds", point: { x: 11, y: 21 } }, to: { placeId: "grounds", point: { x: 13, y: 25 } }, profile: "foot" as const };
    const result = findStoryRoutes(value, query); const initialRoute = { id: "saved-route", name: "Garden route", query, result, sourceRevision: result.sourceRevision };
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); const save = vi.fn(); const remove = vi.fn();
    act(() => root.render(<StoryRoutePanel project={value} initialRoute={initialRoute} locale="en" context={{}} routeService={routeService} onPreview={vi.fn()} onSave={save} onDelete={remove}/>));
    expect((host.querySelector("input") as HTMLInputElement).value).toBe("Garden route");
    const click = async (text: string) => act(async () => { [...host.querySelectorAll("button")].find((button) => button.textContent === text)!.click(); await Promise.resolve(); });
    await click("Find route"); await click("Save route");
    expect(save.mock.calls[0][0]).toMatchObject({ id: "saved-route", name: "Garden route", query });
    const profile = [...host.querySelectorAll("select")].find((select) => [...select.options].some((option) => option.value === "vehicle")) as HTMLSelectElement;
    await act(async () => { profile.value = "vehicle"; profile.dispatchEvent(new Event("change", { bubbles: true })); });
    expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Save route")).toBeUndefined();
    await click("Delete saved route"); expect(remove).toHaveBeenCalledWith("saved-route");
    act(() => root.unmount()); host.remove();
  });
  it("uses a point inside the selected place and requests map picking for each endpoint", async () => {
    const onPreview = vi.fn(); const onSave = vi.fn(); const onOpenPlace = vi.fn(); let request: ((value: { placeId: string; point: { x: number; y: number } }) => void) | undefined;
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={project()} activePlaceId="grounds" locale="en" context={{}} routeService={routeService} onPreview={onPreview} onSave={onSave} onOpenPlace={onOpenPlace} onRequestPoint={(endpoint, accept) => { expect(endpoint).toBe("from"); request = accept; }}/>));
    expect((host.querySelector('input[type="number"]') as HTMLInputElement).value).toBe("12");
    const pickers = [...host.querySelectorAll("button")].filter((button) => button.textContent === "Pick on map");
    expect(pickers).toHaveLength(2);
    const picker = pickers[0] as HTMLButtonElement;
    await act(async () => picker.click());
    expect(onOpenPlace).toHaveBeenCalledWith("grounds"); expect(request).toBeDefined();
    await act(async () => request?.({ placeId: "grounds", point: { x: 11, y: 22 } }));
    expect((host.querySelector('input[type="number"]') as HTMLInputElement).value).toBe("11");
    await act(async () => root.unmount()); host.remove();
  });

  it("requires a concrete point for water terrain and opens the picker", async () => {
    const value = project();
    value.elements.push({ id: "river", belongsToId: "grounds", name: "River", layerId: "terrain", subjectId: "terrain.river", geometry: { kind: "region", shape: { kind: "rectangle", x: 11, y: 20, width: 1, height: 6 } }, visible: true, locked: false, tags: ["water"], access: [], properties: {} });
    let request: ((point: { placeId: string; point: { x: number; y: number } }) => void) | undefined;
    const calculate = vi.fn(async () => ({ status: "cancelled" as const, attemptId: 1 }));
    const service: StoryRouteCalculationService = { calculate, cancel: vi.fn(), dispose: vi.fn() };
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} locale="en" context={{}} routeService={service} onPreview={vi.fn()} onSave={vi.fn()} onOpenPlace={vi.fn()} onRequestPoint={(endpoint, accept) => { expect(endpoint).toBe("from"); request = accept; }} />));
    const endpoint = host.querySelector('select[aria-label="From"]') as HTMLSelectElement;
    await act(async () => { endpoint.value = "terrain:river"; endpoint.dispatchEvent(new Event("change", { bubbles: true })); });
    const find = [...host.querySelectorAll("button")].find((button) => button.textContent === "Find route") as HTMLButtonElement;
    expect(request).toBeDefined(); expect(find.disabled).toBe(true); expect(host.textContent).toContain("Water terrain requires a concrete point");
    await act(async () => request?.({ placeId: "grounds", point: { x: 11.1, y: 23 } }));
    expect(find.disabled).toBe(false);
    await act(async () => find.click());
    expect(calculate).toHaveBeenCalledWith(value, expect.objectContaining({ from: { placeId: "grounds", point: { x: 11.1, y: 23 } } }));
    await act(async () => root.unmount()); host.remove();
  });

  it("keeps route preferences optional and uses the vehicle default width", async () => {
    const onPreview = vi.fn(); const value = project(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} locale="en" context={{}} routeService={routeService} onPreview={onPreview} onSave={vi.fn()}/>));
    const selects = [...host.querySelectorAll("select")]; const profile = selects.find((select) => [...select.options].some((option) => option.value === "vehicle")) as HTMLSelectElement;
    await act(async () => { profile.value = "vehicle"; profile.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("Mode default: 2.5 m");
    const preference = [...host.querySelectorAll("select")].find((select) => [...select.options].some((option) => option.value === "true")) as HTMLSelectElement;
    await act(async () => { preference.value = "true"; preference.dispatchEvent(new Event("change", { bubbles: true })); });
    const calculate = [...host.querySelectorAll("button")].find((button) => button.textContent === "Find route") as HTMLButtonElement;
    await act(async () => calculate.click());
    expect(onPreview).toHaveBeenCalled();
    expect(onPreview.mock.calls.at(-1)?.[0]?.query).toMatchObject({ profile: "vehicle", preferences: { preferRoads: true } });
    expect(onPreview.mock.calls.at(-1)?.[0]?.query.width).toBeUndefined();
    await act(async () => root.unmount()); host.remove();
  });

  it("stops presenting a pending calculation as running after the query changes", async () => {
    let resolve!: (outcome: RouteCalculationOutcome) => void;
    const pendingService: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((done) => { resolve = done; })), cancel: vi.fn(), dispose: vi.fn() };
    const value = project(); const onPreview = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} locale="en" context={{}} routeService={pendingService} onPreview={onPreview} onSave={vi.fn()}/>));
    const find = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Find route" || button.textContent === "Calculating…") as HTMLButtonElement;
    await act(async () => find().click()); expect(find().disabled).toBe(true);
    const profile = [...host.querySelectorAll("select")].find((select) => [...select.options].some((option) => option.value === "vehicle")) as HTMLSelectElement;
    await act(async () => { profile.value = "vehicle"; profile.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(pendingService.cancel).toHaveBeenCalled(); expect(onPreview.mock.calls.at(-1)?.[0]).toBeUndefined(); expect(host.textContent).toContain("The plan or query changed during calculation"); expect(find().disabled).toBe(false);
    await act(async () => { profile.value = "foot"; profile.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("The plan or query changed during calculation"); expect(find().disabled).toBe(false);
    resolve({ status: "ready", result: findStoryRoutes(value, { from: { placeId: "grounds", point: { x: 12, y: 23 } }, to: { placeId: "grounds", point: { x: 12, y: 23 } } }), attemptId: 1 });
    await act(async () => { await Promise.resolve(); }); expect(host.textContent).toContain("The plan or query changed during calculation");
    await act(async () => root.unmount()); host.remove();
  });

  it("normalizes omitted route defaults when opening a saved route", async () => {
    const value = project(); const query = { from: { placeId: "grounds", point: { x: 11, y: 21 } }, to: { placeId: "grounds", point: { x: 13, y: 25 } } };
    const result = findStoryRoutes(value, query); const initialRoute = { id: "saved-route", name: "Garden route", query, result, sourceRevision: result.sourceRevision };
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} initialRoute={initialRoute} locale="en" context={{}} routeService={routeService} onPreview={vi.fn()} onSave={vi.fn()} />));
    expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Save route")).toHaveProperty("disabled", false);
    await act(async () => root.unmount()); host.remove();
  });

  it.each(["en", "pl"] as const)("resolves route diagnostic IDs to user-facing names in %s", async (locale) => {
    const value = project();
    value.places.push(
      { id: "gate-level", parentId: "grounds", name: "Gate level", kind: "level", constructionId: "gate-plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      { id: "room-uuid", parentId: "gate-level", name: "Gatekeeper's Room", kind: "room", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
    );
    value.constructions.push({ id: "gate-plan", revision: 0, walls: [{ id: "gate-wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "boundary", thickness: .2 }], rooms: [{ id: "room-uuid", faceId: "gate-face", name: "Gatekeeper's Room", tags: [], access: [], properties: {} }], openings: [{ id: "passage-uuid", kind: "door", wallId: "gate-wall", position: .5, width: 1 }], transitions: [] });
    value.story.objects.push({ ref: { kind: "opening", id: "passage-uuid", scopeId: "gate-plan" }, metadata: { narrativeLabel: "North passage" } });
    const sourceRevision = storyRouteRevision(value);
    const query = { from: { placeId: "grounds", point: { x: 11, y: 21 } }, to: { placeId: "room-uuid", point: { x: 11, y: 21 } }, profile: "foot" as const };
    const alternative = { id: "named-diagnostic", sourceRevision, segments: [{ placeId: "grounds", kind: "outdoor" as const, points: [query.from.point, query.to.point] }], points: [query.from.point, query.to.point], distance: 7, conditions: ["Confirm who is allowed to use room-uuid.", "Confirm who is allowed to use passage-uuid."], reasons: [], usedOpeningIds: [], usedTransitionIds: [] } satisfies StoryRouteAlternative;
    const initialRoute = { id: "named-diagnostic", name: "Gate route", query, result: { status: "ready" as const, revision: 0, sourceRevision, routes: [alternative], route: alternative, missingFacts: [], reasons: [] }, sourceRevision } satisfies StoryRouteRecord;
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} initialRoute={initialRoute} locale={locale} context={{}} routeService={routeService} onPreview={vi.fn()} onSave={vi.fn()} />));
    expect(host.textContent).toContain(locale === "pl" ? "Ustal, kto może skorzystać z obiektu „Gatekeeper's Room”." : "Confirm who is allowed to use Gatekeeper's Room.");
    expect(host.textContent).toContain(locale === "pl" ? "Ustal, kto może skorzystać z obiektu „North passage”." : "Confirm who is allowed to use North passage.");
    expect(host.textContent).not.toContain("room-uuid");
    expect(host.textContent).not.toContain("passage-uuid");
    await act(async () => root.unmount()); host.remove();
  });

  it.each(["en", "pl"] as const)("summarizes a ready route and offers explicit endpoint navigation in %s", async (locale) => {
    const value = project();
    value.places.push({ id: "far-level", name: locale === "pl" ? "Dalekie piętro" : "Far level", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, tags: [], access: [], properties: {} });
    const sourceRevision = storyRouteRevision(value);
    const query = { from: { placeId: "far-level", point: { x: 1, y: 1 } }, to: { placeId: "far-level", point: { x: 8, y: 8 } }, profile: "foot" as const };
    const alternative = { id: "far-route", sourceRevision, segments: [{ placeId: "far-level", levelId: "far-level", kind: "indoor" as const, points: [query.from.point, query.to.point] }], points: [query.from.point, query.to.point], distance: 12.3, conditions: [], reasons: [], usedOpeningIds: [], usedTransitionIds: [] } satisfies StoryRouteAlternative;
    const initialRoute = { id: "far-route", name: "Far route", query, result: { status: "ready" as const, revision: 0, sourceRevision, routes: [alternative], route: alternative, missingFacts: [], reasons: [] }, sourceRevision } satisfies StoryRouteRecord;
    const onOpenPlace = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} activePlaceId="grounds" locale={locale} context={{}} initialRoute={initialRoute} onPreview={vi.fn()} onSave={vi.fn()} onOpenPlace={onOpenPlace}/>));
    expect(host.textContent).toContain(locale === "pl" ? "Dalekie piętro → Dalekie piętro · 12.3 m · 1 arkusz" : "Far level → Far level · 12.3 m · 1 sheet");
    expect(host.textContent).toContain(locale === "pl" ? "Żaden odcinek tej trasy nie jest widoczny na bieżącym arkuszu." : "No segment of this route is visible on the current sheet.");
    const labels = locale === "pl" ? ["Pokaż początek trasy", "Pokaż koniec trasy"] : ["Show route start", "Show route end"];
    for (const label of labels) await act(async () => { [...host.querySelectorAll("button")].find((button) => button.textContent === label)!.click(); });
    expect(onOpenPlace).toHaveBeenNthCalledWith(1, "far-level"); expect(onOpenPlace).toHaveBeenNthCalledWith(2, "far-level");
    await act(async () => root.unmount()); host.remove();
  });

  it("hides the endpoint button when that endpoint is already visible", async () => {
    const value = project();
    value.places.push({ id: "far-level", name: "Far level", kind: "level", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 10, height: 10 }, tags: [], access: [], properties: {} });
    const sourceRevision = storyRouteRevision(value);
    const query = { from: { placeId: "far-level", point: { x: 1, y: 1 } }, to: { placeId: "grounds", point: { x: 2, y: 2 } }, profile: "foot" as const };
    const alternative = { id: "mixed-route", sourceRevision, segments: [{ placeId: "far-level", levelId: "far-level", kind: "indoor" as const, points: [query.from.point, { x: 2, y: 2 }] }, { placeId: "grounds", kind: "outdoor" as const, points: [{ x: 2, y: 2 }, query.to.point] }], points: [query.from.point, query.to.point], distance: 20, conditions: [], reasons: [], usedOpeningIds: [], usedTransitionIds: [] } satisfies StoryRouteAlternative;
    const initialRoute = { id: "mixed-route", name: "Mixed route", query, result: { status: "ready" as const, revision: 0, sourceRevision, routes: [alternative], route: alternative, missingFacts: [], reasons: [] }, sourceRevision } satisfies StoryRouteRecord;
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<StoryRoutePanel project={value} activePlaceId="grounds" locale="en" context={{}} initialRoute={initialRoute} onPreview={vi.fn()} onSave={vi.fn()} onOpenPlace={vi.fn()} />));
    expect(host.textContent).not.toContain("No segment of this route is visible on the current sheet.");
    expect(host.textContent).toContain("Show route start"); expect(host.textContent).not.toContain("Show route end");
    await act(async () => root.unmount()); host.remove();
  });

  it("keeps an in-flight calculation across cosmetic project and lens changes", async () => {
    let resolve!: (outcome: RouteCalculationOutcome) => void;
    let request: Parameters<StoryRouteCalculationService["calculate"]>[1] | undefined;
    const pendingService: StoryRouteCalculationService = {
      calculate: vi.fn((_project, nextRequest) => {
        request = nextRequest;
        return new Promise<RouteCalculationOutcome>((done) => { resolve = done; });
      }),
      cancel: vi.fn(),
      dispose: vi.fn(),
    };
    const value = project(); const onPreview = vi.fn(); const onSave = vi.fn();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const render = (nextProject = value, lensId?: string) => root.render(<StoryRoutePanel project={nextProject} locale="en" context={{ lensId }} routeService={pendingService} onPreview={onPreview} onSave={onSave} />);
    await act(async () => render());
    const find = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Find route" || button.textContent === "Calculating…") as HTMLButtonElement;
    await act(async () => find().click()); expect(find().textContent).toBe("Calculating…");

    const renamed = { ...value, name: "Renamed while calculating", updatedAt: "2099-01-01T00:00:00.000Z" };
    await act(async () => render(renamed, "presentation-only-lens"));
    expect(pendingService.cancel).not.toHaveBeenCalled(); expect(find().textContent).toBe("Calculating…");

    resolve({ status: "ready", result: findStoryRoutes(value, request!), attemptId: 1 });
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).toContain("Best route found"); expect(onPreview.mock.lastCall?.[0]).toMatchObject({ result: { status: "ready" } });
    await act(async () => root.unmount()); host.remove();
  });

  it("keeps a cancelled calculation stale across a context round trip", async () => {
    let resolve!: (outcome: RouteCalculationOutcome) => void;
    const pendingService: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((done) => { resolve = done; })), cancel: vi.fn(), dispose: vi.fn() };
    const value = project(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const render = (scenarioId: string) => root.render(<StoryRoutePanel project={value} locale="en" context={{ scenarioId }} routeService={pendingService} onPreview={vi.fn()} onSave={vi.fn()} />);
    await act(async () => render("a"));
    const find = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Find route" || button.textContent === "Calculating…") as HTMLButtonElement;
    await act(async () => find().click()); expect(find().disabled).toBe(true);
    await act(async () => render("b")); expect(host.textContent).toContain("The plan or query changed during calculation"); expect(find().disabled).toBe(false);
    await act(async () => render("a")); expect(host.textContent).toContain("The plan or query changed during calculation"); expect(find().disabled).toBe(false);
    resolve({ status: "ready", result: findStoryRoutes(value, { from: { placeId: "grounds", point: { x: 12, y: 23 } }, to: { placeId: "grounds", point: { x: 12, y: 23 } } }), attemptId: 1 });
    await act(async () => { await Promise.resolve(); });
    await act(async () => root.unmount()); host.remove();
  });
});
