import { describe, expect, it, vi } from "vitest";
import { createInlineStoryRouteCalculationService } from "../routes/route-service";
import type { StoryRouteCalculationService } from "../routes/route-service";
import { findStoryRoutes } from "../routes/planner";
import { constructionNetwork } from "../../construction/construction-network";
import { roomFaceShape } from "../../geometry/room-face-shape";
import { pointInRegion } from "../../geometry/region-constraints";
import { checkStoryIntention } from "./intention-check-service";
import { closedDoorAccess, reviewFixture, reviewQuery } from "./review-test-fixture";

describe("shared intention check", () => {
  it("does not report a geometric proof when a level or outdoor bounds are missing", async () => {
    const project = reviewFixture(); project.constructions = [];
    const routes = { calculate: vi.fn<StoryRouteCalculationService["calculate"]>(), cancel: vi.fn(), dispose: vi.fn() };
    expect(await checkStoryIntention(project, { intentionId: "reach", query: reviewQuery }, routes)).toMatchObject({ status: "needs-author-review", reasonCode: "geometry-required" });
    project.places[0] = { ...project.places[0]!, kind: "location", constructionId: undefined };
    expect(await checkStoryIntention(project, { intentionId: "reach", query: reviewQuery }, routes)).toMatchObject({ status: "needs-author-review", reasonCode: "geometry-required" });
    expect(routes.calculate).not.toHaveBeenCalled();
  });

  it("checks canonical room intentions using explicit points in the owning level", async () => {
    const project = reviewFixture(); const document = project.constructions[0]!;
    const faces = constructionNetwork(document.walls, document.enclosure).faces;
    const roomAt = (point: { x: number; y: number }) => document.rooms.find((room) => {
      const face = faces.find(({ id }) => id === room.faceId); return face && pointInRegion(point, roomFaceShape(face));
    })!;
    const subject = { kind: "room" as const, id: roomAt(reviewQuery.from.point).id, scopeId: "level" };
    const target = { kind: "room" as const, id: roomAt(reviewQuery.to.point).id, scopeId: "construction" };
    project.story.intentions = [{ id: "rooms", kind: "reachability", subject, target, status: "accepted", text: "Reach the next room" }];
    project.story.evidence = [{ id: "room-note", text: "The rooms are connected through the door.", refs: [subject], source: "local" }];
    const checked = await checkStoryIntention(project, { intentionId: "rooms", query: reviewQuery }, createInlineStoryRouteCalculationService());
    expect(checked.status).toBe("satisfied");
    expect(checked.refs).toContainEqual({ ...subject, scopeId: "construction" });
    expect(checked.localEvidence[0]?.id).toBe("room-note");
  });

  it("separates permission from key possession and physical passage", async () => {
    const project = reviewFixture();
    project.story.objects = [{ ref: { kind: "opening", id: "door", scopeId: "construction" }, metadata: { access: { ...closedDoorAccess, permission: "restricted", allow: ["staff"] } } }];
    project.story.memberships = [{ subjectId: "alice", groupId: "brass", kind: "holds-key", source: "manual" }];
    const routes = createInlineStoryRouteCalculationService();
    const denied = await checkStoryIntention(project, { intentionId: "access", actorId: "alice" }, routes);
    expect(denied).toMatchObject({ status: "blocked", proofScope: "permission", reasonCode: "access-denied", access: { physicalOpen: false } });
    project.story.memberships.push({ subjectId: "alice", groupId: "staff", kind: "member-of", source: "manual" });
    expect(await checkStoryIntention(project, { intentionId: "access", actorId: "alice" }, routes)).toMatchObject({ status: "satisfied", proofScope: "permission", access: { physicalOpen: false } });
    const passage = await checkStoryIntention(project, { intentionId: "reach", actorId: "alice", query: reviewQuery }, routes);
    expect(passage.status).toBe("conditional");
    expect(passage.conditions.join(" ")).toContain("Unlock and open door");
  });

  it("recalculates a saved route under the requested actor and scenario", async () => {
    const project = reviewFixture(); const oldResult = findStoryRoutes(project, reviewQuery);
    project.story.routes = [{ id: "saved", name: "Cross the hall", query: { ...reviewQuery, actorId: "staff" }, result: oldResult, sourceRevision: "old" }];
    project.story.scenarios = [{ id: "night", name: "Night", patches: [], steps: [] }];
    const calculate = vi.fn<StoryRouteCalculationService["calculate"]>(async () => ({ status: "ready", attemptId: 1, result: { status: "unreachable", revision: 0, sourceRevision: "current", routes: [], reasons: [], missingFacts: [] } }));
    const checked = await checkStoryIntention(project, { intentionId: "reach", routeId: "saved", actorId: "alice", context: { scenarioId: "night" } }, { calculate, cancel: vi.fn(), dispose: vi.fn() });
    expect(checked).toMatchObject({ status: "blocked", reasonCode: "route-unreachable", routeId: "saved" });
    expect(calculate.mock.calls[0]![1]).toMatchObject({ actorId: "alice", scenarioId: "night", from: reviewQuery.from, to: reviewQuery.to });
  });

  it("keeps missing queries and timeouts separate from failed intentions", async () => {
    const project = reviewFixture(); const before = structuredClone(project);
    const calculate = vi.fn<StoryRouteCalculationService["calculate"]>(async () => ({ status: "timeout", attemptId: 1 }));
    const routes = { calculate, cancel: vi.fn(), dispose: vi.fn() };
    expect(await checkStoryIntention(project, { intentionId: "reach" }, routes)).toMatchObject({ status: "needs-author-review", execution: "completed", reasonCode: "query-required" });
    expect(calculate).not.toHaveBeenCalled();
    expect(await checkStoryIntention(project, { intentionId: "reach", query: reviewQuery }, routes)).toMatchObject({ status: "timeout", execution: "timeout", reasonCode: "timed-out" });
    expect(project).toEqual(before);
  });

  it("includes existing local evidence and effective scenario property sources", async () => {
    const project = reviewFixture(); const ref = { kind: "place" as const, id: "level" };
    project.story.propertyDefinitions = [{ id: "light", name: "Lighting", type: "text" }];
    project.story.objects = [{ ref, metadata: { properties: { light: "daylight" } } }];
    project.story.scenarios = [{ id: "night", name: "Night", patches: [{ id: "patch", target: ref, properties: { light: "candles" } }], steps: [] }];
    project.story.evidence = [{ id: "note", text: "The hall uses candles at night.", refs: [ref], source: "local", locator: "author note" }];
    const checked = await checkStoryIntention(project, { intentionId: "reach", context: { scenarioId: "night" } }, createInlineStoryRouteCalculationService());
    expect(checked.localEvidence[0]?.id).toBe("note");
    expect(checked.facts[0]?.effectiveProperties).toContainEqual(expect.objectContaining({ propertyId: "light", value: "candles" }));
    expect(checked.facts[0]?.metadata.properties?.light).toBe("candles");
    expect(project.story.objects[0]?.metadata.properties?.light).toBe("daylight");
  });
});
