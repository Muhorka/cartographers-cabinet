import { z } from "zod";
import type { EditorProject } from "../model/project-model";
import { projectIntegrityIssues } from "../model/project-integrity";

export function validateProjectRelations(project: EditorProject, context: z.RefinementCtx) {
  for (const issue of projectIntegrityIssues(project)) context.addIssue({ code: "custom", message: issue.message, path: issue.path });
}
