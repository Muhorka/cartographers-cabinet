import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { LegalMarginalia, type LegalMarginaliaHandle } from "./legal-marginalia";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LegalMarginalia", () => {
  it("stays collapsed by default and exposes all legal pages and real links", () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    act(() => root.render(<LegalMarginalia locale="pl"/>));
    const disclosure = host.querySelector("details")!;
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector("summary")?.textContent).toContain("Marginalia");
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map(({ textContent }) => textContent)).toEqual(["Privacy", "Terms", "Legal"]);
    act(() => tabs[1]!.click()); expect(host.textContent).toContain("Zasady korzystania");
    act(() => tabs[2]!.click()); expect(host.textContent).toContain("Wydawca, WebMCP i licencje");
    expect(host.querySelector<HTMLAnchorElement>('a[href="mailto:varera.contact@gmail.com"]')).not.toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('a[href="https://www.cloudflare.com/privacypolicy/"]')).not.toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('a[href="https://policies.google.com/privacy"]')).not.toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('a[href="/THIRD_PARTY_NOTICES.md"]')).not.toBeNull();
    act(() => root.render(<LegalMarginalia locale="en"/>));
    expect(host.textContent).toContain("Publisher, WebMCP and licences");
    act(() => root.unmount()); host.remove();
  });

  it("opens the requested page when reached from the global footer", () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const ref = createRef<LegalMarginaliaHandle>();
    act(() => root.render(<LegalMarginalia ref={ref} locale="pl"/>));
    act(() => ref.current?.openSection("terms"));
    expect(host.querySelector("details")?.open).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.textContent).toBe("Terms");
    expect(host.querySelector("#marginalia-terms")).not.toBeNull();
    expect(host.querySelector("#legal-marginalia")).not.toBeNull();
    act(() => root.unmount()); host.remove();
  });
});
