import { describe, expect, it } from "vitest";
import { createProjectAtScale } from "../model/starter-project";
import { createProjectLibraryTools } from "./register-project-tools";

describe("project library tool safety", () => {
  it("returns a safe failure receipt when project creation rejects", async () => {
    const tool = createProjectLibraryTools({ createProject: async () => { throw new Error("/private/path/project.sqlite: quota"); } }).find(({ name }) => name === "create_cartographer_project")!;
    const result = await tool.execute({ name: "New", scale: "world" }) as { structuredContent: { status: string; code: string; reason: string } };
    expect(result.structuredContent).toEqual({ status: "failed", code: "storage", reason: "The change could not be saved to local storage." });
    expect(result.structuredContent.reason).not.toContain("private");
  });

  it("binds project deletion tokens to the selected revision and consumes them once", async () => {
    const project = createProjectAtScale("delete-token", "Delete token", "en", "world");
    const projects = [project]; const session = {};
    let deleted = 0;
    const tools = createProjectLibraryTools({ getProjects: () => projects, getSession: () => session, deleteProject: async () => { deleted += 1; return true; } });
    const prepare = tools.find(({ name }) => name === "prepare_delete_cartographer_project")!;
    const apply = tools.find(({ name }) => name === "apply_project_deletion")!;
    const prepared = await prepare.execute({ projectId: project.id }) as { structuredContent: { token: string } };
    project.name = "Changed locally";
    expect((await apply.execute({ token: prepared.structuredContent.token }) as { structuredContent: { status: string } }).structuredContent.status).toBe("stale");
    expect((await apply.execute({ token: prepared.structuredContent.token }) as { structuredContent: { status: string } }).structuredContent.status).toBe("not-found");
    expect(deleted).toBe(0);
  });
});
