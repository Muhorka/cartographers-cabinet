import { describe, expect, it } from "vitest";
import { workbenchCopy } from "../i18n/workbench-copy";
import { editorDrawingNotice } from "./editor-drawing-notice";

const base = {
  copy: workbenchCopy.pl,
  deleteCandidates: false,
  closureReview: false,
  hasDraft: true,
  waitingToLeave: false,
  canAutoClose: true,
  canSavePath: false,
};

describe("drawing notice", () => {
  it("stays out of the way while a drawing is in progress", () => {
    expect(editorDrawingNotice(base)).toBeUndefined();
  });

  it("offers auto-close only after an attempted navigation away from the draft", () => {
    const notice = editorDrawingNotice({ ...base, waitingToLeave: true });
    expect(notice?.actions.map(({ id }) => id)).toEqual(["continue", "auto-close", "sketch", "discard"]);
  });
});
