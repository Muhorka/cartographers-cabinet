import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryIntentionReview, type StoryIntentionReviewProps } from "./story-intention-review";
import { createInlineStoryRouteCalculationService, type RouteCalculationOutcome, type StoryRouteCalculationService } from "../routes/route-service";
import { findStoryRoutes } from "../routes/planner";
import { reviewFixture, reviewQuery } from "../review/review-test-fixture";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const mounted: Array<{ root: Root; host: HTMLDivElement }> = [];
afterEach(async () => { for (const { root, host } of mounted.splice(0)) { await act(async () => root.unmount()); host.remove(); } });

function withRoute() {
  const project = reviewFixture(); const result = findStoryRoutes(project, reviewQuery);
  project.story.routes = [{ id: "saved", name: "Across the hall", query: reviewQuery, result, sourceRevision: result.sourceRevision }];
  return project;
}

async function renderPanel(props: Partial<StoryIntentionReviewProps> = {}) {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); mounted.push({ root, host });
  const initial = { project: withRoute(), context: {}, locale: "en" as const, routeService: createInlineStoryRouteCalculationService(), onFocus: vi.fn(), onOpenRoute: vi.fn(), onPreviewRoute: vi.fn(), ...props };
  const render = async (patch: Partial<StoryIntentionReviewProps> = {}) => { await act(async () => root.render(<StoryIntentionReview {...initial} {...patch}/>)); };
  await render();
  const button = (text: string) => [...host.querySelectorAll("button")].find((element) => element.textContent === text) as HTMLButtonElement;
  const select = async (index: number, value: string) => { await act(async () => { const element = host.querySelectorAll("select")[index]!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); }); };
  return { host, render, initial, button, select };
}

describe("scene intention panel", () => {
  it("shows the checked result, canonical focus and fresh route without changing the project", async () => {
    const project = withRoute(); project.story.intentions = project.story.intentions.filter(({ id }) => id === "reach");
    const before = structuredClone(project); const { host, initial, button, select } = await renderPanel({ project });
    await select(1, "saved"); await act(async () => button("Check intentions").click());
    expect(host.querySelector('[data-review-status="satisfied"]')).not.toBeNull();
    expect(host.textContent).toContain("The result applies to this particular calculated path");
    await act(async () => button("Show object").click());
    expect(initial.onFocus).toHaveBeenCalledWith([{ kind: "place", id: "level" }]);
    await act(async () => button("Show calculated route").click());
    expect(initial.onPreviewRoute).toHaveBeenCalledWith(expect.objectContaining({ id: "review-reach", query: expect.objectContaining(reviewQuery), result: expect.objectContaining({ status: "ready" }) }));
    expect(project).toEqual(before);
  });

  it("invalidates a pending check permanently across a scenario round trip", async () => {
    const project = withRoute(); project.story.intentions = project.story.intentions.filter(({ id }) => id === "reach");
    project.story.scenarios = [{ id: "day", name: "Day", patches: [], steps: [] }, { id: "night", name: "Night", patches: [], steps: [] }];
    let resolve!: (outcome: RouteCalculationOutcome) => void;
    const routeService: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((done) => { resolve = done; })), cancel: vi.fn(), dispose: vi.fn() };
    const { host, render, button, select } = await renderPanel({ project, context: { scenarioId: "day" }, routeService });
    await select(1, "saved"); await act(async () => button("Check intentions").click());
    expect(button("Checking…").disabled).toBe(true);
    await render({ context: { scenarioId: "night" } }); await render({ context: { scenarioId: "day" } });
    expect(host.textContent).toContain("out of date");
    await act(async () => resolve({ status: "ready", result: project.story.routes[0]!.result, attemptId: 1 }));
    expect(host.textContent).toContain("out of date"); expect(host.querySelector("[data-review-status]")).toBeNull();
    expect(routeService.cancel).toHaveBeenCalled();
  });

  it("hides an old proof after actor or selection changes, even when returning to the old values", async () => {
    const project = withRoute(); project.story.intentions = project.story.intentions.filter(({ id }) => id === "reach");
    const { host, render, button, select } = await renderPanel({ project, refs: [{ kind: "place", id: "level" }] });
    await select(1, "saved"); await act(async () => button("Check intentions").click());
    expect(host.querySelector('[data-review-status="satisfied"]')).not.toBeNull();
    await select(0, "alice"); await select(0, "");
    expect(host.textContent).toContain("out of date"); expect(host.querySelector("[data-review-status]")).toBeNull();
    await act(async () => button("Check intentions").click());
    await render({ refs: [] });
    expect(host.textContent).toContain("out of date"); expect(host.querySelector("[data-review-status]")).toBeNull();
  });

  it("withdraws a shown route when the actor, route selection, scope or attempt changes", async () => {
    const project = withRoute(); project.story.intentions = project.story.intentions.filter(({ id }) => id === "reach");
    project.story.routes.push({ ...project.story.routes[0]!, id: "other", name: "Other route" });
    const onPreviewRoute = vi.fn();
    const { render, button, select } = await renderPanel({ project, onPreviewRoute });
    const show = async () => { await act(async () => button("Check intentions").click()); await act(async () => button("Show calculated route").click()); expect(onPreviewRoute.mock.lastCall?.[0]).toHaveProperty("result"); };
    await select(1, "saved"); await show();
    await select(0, "alice"); expect(onPreviewRoute.mock.lastCall).toEqual([]);
    await show(); await select(1, "other"); expect(onPreviewRoute.mock.lastCall).toEqual([]);
    await show(); await act(async () => button("Check intentions").click()); expect(onPreviewRoute.mock.lastCall).toEqual([]);
    await show(); await render({ refs: [] }); expect(onPreviewRoute.mock.lastCall).toEqual([]);
  });

  it("does not expand an empty selection without the explicit all-intentions control", async () => {
    const { host, button } = await renderPanel({ refs: [] });
    expect(button("Check intentions").disabled).toBe(true);
    expect(host.textContent).toContain("No intentions in this scope");
    await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    expect(button("Check intentions").disabled).toBe(false);
    await act(async () => button("Check intentions").click());
    expect(host.querySelectorAll("[data-review-status]")).toHaveLength(3);
    expect(host.querySelector('[data-review-status="needs-author-review"]')).not.toBeNull();
  });

  it("keeps timeout and cancellation separate from unmet author intentions", async () => {
    const project = withRoute(); project.story.intentions = project.story.intentions.filter(({ id }) => id === "reach");
    const routeService: StoryRouteCalculationService = { calculate: vi.fn(async () => ({ status: "timeout" as const, attemptId: 1 })), cancel: vi.fn(), dispose: vi.fn() };
    const { host, button, select } = await renderPanel({ project, routeService });
    await select(1, "saved"); await act(async () => button("Check intentions").click());
    expect(host.querySelector('[data-review-status="timeout"]')).not.toBeNull();
    expect(host.querySelector('[data-review-status="blocked"]')).toBeNull();
    expect(host.textContent).toContain("not evidence of an inaccessible route");
    expect(project.story.intentions[0]?.status).toBe("accepted");
  });

  it("does not publish a late success after the user cancels", async () => {
    const project = withRoute(); project.story.intentions = project.story.intentions.filter(({ id }) => id === "reach");
    let resolve!: (outcome: RouteCalculationOutcome) => void;
    const routeService: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((done) => { resolve = done; })), cancel: vi.fn(), dispose: vi.fn() };
    const { host, button, select } = await renderPanel({ project, routeService });
    await select(1, "saved"); await act(async () => button("Check intentions").click());
    await act(async () => button("Cancel").click());
    await act(async () => resolve({ status: "ready", result: project.story.routes[0]!.result, attemptId: 1 }));
    expect(host.textContent).toContain("Check cancelled"); expect(host.querySelector("[data-review-status]")).toBeNull();
    expect(project.story.intentions[0]?.status).toBe("accepted");
  });
});
