import { findStoryRoutes } from "./planner";
import type { StoryRouteRequest, StoryRouteResult } from "./types";
import type { EditorProject } from "../../model/project-model";

type RouteCalculationStatus = "ready" | "timeout" | "cancelled" | "error" | "stale";
export type RouteCalculationOutcome = {
  status: RouteCalculationStatus;
  result?: StoryRouteResult;
  error?: string;
  attemptId: number;
};

type WorkerMessage = { type: "result"; attemptId: number; result: StoryRouteResult } | { type: "error"; attemptId: number; error: string };
type RouteWorker = { postMessage(message: unknown): void; terminate(): void; onmessage: ((event: { data: WorkerMessage }) => void) | null; onerror: ((event: unknown) => void) | null };
type RouteWorkerFactory = () => RouteWorker;

export type StoryRouteCalculationService = {
  calculate(project: EditorProject, query: StoryRouteRequest): Promise<RouteCalculationOutcome>;
  cancel(): void;
  dispose(): void;
};

export type RouteServiceOptions = { timeoutMs?: number; workerFactory?: RouteWorkerFactory };

function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

function browserWorker(): RouteWorker {
  if (typeof Worker === "undefined") throw new Error("Route worker is unavailable in this browser.");
  return new Worker(new URL("./route-worker.ts", import.meta.url), { type: "module" }) as unknown as RouteWorker;
}

/** Production route execution. A new request cancels and terminates the previous worker. */
export function createStoryRouteCalculationService(options: RouteServiceOptions = {}): StoryRouteCalculationService {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const createWorker = options.workerFactory ?? browserWorker;
  let active: { attemptId: number; worker: RouteWorker; timer: ReturnType<typeof setTimeout>; resolve: (outcome: RouteCalculationOutcome) => void } | undefined;
  let attemptId = 0; let disposed = false;
  const finish = (status: RouteCalculationStatus, current: typeof active, result?: StoryRouteResult, error?: string) => {
    if (!current || active !== current) return;
    clearTimeout(current.timer); active = undefined; current.worker.onmessage = null; current.worker.onerror = null; current.worker.terminate();
    current.resolve({ status, ...(result ? { result } : {}), ...(error ? { error } : {}), attemptId: current.attemptId });
  };
  return {
    calculate(project, query) {
      if (disposed) return Promise.resolve({ status: "error", error: "Route service is disposed.", attemptId: attemptId + 1 });
      if (active) finish("cancelled", active);
      const currentAttempt = ++attemptId;
      return new Promise<RouteCalculationOutcome>((resolve) => {
        let worker: RouteWorker;
        try { worker = createWorker(); }
        catch (error) { resolve({ status: "error", error: message(error), attemptId: currentAttempt }); return; }
        const current = { attemptId: currentAttempt, worker, timer: undefined as unknown as ReturnType<typeof setTimeout>, resolve };
        current.timer = setTimeout(() => finish("timeout", current, undefined, `Route calculation exceeded ${timeoutMs / 1000} seconds.`), timeoutMs);
        active = current;
        worker.onmessage = (event) => {
          const data = event.data as Partial<WorkerMessage> | undefined;
          if (!data || typeof data !== "object" || data.attemptId !== currentAttempt) return;
          if (data.type === "result" && data.result) finish("ready", current, data.result);
          else if (data.type === "error" && typeof data.error === "string") finish("error", current, undefined, data.error);
          else finish("error", current, undefined, "Route worker returned an invalid response.");
        };
        worker.onerror = () => finish("error", current, undefined, "Route worker failed.");
        try { worker.postMessage({ type: "calculate", attemptId: currentAttempt, project, query }); }
        catch (error) { finish("error", current, undefined, message(error)); }
      });
    },
    cancel() { if (active) finish("cancelled", active); },
    dispose() { disposed = true; if (active) finish("cancelled", active); },
  };
}

/** Explicit synchronous adapter for Node tests and non-browser callers. */
export function createInlineStoryRouteCalculationService(): StoryRouteCalculationService {
  let active = 0; let disposed = false;
  return {
    async calculate(project, query) {
      if (disposed) return { status: "error", error: "Route service is disposed.", attemptId: active };
      const attemptId = ++active;
      try { return { status: "ready", result: findStoryRoutes(project, query), attemptId }; }
      catch (error) { return { status: "error", error: message(error), attemptId }; }
    },
    cancel() { active += 1; },
    dispose() { disposed = true; active += 1; },
  };
}
