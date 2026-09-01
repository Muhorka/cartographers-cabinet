import type { EditorProject } from "../model/project-model";
import { editorProjectSchema } from "./project-file";
import { projectRevision } from "../state/project-revision";

export type ProjectCheckpoint = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  snapshot: EditorProject;
  kind?: "manual" | "safety" | "proposal";
  baseSnapshot?: EditorProject;
  summary?: string;
};

export type ProjectCheckpointSummary = Omit<ProjectCheckpoint, "snapshot" | "baseSnapshot">;

export function checkpointSummary(checkpoint: ProjectCheckpoint): ProjectCheckpointSummary {
  const { id, projectId, name, createdAt, kind, summary } = checkpoint;
  return { id, projectId, name, createdAt, ...(kind ? { kind } : {}), ...(summary ? { summary } : {}) };
}

export function createProjectCheckpoint(project: EditorProject, input: { id: string; name: string; createdAt?: string; kind?: ProjectCheckpoint["kind"]; baseSnapshot?: EditorProject; summary?: string }): ProjectCheckpoint {
  const name = input.name.trim();
  if (!input.id.trim()) throw new Error("Checkpoint identifier cannot be empty.");
  if (!name) throw new Error("Checkpoint name cannot be empty.");
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("Checkpoint date is invalid.");
  const baseSnapshot = input.baseSnapshot ? editorProjectSchema.parse(structuredClone(input.baseSnapshot)) : undefined;
  if (baseSnapshot && baseSnapshot.id !== project.id) throw new Error("Proposal base belongs to another project.");
  if (input.kind === "proposal" && !baseSnapshot) throw new Error("A proposal needs its original project state.");
  return { id: input.id, projectId: project.id, name, createdAt, snapshot: editorProjectSchema.parse(structuredClone(project)), ...(input.kind ? { kind: input.kind } : {}), ...(baseSnapshot ? { baseSnapshot } : {}), ...(input.summary ? { summary: input.summary } : {}) };
}

export function assertProposalCurrent(checkpoint: ProjectCheckpoint, current: EditorProject) {
  if (checkpoint.kind !== "proposal") return;
  if (!checkpoint.baseSnapshot || projectRevision(editorProjectSchema.parse(checkpoint.baseSnapshot)) !== projectRevision(current)) throw new Error("proposal-stale");
}

export function restoreCheckpointSnapshot(checkpoint: ProjectCheckpoint, restoredAt = new Date().toISOString()) {
  const snapshot = editorProjectSchema.parse(structuredClone(checkpoint.snapshot));
  if (snapshot.id !== checkpoint.projectId) throw new Error("Checkpoint does not belong to its project.");
  return editorProjectSchema.parse({ ...snapshot, updatedAt: restoredAt });
}
