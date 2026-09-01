import { describe, expect, it } from "vitest";
import { appendDraftStroke, createSemanticDraft } from "./semantic-draft";
import { normalizeDraftTopology } from "./normalize-draft-topology";

describe("draft topology correction", () => {
  it("joins human-imprecise endpoints across separate instruments", () => {
    let draft = createSemanticDraft("draft", "boundaries", "boundary.place", "world");
    draft = appendDraftStroke(draft, { id: "pencil", points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }] });
    draft = appendDraftStroke(draft, { id: "line", points: [{ x: .35, y: 6.2 }, { x: .2, y: -.25 }] });
    const corrected = normalizeDraftTopology(draft, .6);
    expect(corrected.strokes[0].points[0]).toEqual(corrected.strokes[1].points.at(-1));
    expect(corrected.strokes[0].points.at(-1)).toEqual(corrected.strokes[1].points[0]);
  });
});
