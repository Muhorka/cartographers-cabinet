import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workshopGuide } from "./workshop-guide-content";
import { WorkshopGuide } from "./workshop-guide";
import { WorkshopGuideTrigger } from "./workshop-guide-trigger";
import { toolboxCopy } from "../i18n/toolbox-copy";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("workshop guide", () => {
  it.each(["pl", "en"] as const)("contains the same complete topic set in %s", (locale) => {
    expect(workshopGuide[locale].topics.map(({ id }) => id)).toEqual(["start", "atlas", "drawing", "story", "agent"]);
    for (const topic of workshopGuide[locale].topics) {
      expect(topic.title.length).toBeGreaterThan(2);
      expect(topic.summary.length).toBeGreaterThan(10);
      expect(topic.sections.length).toBeGreaterThan(0);
    }
  });
  it("keeps the Polish and English drawing chapters structurally aligned", () => {
    const polish = workshopGuide.pl.topics.find(({ id }) => id === "drawing")!;
    const english = workshopGuide.en.topics.find(({ id }) => id === "drawing")!;
    expect(english.sections).toHaveLength(polish.sections.length);
    expect(english.sections.map(({ subsections }) => subsections?.length ?? 0)).toEqual(polish.sections.map(({ subsections }) => subsections?.length ?? 0));
  });
  it("keeps the Polish and English story chapters structurally aligned", () => {
    const polish = workshopGuide.pl.topics.find(({ id }) => id === "story")!;
    const english = workshopGuide.en.topics.find(({ id }) => id === "story")!;
    expect(english.sections).toHaveLength(polish.sections.length);
    expect(english.sections.map(({ bullets }) => bullets?.length ?? 0)).toEqual(polish.sections.map(({ bullets }) => bullets?.length ?? 0));
    expect(english.sections.map(({ subsections }) => subsections?.length ?? 0)).toEqual(polish.sections.map(({ subsections }) => subsections?.length ?? 0));
  });
  it("keeps the Polish and English agent chapters structurally aligned", () => {
    const polish = workshopGuide.pl.topics.find(({ id }) => id === "agent")!;
    const english = workshopGuide.en.topics.find(({ id }) => id === "agent")!;
    expect(english.sections).toHaveLength(polish.sections.length);
    expect(english.sections.map(({ bullets }) => bullets?.length ?? 0)).toEqual(polish.sections.map(({ bullets }) => bullets?.length ?? 0));
    expect(english.sections.map(({ steps }) => steps?.length ?? 0)).toEqual(polish.sections.map(({ steps }) => steps?.length ?? 0));
    expect(english.sections.map(({ subsections }) => subsections?.length ?? 0)).toEqual(polish.sections.map(({ subsections }) => subsections?.length ?? 0));
  });
  it("documents the agreed drawing behaviour without exposing private or drafting text", () => {
    const polish = JSON.stringify(workshopGuide.pl.topics.find(({ id }) => id === "drawing"));
    const english = JSON.stringify(workshopGuide.en.topics.find(({ id }) => id === "drawing"));
    expect(polish).toContain("lokalnie zwiększać lub zmniejszać");
    expect(polish).toContain("automatycznie przycina ją do tej granicy");
    expect(polish).toContain("Dla ściany Inspektor pokazuje jej rodzaj i grubość");
    expect(polish).toContain("Granicę obszaru");
    expect(english).toContain("Area boundary");
    expect(toolboxCopy.pl.subjects["boundary.zone"]).toBe("Granica obszaru");
    expect(toolboxCopy.en.subjects["boundary.zone"]).toBe("Area boundary");
    expect(`${polish}${english}`).not.toMatch(/Rueve|Severyn|Jasne — poprawiam tylko/);
  });
  it("explains the agent's creative role and its actual safety boundaries", () => {
    const polish = JSON.stringify(workshopGuide.pl.topics.find(({ id }) => id === "agent"));
    const english = JSON.stringify(workshopGuide.en.topics.find(({ id }) => id === "agent"));
    expect(polish).toContain("Drugi kartograf przy stole");
    expect(polish).toContain("Tworzysz świat, o którym możesz później rozmawiać z agentem");
    expect(polish).toContain("kontekstem rozmowy, a nie granicą dostępu");
    expect(polish).toContain("Ta historia nie jest trwałym archiwum");
    expect(polish).toContain("nie wymagają obowiązkowego potwierdzenia człowieka");
    expect(polish).toContain("Sam Gabinet nie wysyła ich do Varéry ani do Cloudflare");
    expect(polish).not.toContain("68");
    expect(`${polish}${english}`).not.toMatch(/Rueve|Severyn|Teodor|Codex trafił|hackathonowy sens/);
  });
  it("keeps the agreed beginner orientation and accurate hierarchy terms", () => {
    const start = JSON.stringify(workshopGuide.pl.topics.find(({ id }) => id === "start"));
    const atlas = JSON.stringify(workshopGuide.pl.topics.find(({ id }) => id === "atlas"));
    const story = JSON.stringify(workshopGuide.pl.topics.find(({ id }) => id === "story"));
    expect(start).toContain("biurko kartografa, który zdecydowanie posiada zbyt wiele szuflad");
    expect(start).toContain("Tryb Opowieść przydaje się");
    expect(start).toContain("osadzasz drzwi i okna w ścianach");
    expect(start).toContain("Co znajduje się na ekranie");
    expect(atlas).toContain("Poziom mapy to miejsce, które ma własny arkusz");
    expect(atlas).toContain("Kondygnacja jest jednym z rodzajów poziomu mapy");
    expect(atlas).toContain("Sama kolejność kondygnacji nie tworzy jednak przejścia");
    expect(atlas).toContain("wielopiętrowej genealogii każdej szopy");
    expect(story).toContain("Scenariusz opisuje alternatywny stan świata");
    expect(story).toContain("zapisane pytanie");
    expect(story).toContain("intencje z całego projektu");
    expect(story).toContain("Warunkowo");
    expect(story).not.toMatch(/Rueve|Severyn|Teodor|wywalam prywatny Dwór/);
  });
  it("renders a labelled modal and visible chapter navigation", () => {
    const html = renderToStaticMarkup(<WorkshopGuide locale="pl" onClose={vi.fn()}/>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Księga warsztatu");
    expect(html).toContain("Zacznij tutaj");
    expect(html).toContain("Praca z własnym agentem");
    expect(html).toContain("<strong>Kreślenia</strong>");
    expect(html).toContain("<em>jak świat wygląda i jak jest zbudowany</em>");
    expect(html).not.toContain("Instrukcja dla osoby");
  });
  it("renders drawing subheadings, bullets and formatted steps after opening the chapter", async () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<WorkshopGuide locale="pl" onClose={vi.fn()}/>));
    const drawingButton = [...host.querySelectorAll("nav button")].find((button) => button.textContent?.includes("Kreślenie mapy")) as HTMLButtonElement;
    await act(async () => drawingButton.click());
    expect([...host.querySelectorAll("h4")].map(({ textContent }) => textContent)).toContain("Drogi");
    expect(host.querySelector("article")?.textContent).toContain("lokalnie zwiększać lub zmniejszać");
    expect(host.querySelectorAll("article ul li").length).toBeGreaterThan(10);
    expect(host.querySelector("article ol strong")?.textContent).toBe("Kreślenie");
    await act(async () => root.unmount()); host.remove();
  });
  it("renders the agent chapter and its current external instructions", async () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<WorkshopGuide locale="pl" onClose={vi.fn()}/>));
    const agentButton = [...host.querySelectorAll("nav button")].find((button) => button.textContent?.includes("Praca z własnym agentem")) as HTMLButtonElement;
    await act(async () => agentButton.click());
    expect(host.querySelector("article")?.textContent).toContain("Drugi kartograf przy stole");
    const links = [...host.querySelectorAll("article a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(expect.arrayContaining([
      "https://webmcp.devpost.com/resources",
      "https://developer.chrome.com/docs/ai/agents",
    ]));
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    }
    await act(async () => root.unmount()); host.remove();
  });
  it("searches the whole guide and opens the matching section", async () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<WorkshopGuide locale="pl" onClose={vi.fn()}/>));
    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input.placeholder).toBe("Czego szukasz?");
    const setInput = (value: string) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); };
    await act(async () => setInput("AI"));
    const result = [...host.querySelectorAll("nav button")].find((button) => button.textContent?.includes("Drugi kartograf przy stole")) as HTMLButtonElement;
    expect(result).not.toBeUndefined();
    await act(async () => { result.click(); await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(host.querySelector("article")?.textContent).toContain("Drugi kartograf przy stole");
    expect(document.activeElement?.textContent).toBe("Drugi kartograf przy stole");
    await act(async () => setInput("zzzzzzzz"));
    expect(host.querySelector("nav")?.textContent).toContain("Nie znalazłem pasującego miejsca w Księdze.");
    await act(async () => root.unmount()); host.remove();
  });
  it("closes with Escape and restores focus to the guide trigger", async () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<WorkshopGuideTrigger locale="pl" languageClass="language" onLanguage={vi.fn()}/>));
    const trigger = host.querySelector("button")!;
    await act(async () => trigger.click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await act(async () => Promise.resolve());
    expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
    await act(async () => root.unmount()); host.remove();
  });
});
