import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryWorldDescription } from "./story-world-description";

describe("StoryWorldDescription", () => {
  it("explains that the text is shared context for the author and agent", () => {
    const html = renderToStaticMarkup(<StoryWorldDescription locale="pl" value="Baśniowy port" onChange={() => undefined}/>);
    expect(html).toContain("Opis świata");
    expect(html).toContain("połączonego agenta");
    expect(html).toContain("Baśniowy port");
  });
});
