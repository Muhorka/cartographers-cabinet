import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyProject, type EditorProject } from "../model/project-model";
import { storyRouteRevision } from "../story/routes/planner";
import type { StoryRouteRecord } from "../story/routes/types";
import { StoryRouteOverlay } from "./story-route-overlay";

function fixture(): EditorProject {
  return {
    ...emptyProject("synthetic", "Synthetic world"),
    places: [{ id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 20 }, tags: [], access: [], properties: {} }],
  };
}

function routeFor(project: EditorProject, query: StoryRouteRecord["query"], sourceRevision = storyRouteRevision(project)): StoryRouteRecord {
  const segment = { placeId: "world", kind: "outdoor" as const, points: [{ x: 1, y: 1 }, { x: 5, y: 5 }] };
  const alternative = { id: "synthetic-route", segments: [segment], points: segment.points, distance: 5.66, conditions: [], reasons: [], usedOpeningIds: [], usedTransitionIds: [] };
  return { id: "saved-route", name: "Synthetic route", query, sourceRevision, result: { status: "ready", revision: 0, sourceRevision, routes: [alternative], missingFacts: [], reasons: [] } };
}

function render(project: EditorProject, route: StoryRouteRecord, context: { scenarioId?: string; stepId?: string }) {
  return renderToStaticMarkup(<svg><StoryRouteOverlay project={project} activePlaceId="world" context={context} route={route}/></svg>);
}

describe("StoryRouteOverlay", () => {
  it("renders route evidence for its active scenario and step", () => {
    const project = fixture(); const route = routeFor(project, { from: { placeId: "world", point: { x: 1, y: 1 } }, to: { placeId: "world", point: { x: 5, y: 5 } }, scenarioId: "night", stepId: "arrival" });
    const html = render(project, route, { scenarioId: "night", stepId: "arrival" });
    expect(html).toContain('data-story-routes="true"'); expect(html).toContain("<path");
  });

  it("suppresses route evidence from another scenario or step", () => {
    const project = fixture(); const route = routeFor(project, { from: { placeId: "world", point: { x: 1, y: 1 } }, to: { placeId: "world", point: { x: 5, y: 5 } }, scenarioId: "night", stepId: "arrival" });
    expect(render(project, route, { scenarioId: "day", stepId: "arrival" })).toBe("<svg></svg>");
    expect(render(project, route, { scenarioId: "night", stepId: "departure" })).toBe("<svg></svg>");
  });

  it("suppresses route evidence with a stale source revision", () => {
    const project = fixture(); const route = routeFor(project, { from: { placeId: "world", point: { x: 1, y: 1 } }, to: { placeId: "world", point: { x: 5, y: 5 } }, scenarioId: "night", stepId: "arrival" }, "stale");
    expect(render(project, route, { scenarioId: "night", stepId: "arrival" })).toBe("<svg></svg>");
  });
});
