"use client";
import { useCallback, useLayoutEffect, useRef } from "react";
import { readProjectCheckpoint } from "../persistence/project-library";
import type { EditorSession } from "../state/editor-session";
import { createProposalChangeReader } from "./proposal-change-reader";
import type { ProposalChangeInput } from "../story/review/proposal-change-types";

export function useProposalChangeReader(session?: EditorSession) {
  const current = useRef(session);
  useLayoutEffect(() => { current.current = session; return () => { current.current = undefined; }; }, [session]);
  return useCallback((input: ProposalChangeInput) => createProposalChangeReader({
    getSession: () => { if (!current.current) throw new Error("No current editor session"); return current.current; },
    getCheckpoint: (id) => current.current ? readProjectCheckpoint(id, current.current.getViewState().project.id) : Promise.resolve(undefined),
  })(input), []);
}
