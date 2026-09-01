import { findStoryRoutes } from "./planner";
import type { EditorProject } from "../../model/project-model";
import type { StoryRouteRequest } from "./types";

type RouteWorkerRequest = { type: "calculate"; attemptId: number; project: EditorProject; query: StoryRouteRequest };
const scope = globalThis as unknown as { onmessage: ((event: { data: RouteWorkerRequest }) => void) | null; postMessage(message: unknown): void };

scope.onmessage = (event) => {
  const input = event.data;
  if (input.type !== "calculate") return;
  try { scope.postMessage({ type: "result", attemptId: input.attemptId, result: findStoryRoutes(input.project, input.query) }); }
  catch (error) { scope.postMessage({ type: "error", attemptId: input.attemptId, error: error instanceof Error ? error.message : String(error) }); }
};
