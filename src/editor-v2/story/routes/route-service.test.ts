import { describe, expect, it, vi } from "vitest";
import { createInlineStoryRouteCalculationService, createStoryRouteCalculationService, type RouteServiceOptions } from "./route-service";
import { emptyProject, type EditorProject } from "../../model/project-model";
import type { StoryRouteResult } from "./types";

const project = { id: "p" } as EditorProject;
const query = { from: { placeId: "a", point: { x: 0, y: 0 } }, to: { placeId: "a", point: { x: 1, y: 1 } } };
const result = { status: "unreachable", revision: 0, sourceRevision: "r", routes: [], missingFacts: [], reasons: [] } as StoryRouteResult;

function fakeWorkers() {
  const workers: Array<{ postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn>; onmessage: ((event: { data: unknown }) => void) | null; onerror: ((event: unknown) => void) | null }> = [];
  const options: RouteServiceOptions = { timeoutMs: 20, workerFactory: () => { const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }; workers.push(worker); return worker; } };
  return { workers, options };
}

describe("story route calculation service", () => {
  it("terminates the previous worker and marks its result cancelled when a newer request starts", async () => {
    const fake = fakeWorkers(); const service = createStoryRouteCalculationService(fake.options);
    const first = service.calculate(project, query); const second = service.calculate(project, query);
    expect(await first).toMatchObject({ status: "cancelled", attemptId: 1 }); expect(fake.workers[0]!.terminate).toHaveBeenCalledOnce();
    fake.workers[1]!.onmessage?.({ data: { type: "result", attemptId: 2, result } });
    expect(await second).toMatchObject({ status: "ready", result, attemptId: 2 }); service.dispose();
  });

  it("terminates on cancellation and reports timeout separately", async () => {
    const fake = fakeWorkers(); const service = createStoryRouteCalculationService(fake.options);
    const cancelled = service.calculate(project, query); service.cancel(); expect(await cancelled).toMatchObject({ status: "cancelled" });
    const timed = service.calculate(project, query); await new Promise((resolve) => setTimeout(resolve, 35)); expect(await timed).toMatchObject({ status: "timeout" }); expect(fake.workers[1]!.terminate).toHaveBeenCalledOnce(); service.dispose();
  });

  it("keeps an explicit inline adapter available for Node tests", async () => {
    const service = createInlineStoryRouteCalculationService(); const value = emptyProject("p", "Test"); const output = await service.calculate(value, query);
    expect(output.status).toBe("ready"); service.dispose();
  });
});
