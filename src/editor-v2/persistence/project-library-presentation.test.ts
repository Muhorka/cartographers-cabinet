import { describe, expect, it } from "vitest";
import { createStarterProject } from "../model/starter-project";
import { projectLibraryDetails, projectLibraryThumbnail } from "./project-library-presentation";

describe("project library presentation", () => {
  it("summarizes the complete V2 project rather than only its roots", () => {
    const project = createStarterProject("library-project", "Library", "en");
    const details = projectLibraryDetails(project);
    expect(details).toMatchObject({ rootCount: 1, placeCount: 5, levelCount: 1, roomCount: 1, wallCount: 4 });
    expect(details.elementCount).toBe(0);
  });

  it("returns an encoded SVG data URI for safe card thumbnails", () => {
    const project = createStarterProject("thumbnail-project", "<unsafe>", "en");
    const thumbnail = projectLibraryThumbnail(project);
    expect(thumbnail.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(thumbnail).not.toContain("<unsafe>");
    expect(decodeURIComponent(thumbnail)).toContain("&lt;unsafe&gt;");
  });
});
