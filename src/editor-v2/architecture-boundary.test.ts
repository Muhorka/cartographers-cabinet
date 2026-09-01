import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : /\.(ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
}

describe("editor-v2 architecture boundary", () => {
  it("does not route behavior back through the legacy editor", () => {
    const violations = sourceFiles(root).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /from\s+["']\.\.\/\.\.\/(components|domain)\//.test(source) ? [file] : [];
    });
    expect(violations).toEqual([]);
  });
});
