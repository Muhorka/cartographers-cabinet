import { describe, expect, it, vi } from "vitest";
import { createInlineStoryRouteCalculationService, type RouteCalculationOutcome, type StoryRouteCalculationService } from "../routes/route-service";
import { createSceneCheckService } from "./scene-check-service";
import { reviewFixture, reviewQuery } from "./review-test-fixture";

describe("scene check orchestration", () => {
  it("shares a calculated query within one attempt and checks independently on the next", async () => {
    const inline = createInlineStoryRouteCalculationService();
    const calculate = vi.fn(inline.calculate); const routes = { ...inline, calculate };
    const service = createSceneCheckService(routes); const project = reviewFixture();
    const result = await service.check(project, { intentionIds: ["reach", "pass"], query: reviewQuery });
    expect(result.status).toBe("complete"); expect(result.results.map(({ status }) => status)).toEqual(["satisfied", "satisfied"]);
    expect(calculate).toHaveBeenCalledTimes(1);
    await service.check(project, { intentionIds: ["reach"], query: reviewQuery });
    expect(calculate).toHaveBeenCalledTimes(2);
  });

  it("drops an observation when its source context changes during the worker request", async () => {
    let finish!: (value: RouteCalculationOutcome) => void; let current = true;
    const routes: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((resolve) => { finish = resolve; })), cancel: vi.fn(), dispose: vi.fn() };
    const service = createSceneCheckService(routes);
    const pending = service.check(reviewFixture(), { intentionIds: ["reach"], query: reviewQuery }, () => current);
    current = false;
    finish({ status: "ready", attemptId: 1, result: { status: "unreachable", revision: 0, sourceRevision: "r", routes: [], reasons: [], missingFacts: [] } });
    expect(await pending).toMatchObject({ status: "stale", results: [] });
  });

  it("cancels before processing further intentions and does not turn cancellation into blockage", async () => {
    let finish!: (value: RouteCalculationOutcome) => void;
    const routes: StoryRouteCalculationService = { calculate: vi.fn(() => new Promise<RouteCalculationOutcome>((resolve) => { finish = resolve; })), cancel: vi.fn(), dispose: vi.fn() };
    const service = createSceneCheckService(routes);
    const pending = service.check(reviewFixture(), { query: reviewQuery });
    service.cancel(); finish({ status: "cancelled", attemptId: 1 });
    expect(await pending).toMatchObject({ status: "cancelled", results: [] });
    expect(routes.calculate).toHaveBeenCalledTimes(1);
  });

  it("reports bounded coverage explicitly and does not expand an empty selection", async () => {
    const service = createSceneCheckService(createInlineStoryRouteCalculationService()); const project = reviewFixture();
    expect(await service.check(project, { refs: [] })).toMatchObject({ total: 0, results: [], truncated: false });
    expect(await service.check(project, { limit: 1 })).toMatchObject({ total: 3, truncated: true, results: [expect.any(Object)] });
  });
});
