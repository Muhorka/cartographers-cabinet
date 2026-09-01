import { describe, expect, it } from "vitest";
import { EditorSession } from "../state/editor-session";
import { createInlineStoryRouteCalculationService } from "../story/routes/route-service";
import { reviewFixture, reviewQuery } from "../story/review/review-test-fixture";
import { createSceneCheckService } from "../story/review/scene-check-service";
import { inspectEditorContext } from "./editor-context";
import { createStoryReviewTools } from "./story-review-tools";

describe("scene review WebMCP", () => {
  function setup() {
    const session = new EditorSession(reviewFixture(), { initialPlaceId: "level" });
    const bridge = { getSession: () => session, getActivePlaceId: () => "level", refresh() {}, getEditorContext: () => ({ mode: "story" as const, selections: [{ type: "opening" as const, id: "door", scopeId: "construction" }], view: {} }) };
    const tool = createStoryReviewTools(bridge, createInlineStoryRouteCalculationService())[0]!;
    const execute = async (input: Record<string, unknown>) => (await tool.execute(input) as { structuredContent: unknown }).structuredContent;
    return { session, bridge, execute };
  }

  it("requires a current selection binding and never interprets it as all objects", async () => {
    const { execute, bridge } = setup();
    expect(await execute({})).toMatchObject({ status: "stale-context" });
    expect(await execute({ expectedContextVersion: "old" })).toMatchObject({ status: "stale-context" });
    expect(await execute({ expectedContextVersion: inspectEditorContext(bridge).contextVersion })).toMatchObject({ total: 2, status: "complete" });
    expect(await execute({ refs: [] })).toMatchObject({ total: 0, results: [] });
  });

  it("shares scene results with the UI service and leaves project data untouched", async () => {
    const { session, execute } = setup(); const project = session.getState().project; const before = structuredClone(project);
    const input = { scope: "all", intentionIds: ["reach", "pass"], query: reviewQuery };
    const expected = await createSceneCheckService(createInlineStoryRouteCalculationService()).check(project, { ...input, context: { scenarioId: undefined, stepId: undefined } });
    expect(await execute(input)).toEqual(expected);
    expect(session.getState().project).toEqual(before);
  });
});
