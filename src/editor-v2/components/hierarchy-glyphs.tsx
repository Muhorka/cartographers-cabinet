import type { PlaceNode } from "../model/project-model";
export function ChevronGlyph({ expanded }: { expanded: boolean }) { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d={expanded ? "M3.5 5.5 8 10l4.5-4.5" : "M5.5 3.5 10 8l-4.5 4.5"} /></svg>; }
export function AddLevelGlyph() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 14.5h12M6.2 11h7.6M8.4 7.5h3.2M10 3.5v8M7.7 5.8 10 3.5l2.3 2.3" /></svg>; }
export function DisplayedPlaceGlyph() { return <svg viewBox="0 0 20 14" aria-hidden="true"><path d="M1.5 7s3.3-5 8.5-5 8.5 5 8.5 5-3.3 5-8.5 5S1.5 7 1.5 7Z"/><circle cx="10" cy="7" r="2.2"/></svg>; }
export function PlaceGlyph({ kind }: { kind: PlaceNode["kind"] }) {
  if (kind === "building") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 16.5h13M5 16.5v-8l5-4 5 4v8M8 16.5v-5h4v5" /></svg>;
  if (kind === "level") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15.5h14M4.5 12h11M6 8.5h8M7.5 5h5" /></svg>;
  if (kind === "room") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4h13v12h-13zM10.5 16v-4h6"/><circle cx="11.8" cy="14" r=".6"/></svg>;
  if (kind === "world") return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M3.5 10h13M10 3c2.2 2 3.3 4.3 3.3 7S12.2 15 10 17M10 3C7.8 5 6.7 7.3 6.7 10S7.8 15 10 17" /></svg>;
  if (kind === "location") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17s5-5.2 5-9a5 5 0 0 0-10 0c0 3.8 5 9 5 9Z"/><circle cx="10" cy="8" r="1.7" /></svg>;
  if (kind === "standalone-room") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h12v12H4zM10 16v-4h6" /></svg>;
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5 16.5 7v6L10 16.5 3.5 13V7z" /></svg>;
}
