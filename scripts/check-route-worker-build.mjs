import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, extname, join, relative } from "node:path";

const staticRoot = join("out", "_next", "static");

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

const failures = [];
if (!existsSync(staticRoot)) {
  failures.push(`Missing production assets directory: ${staticRoot}`);
}

const files = failures.length ? [] : filesBelow(staticRoot);
const scripts = files.filter((path) => extname(path) === ".js");
const leakedSources = files.filter((path) => {
  if (!/[.]tsx?$/u.test(path)) return false;
  const source = readFileSync(path, "utf8");
  return source.includes("findStoryRoutes") || source.includes("RouteWorkerRequest") || source.includes("import type");
});

const clientArtifact = scripts.find((path) => {
  const source = readFileSync(path, "utf8");
  return source.includes("new Worker") && source.includes("Route worker is unavailable in this browser.");
});
let workerArtifact;

if (clientArtifact) {
  const clientSource = readFileSync(clientArtifact, "utf8");
  const routeLauncherAt = clientSource.indexOf("Route worker is unavailable in this browser.");
  const routeLauncher = clientSource.slice(routeLauncherAt, routeLauncherAt + 700);
  const workerChunkId = routeLauncher.match(/new Worker[\s\S]*?[.]u\((\d+)\)/u)?.[1];
  if (!workerChunkId) {
    failures.push("The route Worker launcher does not reference a verifiable Webpack chunk.");
  } else {
    workerArtifact = scripts.find((path) => basename(path).startsWith(`${workerChunkId}.`));
    if (!workerArtifact) failures.push(`The route Worker references missing chunk ${workerChunkId}.`);
  }
}

if (workerArtifact) {
  const workerSource = readFileSync(workerArtifact, "utf8");
  const workerMarkers = ["globalThis", "onmessage", "postMessage", "attemptId", "calculate"];
  const forbiddenTypeScript = ["import type", "type RouteWorkerRequest", " as unknown as "];
  if (!workerMarkers.every((marker) => workerSource.includes(marker))) {
    failures.push(`The referenced route Worker chunk lacks its runtime contract: ${relative(".", workerArtifact)}.`);
  }
  if (forbiddenTypeScript.some((marker) => workerSource.includes(marker))) {
    failures.push(`The referenced route Worker chunk contains uncompiled TypeScript: ${relative(".", workerArtifact)}.`);
  }
  const syntaxCheck = spawnSync(process.execPath, ["--check", workerArtifact], { encoding: "utf8" });
  if (syntaxCheck.status !== 0) {
    failures.push(`The referenced route Worker chunk is not valid JavaScript:\n${syntaxCheck.stderr.trim()}`);
  }
}

if (leakedSources.length) {
  failures.push(`Route Worker leaked as uncompiled TypeScript:\n${leakedSources.map((path) => relative(".", path)).join("\n")}`);
}
if (!clientArtifact) failures.push("The production client does not contain the route Worker launcher.");

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exitCode = 1;
} else {
  console.log(`Route Worker build passed: ${relative(".", workerArtifact)}.`);
}
