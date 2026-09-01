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

  it("ignores a delayed response from another attempt", async () => {
    const fake = fakeWorkers(); const service = createStoryRouteCalculationService(fake.options);
    const pending = service.calculate(project, query);
    fake.workers[0]!.onmessage?.({ data: { type: "result", attemptId: 99, result } });
    expect(fake.workers[0]!.terminate).not.toHaveBeenCalled();
    fake.workers[0]!.onmessage?.({ data: { type: "result", attemptId: 1, result } });
    expect(await pending).toMatchObject({ status: "ready", result, attemptId: 1 });
  });

  it("reports Worker execution and message delivery failures without leaving it active", async () => {
    const failedWorker = fakeWorkers(); const failedService = createStoryRouteCalculationService(failedWorker.options);
    const failed = failedService.calculate(project, query); failedWorker.workers[0]!.onerror?.(new Error("boom"));
    expect(await failed).toMatchObject({ status: "error", error: "Route worker failed." });
    expect(failedWorker.workers[0]!.terminate).toHaveBeenCalledOnce();

    const rejectedMessage = fakeWorkers();
    const rejectedService = createStoryRouteCalculationService({ ...rejectedMessage.options, workerFactory: () => {
      const worker = { postMessage: vi.fn(() => { throw new Error("clone failed"); }), terminate: vi.fn(), onmessage: null, onerror: null };
      rejectedMessage.workers.push(worker); return worker;
    } });
    expect(await rejectedService.calculate(project, query)).toMatchObject({ status: "error", error: "clone failed" });
    expect(rejectedMessage.workers[0]!.terminate).toHaveBeenCalledOnce();
  });

  it("does not create another Worker after disposal", async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null };
    const createWorker = vi.fn(() => worker);
    const service = createStoryRouteCalculationService({ workerFactory: createWorker });
    service.dispose();
    expect(await service.calculate(project, query)).toMatchObject({ status: "error", error: "Route service is disposed." });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("keeps an explicit inline adapter available for Node tests", async () => {
    const service = createInlineStoryRouteCalculationService(); const value = emptyProject("p", "Test"); const output = await service.calculate(value, query);
    expect(output.status).toBe("ready"); service.dispose();
  });
});
