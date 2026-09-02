import { describe, expect, it } from "vitest";
import { mergeStoryRecordUpdate } from "./story-record-update";

describe("atomic story record updates", () => {
  it("preserves an earlier live change when another editor callback uses the same rendered record", () => {
    const rendered = { id: "anna", name: "Anna", description: "Before", tags: ["keeper"], properties: { rank: 1, room: "east" } };
    const descriptionEdit = { ...rendered, description: "Archivist" };
    const rankEdit = { ...rendered, properties: { ...rendered.properties, rank: 2 } };
    const afterDescription = mergeStoryRecordUpdate(rendered, rendered, descriptionEdit);
    const afterRank = mergeStoryRecordUpdate(afterDescription, rendered, rankEdit);
    expect(afterRank).toEqual({ ...rendered, description: "Archivist", properties: { rank: 2, room: "east" } });
  });
});
