import { describe, expect, it } from "vitest";
import { proposeDraftClosure } from "./auto-close-draft";
import { analyzeDraft, appendDraftStroke, createSemanticDraft } from "./semantic-draft";

describe("automatic semantic draft closure", () => {
  it("proposes the one missing edge for an unambiguous open outline", () => {
    let draft = createSemanticDraft("draft", "buildings", "building.building", "map");
    draft = appendDraftStroke(draft, { id: "a", points: [{ x: 0, y: 0 }, { x: 6, y: 0 }] });
    draft = appendDraftStroke(draft, { id: "b", points: [{ x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }] });
    const proposal = proposeDraftClosure(draft, "closure");
    expect(proposal?.after.strokes.at(-1)).toEqual({ id: "closure:1", points: [{ x: 0, y: 0 }, { x: 0, y: 4 }] });
    expect(analyzeDraft(proposal!.after).faces).toHaveLength(1);
  });

  it("can preview closing more than one pair of unfinished ends", () => {
    let draft = createSemanticDraft("draft", "terrain", "terrain.field", "map");
    draft = appendDraftStroke(draft, { id: "a", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }] });
    draft = appendDraftStroke(draft, { id: "b", points: [{ x: 10, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 4 }] });
    const proposal = proposeDraftClosure(draft, "closure");
    expect(proposal?.connectorIds).toHaveLength(2);
    expect(analyzeDraft(proposal!.after).faces.length).toBeGreaterThan(0);
  });

  it("closes a divider against the existing outline instead of hiding the action", () => {
    let draft = createSemanticDraft("draft", "construction", "platform.terrace", "level");
    draft = appendDraftStroke(draft, { id: "divider", points: [{ x: 5, y: 0 }, { x: 5, y: 4 }] });
    const proposal = proposeDraftClosure(draft, "closure", { kind: "rectangle", x: 0, y: 0, width: 10, height: 4 });

    expect(proposal?.connectorIds).toEqual(["closure:boundary"]);
    expect(analyzeDraft(proposal!.after).faces).toHaveLength(1);
  });

  it("clips an overshooting divider before closing it against the outline", () => {
    let draft = createSemanticDraft("draft", "construction", "construction.partition", "level");
    draft = appendDraftStroke(draft, { id: "divider", points: [{ x: 5, y: -3 }, { x: 5, y: 7 }] });
    const proposal = proposeDraftClosure(draft, "closure", { kind: "rectangle", x: 0, y: 0, width: 10, height: 4 });

    expect(proposal?.connectorIds).toEqual(["closure:boundary"]);
    expect(analyzeDraft(proposal!.after).faces).toHaveLength(1);
  });
});
