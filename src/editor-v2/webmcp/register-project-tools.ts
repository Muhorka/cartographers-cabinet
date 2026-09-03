import type { EditorProject } from "../model/project-model";
import type { StartingScale } from "../model/starter-project";
import { text } from "./agent-tool-input";
import { projectRevision } from "../state/project-revision";
import { safePersistenceError } from "../persistence/persistence-errors";

export type ProjectLibraryBridge = {
  getSession?(): object;
  getProject?(): EditorProject;
  getProjects?(): EditorProject[];
  createProject?(name: string, scale: StartingScale): Promise<EditorProject | undefined>;
  openProject?(id: string): Promise<boolean>;
  duplicateProject?(id: string): Promise<EditorProject | undefined>;
  renameProject?(id: string, name: string): Promise<EditorProject | undefined>;
  deleteProject?(id: string): Promise<boolean>;
};

const response = <T,>(value: T) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });
const failed = (error: unknown) => response({ status: "failed", ...safePersistenceError(error) });
const PROJECT_DELETE_TOKEN_TTL_MS = 5 * 60 * 1000;

export function createProjectLibraryTools(bridge: ProjectLibraryBridge): WebMcpTool[] {
  const pendingDeletes = new Map<string, { projectId: string; name: string; revision: string; session?: object; createdAt: number }>();
  const project = (id: string) => bridge.getProjects?.().find((candidate) => candidate.id === id);
  return [
    { name: "list_cartographer_projects", title: "List cartographer projects", description: "List saved local atlases or standalone maps without changing the open project.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async () => response({ projects: (bridge.getProjects?.() ?? []).map(({ id, name, updatedAt, places, elements, constructions }) => ({ id, name, updatedAt, counts: { places: places.length, elements: elements.length, constructions: constructions.length } })) }) },
    { name: "create_cartographer_project", title: "Create a cartographer project", description: "Create and open a clean project at world, location, building, level, or standalone-room scale.", inputSchema: { type: "object", properties: { name: { type: "string" }, scale: { type: "string", enum: ["world", "location", "building", "level", "room"] } }, required: ["name", "scale"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input) => { try { const created = await bridge.createProject?.(text(input, "name"), text(input, "scale") as StartingScale); return response(created ? { status: "created", project: { id: created.id, name: created.name } } : { status: "unavailable" }); } catch (error) { return failed(error); } } },
    { name: "open_cartographer_project", title: "Open a cartographer project", description: "Open an existing saved project in the editor.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input) => { try { const id = text(input, "projectId"); return response({ status: await bridge.openProject?.(id) ? "opened" : "not-found", projectId: id }); } catch (error) { return failed(error); } } },
    { name: "duplicate_cartographer_project", title: "Duplicate a cartographer project", description: "Create a separate copy of a saved project with a new project identity.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input) => { try { const duplicate = await bridge.duplicateProject?.(text(input, "projectId")); return response(duplicate ? { status: "duplicated", project: { id: duplicate.id, name: duplicate.name } } : { status: "not-found" }); } catch (error) { return failed(error); } } },
    { name: "rename_cartographer_project", title: "Rename a cartographer project", description: "Rename one saved project without changing its maps.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, name: { type: "string" } }, required: ["projectId", "name"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input) => { try { const renamed = await bridge.renameProject?.(text(input, "projectId"), text(input, "name")); return response(renamed ? { status: "renamed", project: { id: renamed.id, name: renamed.name } } : { status: "not-found" }); } catch (error) { return failed(error); } } },
    { name: "prepare_delete_cartographer_project", title: "Prepare deleting a cartographer project", description: "Prepare deleting one entire saved project and report its map counts. A separate application token is required.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input) => { const selected = project(text(input, "projectId")); if (!selected) return response({ status: "not-found" }); const token = crypto.randomUUID(); pendingDeletes.set(token, { projectId: selected.id, name: selected.name, revision: projectRevision(selected), session: bridge.getSession?.(), createdAt: Date.now() }); return response({ status: "prepared", token, project: { id: selected.id, name: selected.name, counts: { places: selected.places.length, elements: selected.elements.length, constructions: selected.constructions.length } } }); } },
    { name: "apply_project_deletion", title: "Apply a prepared project deletion", description: "Permanently delete exactly the project named by a prepared deletion token.", inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input) => { const token = text(input, "token"); const pending = pendingDeletes.get(token); if (!pending) return response({ status: "not-found" }); pendingDeletes.delete(token); if (Date.now() - pending.createdAt >= PROJECT_DELETE_TOKEN_TTL_MS) return response({ status: "expired" }); if (pending.session && bridge.getSession?.() !== pending.session) return response({ status: "stale" }); const selected = project(pending.projectId); if (!selected || selected.id !== pending.projectId || selected.name !== pending.name || projectRevision(selected) !== pending.revision) return response({ status: "stale" }); try { const deleted = await bridge.deleteProject?.(pending.projectId); return response({ status: deleted ? "deleted" : "blocked", projectId: pending.projectId }); } catch (error) { return failed(error); } } },
  ];
}
