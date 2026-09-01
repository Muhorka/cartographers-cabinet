import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyProject } from "../../model/project-model";
import { StoryRoutePanel } from "./story-route-panel";
import { findStoryRoutes } from "../routes/planner";
import type { RouteCalculationOutcome, StoryRouteCalculationService } from "../routes/route-service";
import { createInlineStoryRouteCalculationService } from "../routes/route-service";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const routeService = createInlineStoryRouteCalculationService();

function project() {
  const value = emptyProject("routes", "Routes");
  value.places.push({ id: "grounds", name: "Grounds", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 10, y: 20, width: 4, height: 6 }, tags: [], access: [], properties: {} });
  return value;
}

describe("story route panel", () => {
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
    expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Save route")).toHaveProperty("disabled", true);
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
