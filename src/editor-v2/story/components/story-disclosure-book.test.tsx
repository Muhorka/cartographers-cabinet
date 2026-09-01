import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { StoryDisclosureBook } from "./story-disclosure-book";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels = { tree: "Atlas", zones: "Zones", worldbook: "World book", lenses: "Lenses" };

function renderBook(overrides: Partial<React.ComponentProps<typeof StoryDisclosureBook>> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<StoryDisclosureBook labels={labels} tree={<p>Tree content</p>} zones={<p>Zone content</p>} worldbook={<p>World book content</p>} lenses={<p>Lens content</p>} {...overrides}/>));
  return { host, root };
}

describe("StoryDisclosureBook", () => {
  it("renders four independently labelled disclosures without replacing their content", async () => {
    const { host, root } = renderBook();
    const details = [...host.querySelectorAll("details")];

    expect(details).toHaveLength(4);
    expect(details.map((detail) => detail.open)).toEqual([true, true, false, false]);
    expect([...host.querySelectorAll("summary")].map((summary) => summary.getAttribute("aria-expanded"))).toEqual(["true", "true", "false", "false"]);
    expect(host.textContent).toContain("Tree content");
    expect(host.textContent).toContain("World book content");
    expect(host.textContent).toContain("Lens content");

    await act(async () => {
      (details[2].querySelector("summary") as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(details[0].open).toBe(true);
    expect(details[2].open).toBe(true);

    act(() => root.unmount());
    host.remove();
  });

  it("keeps stateful route or review content mounted while a section is collapsed", () => {
    function StatefulReview() {
      const [count, setCount] = useState(0);
      return <button type="button" onClick={() => setCount((value) => value + 1)}>Review {count}</button>;
    }

    const { host, root } = renderBook({ defaultOpen: { tree: false, zones: false, worldbook: true, lenses: false }, worldbook: <StatefulReview /> });
    const detail = host.querySelectorAll("details")[2];
    const review = detail.querySelector("button") as HTMLButtonElement;

    act(() => review.click());
    expect(review.textContent).toBe("Review 1");
    act(() => (detail.querySelector("summary") as HTMLElement).click());
    expect(detail.open).toBe(false);
    act(() => (detail.querySelector("summary") as HTMLElement).click());
    expect(detail.open).toBe(true);
    expect((detail.querySelector("button") as HTMLButtonElement).textContent).toBe("Review 1");
    act(() => root.unmount());
    host.remove();
  });

  it("supports a controlled open state and a smaller visible section set", () => {
    const onOpenSectionsChange = vi.fn();
    const { host, root } = renderBook({ visibleSections: ["tree", "zones"], openSections: { tree: false, zones: true }, onOpenSectionsChange });
    const details = [...host.querySelectorAll("details")];

    expect(details).toHaveLength(2);
    expect(details.map((detail) => detail.open)).toEqual([false, true]);
    expect(host.textContent).not.toContain("World book content");
    expect(host.textContent).not.toContain("Lens content");

    act(() => {
      details[1].open = false;
      details[1].dispatchEvent(new Event("toggle"));
    });
    expect(onOpenSectionsChange).toHaveBeenCalledWith({ tree: false, zones: false, worldbook: false, lenses: false });

    act(() => root.unmount());
    host.remove();
  });
});
