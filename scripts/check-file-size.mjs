import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const limits = new Map([
  [".ts", 260],
  [".tsx", 220],
  [".css", 420],
]);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collect(path) : [path];
  }));
  return nested.flat();
}

const oversized = [];
for (const file of await collect(sourceRoot)) {
  const limit = limits.get(extname(file));
  if (!limit) continue;
  const lines = (await readFile(file, "utf8")).split(/\r?\n/).length;
  if (lines > limit) oversized.push(`${relative(root, file)}: ${lines} lines (limit ${limit})`);
}

if (oversized.length) {
  console.error(`Files requiring a natural split:\n${oversized.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Source file sizes are within the agreed limits.");
}
