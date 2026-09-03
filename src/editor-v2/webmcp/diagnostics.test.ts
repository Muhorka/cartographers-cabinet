import { afterEach, describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { getWebMcpDiagnostics, isSuccessfulWebMcpResult } from "./diagnostics";
import { registerEditorV2Tools } from "./register-editor-tools";

afterEach(() => Reflect.deleteProperty(document, "modelContext"));

async function registeredTools() {
  const project = createStarterProject("project", "Dolina Brzasku", "pl");
  const activePlaceId = project.places.find(({ kind }) => kind === "location")!.id;
  const session = new EditorSession(project, { initialPlaceId: activePlaceId });
  const tools: WebMcpTool[] = [];
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: { registerTool: async (tool: WebMcpTool) => { tools.push(tool); } },
  });
  await registerEditorV2Tools({
    getSession: () => session,
    getProject: () => session.getState().project,
    getActivePlaceId: () => session.getState().activePlaceId ?? activePlaceId,
    refresh: () => undefined,
  });
  return tools;
}

describe("WebMCP diagnostics", () => {
  it("distinguishes registration from a successful agent call", async () => {
    const tools = await registeredTools();
    expect(getWebMcpDiagnostics().lastSuccessfulTool).toBeUndefined();
    await expect(tools.find(({ name }) => name === "inspect_project_object")!.execute({})).rejects.toThrow();
    expect(getWebMcpDiagnostics().lastSuccessfulTool).toBeUndefined();
    await tools.find(({ name }) => name === "inspect_cartographers_project")!.execute({});
    expect(getWebMcpDiagnostics().lastSuccessfulTool).toBe("inspect_cartographers_project");
  });

  it("does not call a logical failure successful", async () => {
    const tools = await registeredTools();
    await tools.find(({ name }) => name === "inspect_cartographers_project")!.execute({});
    const before = getWebMcpDiagnostics().lastSuccessfulTool;
    const result = await tools.find(({ name }) => name === "prepare_update_project_object")!.execute({
      ref: { type: "element", id: "missing" },
      description: "Should not apply",
    }) as { structuredContent: { status: string } };
    expect(["blocked", "not-found"]).toContain(result.structuredContent.status);
    expect(getWebMcpDiagnostics().lastSuccessfulTool).toBe(before);
  });

  it.each(["applied", "accepted", "proposed", "prepared", "created", "no-change", "deferred", "unreachable", "opened", "undone", "redone", "focused", "cleared"])("accepts %s as a completed call", (status) => {
    expect(isSuccessfulWebMcpResult({ structuredContent: { status } })).toBe(true);
  });

  it.each(["failed", "blocked", "stale", "stale-context", "stale-session", "not-found", "unavailable", "expired", "busy", "timeout", "cancelled", "error", "future-failure"])("rejects %s as a completed call", (status) => {
    expect(isSuccessfulWebMcpResult({ structuredContent: { status } })).toBe(false);
  });

  it("reports missing browser support without hiding it", async () => {
    const registration = await registerEditorV2Tools({} as Parameters<typeof registerEditorV2Tools>[0]);
    expect(registration.available).toBe(false);
    expect(getWebMcpDiagnostics()).toMatchObject({ state: "unavailable", registered: 0 });
  });

  it("names failed registrations in diagnostics", async () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: async (tool: WebMcpTool) => { if (tool.name === "inspect_open_map") throw new Error("Permission denied"); } },
    });
    const registration = await registerEditorV2Tools({} as Parameters<typeof registerEditorV2Tools>[0]);
    expect(registration.available).toBe(false);
    expect(getWebMcpDiagnostics()).toMatchObject({ state: "error", registered: 0, errors: ["inspect_open_map: Permission denied"] });
    registration.dispose();
  });
});
