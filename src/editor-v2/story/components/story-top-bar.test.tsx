import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { StoryTopBar } from "./story-top-bar";
import { storyCopy } from "../i18n/story-copy";
import type { StoryViewState } from "./story-types";

const view: StoryViewState = { tab: "atlas", activeCollection: "characters", scenarioContext: "base" };
it.each(["pl", "en"] as const)("names inactive overlays explicitly in %s", (locale) => {
  const html = renderToStaticMarkup(<StoryTopBar copy={storyCopy[locale]} view={view} lenses={[]} scenarios={[]} routes={[]} onChange={vi.fn()} onScenario={vi.fn()}/>);
  expect(html).toContain(locale === "pl" ? "Brak aktywnych soczewek" : "No active lenses");
  expect(html).toContain(locale === "pl" ? "Brak aktywnej trasy" : "No active route");
  expect(html).not.toContain(locale === "pl" ? "Wszystko neutralne" : "All neutral");
});

it("toggles lenses independently and clears all temporary overlays without any data-write callback", async () => {
  const onChange = vi.fn(); const onRouteSelected = vi.fn();
  const host = document.createElement("div"); const root = createRoot(host);
  await act(async () => root.render(<StoryTopBar copy={storyCopy.en} view={{ ...view, activeLensIds: ["a"], activeScenarioId: "night", activeRouteId: "route" }} lenses={[{ id: "a", name: "A" }, { id: "b", name: "B" }]} scenarios={[]} routes={[]} onChange={onChange} onScenario={vi.fn()} onRouteSelected={onRouteSelected}/>));
  await act(async () => (host.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement).click());
  expect(onChange).toHaveBeenLastCalledWith({ activeLensIds: ["a", "b"] });
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Restore base view")!.click());
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ activeLensIds: [], previewLens: undefined, activeScenarioId: undefined, activeRouteId: undefined, scenarioContext: "base" }));
  expect(onRouteSelected).toHaveBeenLastCalledWith(undefined);
  await act(async () => root.unmount());
});
