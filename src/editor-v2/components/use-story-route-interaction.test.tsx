import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStoryRouteInteraction } from "./use-story-route-interaction";
import { reviewFixture, reviewQuery } from "../story/review/review-test-fixture";
import { findStoryRoutes } from "../story/routes/planner";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const unmounts: Array<() => void> = [];
afterEach(() => { unmounts.splice(0).forEach((unmount) => act(unmount)); });
function mount() {
  const project = reviewFixture(); const result = findStoryRoutes(project, reviewQuery);
  project.story.routes = ["first", "second"].map((id) => ({ id, name: id, query: reviewQuery, result, sourceRevision: result.sourceRevision }));
  let props: Parameters<typeof useStoryRouteInteraction>[0] = { project, context: {}, mode: "story", owner: "route-editor", activeRouteId: "first", activePlaceId: "level" };
  let value!: ReturnType<typeof useStoryRouteInteraction>;
  function Harness() { value = useStoryRouteInteraction(props); return null; }
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const render = (patch: Partial<typeof props> = {}) => { props = { ...props, ...patch }; act(() => root.render(<Harness/>)); };
  unmounts.push(() => { root.unmount(); host.remove(); }); render();
  return { render, current: () => value, route: project.story.routes[0]! };
}
describe("route interaction ownership", () => {
  it("rejects a point callback from a removed editor even after route selection returns to A", () => {
    const { render, current } = mount(); const accept = vi.fn();
    act(() => current().requestPoint("from", accept)); const abandoned = current().pointPicker!;
    render({ activeRouteId: "second" }); expect(current().pointPicker).toBeUndefined();
    render({ activeRouteId: "first" }); act(() => abandoned.onPick({ x: 2, y: 3 }));
    expect(accept).not.toHaveBeenCalled();
    act(() => current().requestPoint("to", accept)); const fresh = current().pointPicker!;
    act(() => { fresh.onPick({ x: 4, y: 5 }); fresh.onPick({ x: 8, y: 9 }); });
    expect(accept).toHaveBeenCalledExactlyOnceWith({ placeId: "level", point: { x: 4, y: 5 } });
  });

  it("does not let a retired review owner publish or clear a new editor preview", () => {
    const { render, current, route } = mount();
    render({ owner: "scene-review" }); const retired = current().previewReview;
    act(() => retired(route)); expect(current().route).toBe(route);
    render({ owner: "route-editor" }); expect(current().route).toBeUndefined();
    act(() => current().previewEditor(route)); act(() => retired()); expect(current().route).toBe(route);
    render({ owner: "scene-review" }); act(() => retired(route)); expect(current().route).toBeUndefined();
  });
});
