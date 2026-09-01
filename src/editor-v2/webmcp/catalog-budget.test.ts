import { afterEach, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { EditorSession } from "../state/editor-session";
import { registerEditorV2Tools } from "./register-editor-tools";

// Current client defaults. Test the emitted UTF-8 descriptors, including both URL fields.
// Never make this pass by silently dropping tools or weakening schemas/guards.
// Keep the local editor and the actual production deployment within the host budget.
const maximumTools = 100;
const maximumDescriptorBytes = 65_536;
const minimumDescriptorHeadroom = 1_024;
afterEach(() => Reflect.deleteProperty(document, "modelContext"));

it("keeps the complete tool catalogue within the client's count and descriptor budgets", async () => {
  const tools: WebMcpTool[] = [];
  Object.defineProperty(document, "modelContext", { configurable: true, value: {
    registerTool: async (tool: WebMcpTool) => { tools.push(tool); },
  } });
  const project = createStarterProject("catalog-budget", "Synthetic catalogue budget", "en");
  const session = new EditorSession(project);
  const registration = await registerEditorV2Tools({ getSession: () => session, getProject: () => session.getState().project, getActivePlaceId: () => project.places[0].id, refresh: () => undefined });
  try {
    expect(registration.available).toBe(true);
    expect(new Set(tools.map(({ name }) => name)).size).toBe(tools.length);
    expect(tools.length).toBeLessThanOrEqual(maximumTools);
    const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
    for (const origin of ["http://127.0.0.1:3100", "https://cabinet.varera.studio"]) {
      const descriptors = tools.map(({ name, title, description, inputSchema, annotations }) => ({
        name, ...(title == null ? {} : { title }), description, inputSchema,
        ...(annotations == null ? {} : { annotations }), origin, pageUrl: `${origin}/editor-v2`,
      }));
      const total = bytes(descriptors);
      const largest = descriptors.map((tool) => ({ name: tool.name, bytes: bytes(tool) })).sort((a, b) => b.bytes - a.bytes).slice(0, 5);
      expect(total, `${origin}: ${tools.length} tools, ${total} UTF-8 bytes; ${maximumDescriptorBytes - total} bytes remaining. Largest descriptors: ${JSON.stringify(largest)}`).toBeLessThanOrEqual(maximumDescriptorBytes - minimumDescriptorHeadroom);
    }
  } finally { registration.dispose(); }
});
