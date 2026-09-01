import { afterEach, expect, it, vi } from "vitest";
import * as effective from "../project-effective";
import { readProposalChanges } from "./proposal-change-review";
import { reviewFixture } from "./review-test-fixture";

afterEach(() => vi.restoreAllMocks());

it("resolves each scoped object/context once per snapshot and never reuses another read's results", () => {
  const before = reviewFixture(); const ref = { kind: "opening" as const, id: "door", scopeId: "construction" };
  before.story.objects = [{ ref, metadata: { owners: ["alice"], tags: ["old"] } }];
  before.story.scenarios = [{ id: "scene", name: "Scene", patches: [], steps: [{ id: "step", name: "Step", patches: [{ id: "patch", target: ref, metadata: { tags: ["step-old"] } }] }] }];
  const after = structuredClone(before);
  after.story.objects[0].metadata = { owners: ["staff"], tags: ["new"] };
  after.story.scenarios[0].steps[0].patches[0].metadata = { tags: ["step-new"] };
  const checkpoint = { id: "proposal", projectId: before.id, kind: "proposal" as const, baseSnapshot: before, snapshot: after };
  const spy = vi.spyOn(effective, "effectiveProjectStoryObject");
  const first = readProposalChanges(checkpoint, before, { checkpointId: checkpoint.id });
  expect(first).toMatchObject({ status: "ready", total: 3 });
  // Two snapshots, each with base and step context; both fields/locales share each result.
  expect(spy).toHaveBeenCalledTimes(4);
  expect(new Set(spy.mock.calls.map(([project, target, context]) => JSON.stringify([project === before ? "before" : "after", target, context]))).size).toBe(4);

  after.story.objects[0].metadata.owners = [];
  const next = readProposalChanges(checkpoint, before, { checkpointId: checkpoint.id });
  expect(spy).toHaveBeenCalledTimes(8);
  expect(next).toMatchObject({ status: "ready", rows: expect.arrayContaining([expect.objectContaining({ fieldKey: "owners", authoredAfter: { present: true, value: [] }, effectiveAfter: { present: true, value: [] } })]) });
});
