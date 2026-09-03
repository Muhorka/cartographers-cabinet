import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyProject } from "../../model/project-model";
import { StoryRoutePanel } from "./story-route-panel";
import { findStoryRoutes } from "../routes/planner";
import type { RouteCalculationOutcome, StoryRouteCalculationService } from "../routes/route-service";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function project() {
  const value = emptyProject("routes", "Routes");
  value.places.push({ id: "grounds", name: "Grounds", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 10, y: 20, width: 4, height: 6 }, tags: [], access: [], properties: {} });
  return value;
}

describe("story route panel calculation lifecycle", () => {
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
