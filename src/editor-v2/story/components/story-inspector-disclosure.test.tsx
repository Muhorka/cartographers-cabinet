import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryInspector } from "./story-context-panel";
import { storyCopy } from "../i18n/story-copy";
import { emptyStoryData } from "../types";

function inspect(selections: Array<{ kind: "place" | "opening"; id: string }>, readOnly = false) {
  const story = { ...emptyStoryData(), propertyDefinitions: [
    { id: "calm", name: "Spokojne", type: "boolean" as const },
    { id: "door-only", name: "Tylko drzwi", type: "boolean" as const, targetKinds: ["opening" as const] },
  ] };
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<StoryInspector story={story} selections={selections} readOnly={readOnly} copy={storyCopy.pl}/>);
  return host;
}

describe("shared inspector disclosure", () => {
  it("keeps name and description outside collapsed optional properties", () => {
    const host = inspect([{ kind: "place", id: "location" }]);
    const details = [...host.querySelectorAll("details")].find((element) => element.querySelector("summary")?.textContent === "Cechy i powiązania")!;
    expect(details.open).toBe(false);
    const name = [...host.querySelectorAll("label")].find((element) => element.textContent === "Nazwa")!;
    const description = [...host.querySelectorAll("label")].find((element) => element.textContent === "Opis fabularny")!;
    expect(details.contains(name)).toBe(false);
    expect(details.contains(description)).toBe(false);
    expect(details.textContent).toContain("Do kogo należy?");
    expect(details.textContent).toContain("Spokojne");
    expect(details.textContent).toContain("Kto może tu wejść?");
  });

  it("only offers compatible traits and passage settings to a mixed selection", () => {
    const mixed = inspect([{ kind: "place", id: "location" }, { kind: "opening", id: "door" }]);
    expect(mixed.textContent).toContain("Spokojne");
    expect(mixed.textContent).not.toContain("Tylko drzwi");
    expect(mixed.textContent).not.toContain("Stan przejścia");
    const doors = inspect([{ kind: "opening", id: "door-a" }, { kind: "opening", id: "door-b" }]);
    expect(doors.textContent).toContain("Tylko drzwi");
    expect(doors.textContent).toContain("Stan przejścia");
  });

  it("disables the shared form when the selection contains a locked object", () => {
    const host = inspect([{ kind: "place", id: "locked" }], true);
    expect(host.querySelector("fieldset")?.disabled).toBe(true);
    expect(host.querySelector("input")?.matches(":disabled")).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toContain("zablokowany obiekt");
  });
});
