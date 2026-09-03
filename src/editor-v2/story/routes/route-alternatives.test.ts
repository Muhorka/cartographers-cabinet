import { describe, expect, it } from "vitest";
import { collectRouteAlternatives } from "./route-alternatives";

const resource = (kind: "opening" | "transition", scopeId: string, id: string) => JSON.stringify([kind, scopeId, id]);
const alternative = (id: string, scopeId: string) => ({
  id, segments: [], points: [{ x: 0, y: 0 }], distance: 1, conditions: [], reasons: [], usedOpeningIds: ["shared"], usedTransitionIds: [],
  resourceKeys: [resource("opening", scopeId, "shared")],
});

describe("scoped route alternatives", () => {
  it("blocks only the exact construction resource, not a reused local ID", () => {
    const routes = collectRouteAlternatives((blocked) => {
      if (!blocked.has(resource("opening", "plan-a", "shared"))) return alternative("plan-a-route", "plan-a");
      if (!blocked.has(resource("opening", "plan-b", "shared"))) return alternative("plan-b-route", "plan-b");
      return undefined;
    }, 2);

    expect(routes.map(({ id }) => id)).toEqual(["plan-a-route", "plan-b-route"]);
  });
});
