import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { GlobalLegalFooter } from "./global-legal-footer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("GlobalLegalFooter", () => {
  it("keeps the legal links concise and localizes both languages", () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    let requested: string | undefined;
    act(() => root.render(<GlobalLegalFooter locale="pl" onOpenMarginalia={(section) => { requested = section; }}/>));
    expect(host.querySelector("footer")?.getAttribute("aria-label")).toBe("Stopka prawna");
    expect([...host.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["Prywatność", "Warunki", "Licencje", "Kontakt"]);
    act(() => host.querySelector<HTMLAnchorElement>('a[href="#marginalia-privacy"]')?.click());
    expect(requested).toBe("privacy");
    act(() => host.querySelector<HTMLAnchorElement>('a[href="#marginalia-terms"]')?.click());
    expect(requested).toBe("terms");
    act(() => host.querySelector<HTMLAnchorElement>('a[href="#marginalia-legal"]')?.click());
    expect(requested).toBe("legal");
    expect(host.querySelector<HTMLAnchorElement>('a[href="/THIRD_PARTY_NOTICES.md"]')).toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('a[href="mailto:varera.contact@gmail.com"]')).not.toBeNull();
    act(() => root.render(<GlobalLegalFooter locale="en" onOpenMarginalia={() => undefined}/>));
    expect([...host.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["Privacy", "Terms", "Licences", "Contact"]);
    act(() => root.unmount()); host.remove();
  });
});
