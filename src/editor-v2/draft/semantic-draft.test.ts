import { describe, expect, it } from "vitest";
import { analyzeDraft, appendDraftStroke, createSemanticDraft, draftNavigationDecision, looseDraftStrokes } from "./semantic-draft";

describe("semantic multi-stroke draft", () => {
  it("forms one semantic region from four separate pencil strokes", () => {
    let draft = createSemanticDraft("draft", "buildings", "building.building", "world");
    draft = appendDraftStroke(draft, { id: "top", points: [{ x: 0, y: 0 }, { x: 8, y: 0 }] });
    draft = appendDraftStroke(draft, { id: "right", points: [{ x: 8, y: 0 }, { x: 8, y: 6 }] });
    draft = appendDraftStroke(draft, { id: "bottom", points: [{ x: 8, y: 6 }, { x: 0, y: 6 }] });
    draft = appendDraftStroke(draft, { id: "left", points: [{ x: 0, y: 6 }, { x: 0, y: 0 }] });
    const analysis = analyzeDraft(draft);
    expect(analysis.faces).toHaveLength(1); expect(analysis.faces[0].area).toBe(48); expect(analysis.hasLooseLines).toBe(false);
  });

  it("keeps an unfinished semantic stroke and requires a decision before navigation", () => {
    const draft = appendDraftStroke(createSemanticDraft("draft", "terrain", "terrain.meadow", "world"), { id: "unfinished", points: [{ x: 0, y: 0 }, { x: 2, y: 1 }] });
    const decision = draftNavigationDecision(draft);
    expect(decision.state).toBe("decision-required");
    if (decision.state === "decision-required") { expect(decision.canCreate).toBe(false); expect(decision.canKeepAsSketch).toBe(true); }
  });

  it("allows closed faces and loose strokes to be reviewed separately", () => {
    const draft = [
      { id: "box", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }] },
      { id: "note", points: [{ x: 8, y: 8 }, { x: 9, y: 9 }] },
    ].reduce((state, stroke) => appendDraftStroke(state, stroke), createSemanticDraft("draft", "terrain", "terrain.field", "world"));
    const analysis = analyzeDraft(draft);
    expect(analysis.faces).toHaveLength(1); expect(analysis.looseStrokeIds).toEqual(["note"]);
  });

  it("keeps only a real tail instead of retaining and recreating its completed face", () => {
    const draft = appendDraftStroke(createSemanticDraft("draft", "boundaries", "boundary.place", "world"), {
      id: "outlined-with-tail", points: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }, { x: -2, y: 0 }],
    });
    expect(analyzeDraft(draft).faces).toHaveLength(1);
    expect(looseDraftStrokes(draft)).toEqual([{ id: "outlined-with-tail:loose:1", points: [{ x: 0, y: 0 }, { x: -2, y: 0 }] }]);
    expect(looseDraftStrokes(draft, 2.1)).toEqual([]);
  });
});
