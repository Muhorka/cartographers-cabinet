import type { DrawingNoticeModel } from "./drawing-notice";

export type WorkbenchNoticeKind = "road" | "overlap" | "other" | "none";

export function workbenchNoticeKind(input: {
  roadNotice?: DrawingNoticeModel;
  overlapNotice: boolean;
  pendingOverlapDeparture: boolean;
  otherNotice?: DrawingNoticeModel;
}): WorkbenchNoticeKind {
  if (input.roadNotice) return "road";
  if (input.overlapNotice && (input.pendingOverlapDeparture || !input.otherNotice)) return "overlap";
  if (input.otherNotice) return "other";
  return "none";
}
