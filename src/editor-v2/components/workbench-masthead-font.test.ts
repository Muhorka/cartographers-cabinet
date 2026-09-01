import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");
const asset = resolve(root, "public/fonts/italianno/Italianno-Regular.ttf");
const license = resolve(root, "public/fonts/italianno/OFL.txt");

describe("Italianno masthead font", () => {
  it("keeps a licensed local font asset wired to the declared family", () => {
    expect(css).toContain('font-family:"Italianno Cabinet"');
    expect(css).toContain('src:url("/fonts/italianno/Italianno-Regular.ttf")');
    expect(css).toContain("font-display:swap");
    expect(existsSync(asset)).toBe(true);
    expect(existsSync(license)).toBe(true);
    expect(createHash("sha256").update(readFileSync(asset)).digest("hex")).toBe("8b9f528dfeccad7f1572ee10d50823cae5105b8ed69f71b124684c834b940a07");
    expect(readFileSync(license, "utf8")).toContain("SIL Open Font License");
  });
});
