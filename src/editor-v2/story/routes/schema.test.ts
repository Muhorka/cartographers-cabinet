import { describe, expect, it } from "vitest";
import { routeRequestSchema } from "./schema";

const request = { from: { placeId: "a", point: { x: 0, y: 0 } }, to: { placeId: "b", point: { x: 1, y: 1 } } };

describe("story route request schema", () => {
  it("accepts the bounded alternative count", () => {
    expect(routeRequestSchema.parse({ ...request, alternativeLimit: 3 }).alternativeLimit).toBe(3);
    expect(() => routeRequestSchema.parse({ ...request, alternativeLimit: 4 })).toThrow();
    expect(() => routeRequestSchema.parse({ ...request, alternativeLimit: 1.5 })).toThrow();
  });

  it("rejects non-finite and non-positive alternative counts", () => {
    expect(() => routeRequestSchema.parse({ ...request, alternativeLimit: 0 })).toThrow();
    expect(() => routeRequestSchema.parse({ ...request, alternativeLimit: Number.NaN })).toThrow();
  });
});
