import { describe, expect, it } from "vitest";
import { prefixMarkdownLines, wrapMarkdown } from "./story-notebook-markdown";

describe("story notebook markdown editing", () => {
  it("wraps the current selection and preserves its selection", () => {
    expect(wrapMarkdown("A word here", 2, 6, "**")).toEqual({ value: "A **word** here", selectionStart: 4, selectionEnd: 8 });
  });

  it("prefixes every selected line", () => {
    expect(prefixMarkdownLines("one\ntwo\nthree", 4, 7, "- ")).toEqual({ value: "one\n- two\nthree", selectionStart: 6, selectionEnd: 9 });
  });
});
