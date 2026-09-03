import { describe, expect, it } from "vitest";
import { createPlace } from "../model/hierarchy-operations";
import { emptyProject } from "../model/project-model";
import { EditorSession } from "../state/editor-session";
import { buildDrawingChange } from "./agent-drawing-command";
import { createEditorAgentTools } from "./register-agent-tools";

function fixture() {
  return createPlace(emptyProject("locale", "Locale"), { id: "world", name: "World", kind: "world" });
}

describe("agent command locale", () => {
  it.each([
    ["en" as const, "Created Meadow 1.", "Meadow 1"],
    ["pl" as const, "Utworzono Łąka 1.", "Łąka 1"],
  ])("uses the requested locale for generated drawing names and summaries (%s)", (locale, summary, name) => {
    const result = buildDrawingChange(fixture(), "world", { layerId: "terrain", subjectId: "terrain.meadow", instrumentId: "rectangle", points: [{ x: 1, y: 1 }, { x: 5, y: 4 }] }, locale);
    expect(result.summary).toBe(summary);
    expect(result.project.elements.at(-1)?.name).toBe(name);
  });

  it("takes the active UI locale from the bridge at command execution time", async () => {
    const project = fixture();
    const session = new EditorSession(project, { initialPlaceId: "world" });
    let locale: "en" | "pl" = "en";
    const tool = createEditorAgentTools({ getSession: () => session, getActivePlaceId: () => "world", getLocale: () => locale, refresh: () => undefined }).find(({ name }) => name === "prepare_create_map_object")!;
    const input = { layerId: "terrain", subjectId: "terrain.meadow", instrumentId: "rectangle", points: [{ x: 1, y: 1 }, { x: 5, y: 4 }] };
    const en = await tool.execute(input) as { structuredContent: { summary: string } };
    locale = "pl";
    const pl = await tool.execute(input) as { structuredContent: { summary: string } };
    expect(en.structuredContent.summary).toMatch(/^Created /);
    expect(pl.structuredContent.summary).toMatch(/^Utworzono /);
  });
});
