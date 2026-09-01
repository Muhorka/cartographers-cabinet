import type { StoryRouteRequest } from "./types";

/** Default clear width used consistently by indoor and outdoor route planners. */
export function routeWidth(request: Pick<StoryRouteRequest, "profile" | "width">) {
  return request.width ?? (request.profile === "vehicle" ? 2.5 : request.profile === "mounted" ? 1.2 : .7);
}
