import { describe, expect, it } from "vitest";
import { workbenchNoticeKind } from "./workbench-notice";

const notice = { message: "notice", actions: [] };

describe("workbench notice selection", () => {
  it("keeps the road rejection visible while an overlap continuation is pending", () => {
    expect(workbenchNoticeKind({ roadNotice: notice, overlapNotice: true, pendingOverlapDeparture: true })).toBe("road");
  });

  it("still shows the required overlap decision when no road rejection is active", () => {
    expect(workbenchNoticeKind({ overlapNotice: true, pendingOverlapDeparture: true })).toBe("overlap");
  });
});
