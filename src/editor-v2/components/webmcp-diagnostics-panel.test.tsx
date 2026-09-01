import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { reportWebMcpDiagnostics } from "../webmcp/diagnostics";
import { WebMcpDiagnosticsPanel } from "./webmcp-diagnostics-panel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("WebMcpDiagnosticsPanel", () => {
  it("shows the active tool count without the empty-session explanation", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    act(() => {
      reportWebMcpDiagnostics({ state: "ready", registered: 68, total: 68, errors: [] });
      root.render(<WebMcpDiagnosticsPanel locale="en"/>);
    });

    expect(host.textContent).toContain("Active tools: 68/68");
    expect(host.textContent).not.toContain("The page is ready");
    expect(host.textContent).not.toContain("No successful agent call");

    act(() => root.unmount());
    host.remove();
  });
});
