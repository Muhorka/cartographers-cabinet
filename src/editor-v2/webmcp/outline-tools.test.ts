import { afterEach, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { pointInRegion } from "../geometry/region-constraints";
import { EditorSession } from "../state/editor-session";
import { registerEditorV2Tools } from "./register-editor-tools";

afterEach(() => Reflect.deleteProperty(document, "modelContext"));

it("uses the same boundary-crossing cut and addition through registered agent tools, with undo", async () => {
  const project = createStarterProject("p", "Synthetic outline tools", "pl");
  const session = new EditorSession(project, { initialPlaceId: "p:level" });
  const tools: WebMcpTool[] = [];
  Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: async (tool: WebMcpTool) => { tools.push(tool); } } });
  await registerEditorV2Tools({ getSession: () => session, getProject: () => session.getState().project, getActivePlaceId: () => "p:level", refresh: () => undefined });
  const call = async (name: string, input: Record<string, unknown>) => tools.find((tool) => tool.name === name)!.execute(input) as Promise<{ structuredContent: { token: string; status: string } }>;
  const inside = () => pointInRegion({ x: 15, y: 0 }, session.getState().project.places.find(({ id }) => id === "p:level")!.boundary!);
  const input = { target: { kind: "place", id: "p:level" }, shape: { kind: "rectangle", x: 12, y: -3, width: 10, height: 6 } };
  const cut = await call("prepare_cut_map_hole", input);
  expect(inside()).toBe(true); // preparation alone does not mutate the map
  expect((await call("apply_prepared_editor_change", { token: cut.structuredContent.token })).structuredContent.status).toBe("applied");
  expect(inside()).toBe(false);
  await call("undo_editor_change", {}); expect(inside()).toBe(true);
  await call("redo_editor_change", {}); expect(inside()).toBe(false);
  const add = await call("prepare_add_to_outline", input);
  expect((await call("apply_prepared_editor_change", { token: add.structuredContent.token })).structuredContent.status).toBe("applied");
  expect(inside()).toBe(true);
});
